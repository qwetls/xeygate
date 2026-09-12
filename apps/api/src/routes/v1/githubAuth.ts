import { Hono } from "hono";
import { randomBytes } from "node:crypto";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import { TERMS_VERSION } from "@srouter/constants";
import { userAuthStore, getRequireRegistrationApprovalDB } from "@srouter/db";
import {
    validateEmail,
    hashUserPassword,
    createUserSession,
    USER_SESSION_COOKIE,
    USER_SESSION_TTL_MS
} from "@/services/userAuth.js";
import { GrantDailyLoginReward } from "@/services/dailyReward.js";
import { Ok } from "@/utils/response.js";
import {
    GitHubOAuthConfig,
    GitHubCallbackUrl,
    GitHubAuthorizeUrl,
    ExchangeGitHubCode,
    FetchGitHubIdentity
} from "@/services/githubOAuth.js";

// User-facing GitHub sign-in. Deliberately under /users/oauth/* instead of
// /auth/* — the existing /auth/<provider> space is admin-side *provider*
// OAuth (connecting upstream accounts), not identity login.
export const GitHubUserAuthRouter = new Hono();

const OAUTH_STATE_COOKIE = "xeygate_github_oauth";
const STATE_MAX_AGE_S = 10 * 60;

const COOKIE_BASE = {
    path: "/",
    httpOnly: true,
    secure: process.env.SROUTER_SECURE_COOKIES === "true",
    sameSite: "lax" as const
};

const SESSION_COOKIE_OPTS = {
    ...COOKIE_BASE,
    maxAge: Math.floor(USER_SESSION_TTL_MS / 1000)
};

// GitHub sign-in keeps the consent contract of the email flow: the checkbox
// on /login and /register gates the button, the flag rides through the state
// cookie and is enforced again in this router (accounts get stamped, never
// silently created without consent).
GitHubUserAuthRouter.get("/users/oauth/github/status", (c) =>
    Ok(c, { enabled: GitHubOAuthConfig() !== null })
);

GitHubUserAuthRouter.get("/users/oauth/github/start", (c) => {
    const config = GitHubOAuthConfig();
    if (!config) return c.redirect("/login?error=github_not_configured");
    if (c.req.query("consent") !== "1") return c.redirect("/login?error=consent_required");

    const state = randomBytes(24).toString("base64url");
    // Cookie keeps state + the consent flag; GitHub echoes `state` back, the
    // flag never leaves this origin.
    setCookie(c, OAUTH_STATE_COOKIE, `${state}|1`, { ...COOKIE_BASE, maxAge: STATE_MAX_AGE_S });
    return c.redirect(GitHubAuthorizeUrl(config.clientId, GitHubCallbackUrl(c.req.url), state));
});

GitHubUserAuthRouter.get("/users/oauth/github/callback", async (c) => {
    const bail = (reason: string) => {
        deleteCookie(c, OAUTH_STATE_COOKIE, { path: "/" });
        return c.redirect(`/login?error=${reason}`);
    };

    const config = GitHubOAuthConfig();
    if (!config) return bail("github_not_configured");

    const raw = getCookie(c, OAUTH_STATE_COOKIE);
    deleteCookie(c, OAUTH_STATE_COOKIE, { path: "/" });
    const [expectedState, consentFlag] = (raw ?? "").split("|");
    const state = c.req.query("state") ?? "";
    if (!expectedState || state !== expectedState) return bail("github_state_mismatch");
    if (c.req.query("error")) return bail("github_cancelled");

    const code = c.req.query("code");
    if (!code) return bail("github_no_code");

    const accessToken = await ExchangeGitHubCode(
        config.clientId,
        config.clientSecret,
        code,
        GitHubCallbackUrl(c.req.url)
    );
    if (!accessToken) return bail("github_exchange_failed");

    const identity = await FetchGitHubIdentity(accessToken);
    if (!identity) return bail("github_profile_failed");

    const consented = consentFlag === "1";
    let user = await userAuthStore.getUserByGitHubId(identity.githubId);
    let isNew = false;

    if (!user) {
        // GitHub hides emails by default; the noreply address is stable and
        // owned by the same account, so it is a safe login identity.
        const email = identity.email ?? `${identity.githubId}+${identity.login}@users.noreply.github.com`;
        if (validateEmail(email)) return bail("github_email_failed");

        const existing = await userAuthStore.getUserByEmail(email);
        if (existing) {
            // Same person, pre-existing account: link the GitHub identity
            // (GitHub has verified this email) instead of creating a twin.
            user = await userAuthStore.linkGitHubAccount(existing.id, identity.githubId);
            if (!user) return bail("github_link_failed");
        } else {
            const requiresApproval = await getRequireRegistrationApprovalDB();
            // OAuth accounts have no password: a random secret is stored so
            // the password login path can never authenticate them.
            user = await userAuthStore.createUser({
                email,
                passwordHash: hashUserPassword(randomBytes(32).toString("base64url")),
                name: identity.name,
                status: requiresApproval ? "pending" : "active",
                githubId: identity.githubId,
                acceptedTermsAt: consented ? Date.now() : undefined,
                termsVersion: consented ? TERMS_VERSION : undefined
            });
            if (!user) return bail("github_account_failed");
            isNew = true;
            if (requiresApproval) return bail("github_pending_approval");
        }
    }

    if (user.status === "banned") return bail("github_banned");
    if (user.status === "pending") return bail("github_pending");

    // Same re-consent rule as password login: stale consent is refreshed when
    // the checkbox rode along with the flow, otherwise the user must retry.
    if (user.acceptedTermsAt === null || user.termsVersion !== TERMS_VERSION) {
        if (!consented) return bail("github_terms_required");
        const accepted = await userAuthStore.acceptTerms(user.id, TERMS_VERSION);
        if (accepted) user = accepted;
    }

    const token = await createUserSession(userAuthStore, user.id);
    setCookie(c, USER_SESSION_COOKIE, token, SESSION_COOKIE_OPTS);

    // GitHub sign-in counts as a sign-in for the streak; a brand-new account
    // is a registration, and registration never grants (same rule as email).
    if (!isNew) await GrantDailyLoginReward(user.id);

    return c.redirect(isNew ? "/onboarding" : user.isAdmin ? "/admin" : "/dashboard");
});
