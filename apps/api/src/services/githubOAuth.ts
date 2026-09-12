import { GetPublicUrlBase } from "@/utils/callbackUrl.js";

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_API_BASE = "https://api.github.com";

/** Scopes needed to identify the account and reach a signable email. */
const GITHUB_OAUTH_SCOPE = "read:user user:email";

export interface GitHubIdentity {
    githubId: string;
    login: string;
    name: string;
    email: string | null;
}

/**
 * GitHub OAuth App credentials (Settings → Developer settings → OAuth Apps).
 * The user-facing GitHub sign-in stays disabled until both are set, so the
 * feature is inert without configuration.
 */
export function GitHubOAuthConfig(): { clientId: string; clientSecret: string } | null {
    const clientId = process.env.GITHUB_CLIENT_ID?.trim();
    const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) return null;
    return { clientId, clientSecret };
}

/**
 * Redirect URI registered on the OAuth App. Prefers SROUTER_PUBLIC_URL (the
 * canonical public origin) and falls back to the request's own origin, which
 * is correct when the app is served behind a proxy on its public hostname.
 */
export function GitHubCallbackUrl(requestUrl: string): string {
    let base = GetPublicUrlBase();
    if (!base) {
        try {
            base = new URL(requestUrl).origin;
        } catch {
            base = "";
        }
    }
    return `${base}/v1/users/oauth/github/callback`;
}

export function GitHubAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: GITHUB_OAUTH_SCOPE,
        state
    });
    return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
}

/** Exchanges the callback code for an access token; null on any failure. */
export async function ExchangeGitHubCode(
    clientId: string,
    clientSecret: string,
    code: string,
    redirectUri: string
): Promise<string | null> {
    try {
        const res = await fetch(GITHUB_ACCESS_TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri })
        });
        if (!res.ok) return null;
        const data = (await res.json().catch(() => null)) as { access_token?: unknown } | null;
        return typeof data?.access_token === "string" && data.access_token.length > 0
            ? data.access_token
            : null;
    } catch {
        return null;
    }
}

/**
 * Resolves the signed-in GitHub account. The public profile email can be
 * empty (privacy on), so it falls back to the verified emails endpoint.
 */
export async function FetchGitHubIdentity(accessToken: string): Promise<GitHubIdentity | null> {
    try {
        const headers = {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "xeygate"
        };
        const res = await fetch(`${GITHUB_API_BASE}/user`, { headers });
        if (!res.ok) return null;
        const user = (await res.json().catch(() => null)) as
            | { id?: unknown; login?: unknown; name?: unknown; email?: unknown }
            | null;
        if (typeof user?.id !== "number" || typeof user.login !== "string") return null;

        let email: string | null =
            typeof user.email === "string" && user.email.length > 0 ? user.email : null;
        if (!email) {
            const emailsRes = await fetch(`${GITHUB_API_BASE}/user/emails`, { headers });
            if (emailsRes.ok) {
                const emails = (await emailsRes.json().catch(() => [])) as unknown;
                if (Array.isArray(emails)) {
                    const entries = emails as Array<{ email?: unknown; primary?: unknown; verified?: unknown }>;
                    const pick =
                        entries.find((e) => e.primary === true && e.verified === true && typeof e.email === "string") ??
                        entries.find((e) => e.verified === true && typeof e.email === "string") ??
                        entries.find((e) => typeof e.email === "string" && e.email.length > 0);
                    email = typeof pick?.email === "string" ? pick.email : null;
                }
            }
        }

        return {
            githubId: String(user.id),
            login: user.login,
            name: typeof user.name === "string" && user.name.trim().length > 0 ? user.name.trim() : user.login,
            email
        };
    } catch {
        return null;
    }
}
