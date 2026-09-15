import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { Hono } from "hono";
import { db, userAuthStore, setRequireRegistrationApprovalDB } from "@srouter/db";
import { TERMS_VERSION } from "@srouter/constants";
import { GitHubUserAuthRouter } from "@/routes/v1/githubAuth.js";
import { hashUserPassword } from "@/services/userAuth.js";

const CLIENT_ID = "test-client-id";
const CLIENT_SECRET = "test-client-secret";

let seq = 0;
function nextGitHubId() {
    seq += 1;
    return `9${String(900000 + seq)}`;
}
function nextEmail(login: string) {
    return `${login}@gh-oauth-test.xeygate.test`;
}

const app = new Hono();
app.route("/v1", GitHubUserAuthRouter);

// ── GitHub API mocking ──

const realFetch = globalThis.fetch;
let profilePayload: unknown = null;

function mockGitHub(profile: unknown) {
    profilePayload = profile;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(typeof input === "object" && "url" in input ? input.url : input);
        if (url === "https://github.com/login/oauth/access_token") {
            return Response.json({ access_token: "ghu_test_token", token_type: "bearer", scope: "read:user,user:email" });
        }
        if (url === "https://api.github.com/user") {
            return Response.json(profilePayload);
        }
        if (url === "https://api.github.com/user/emails") {
            return Response.json([]);
        }
        throw new Error(`unexpected fetch in test: ${url}`);
    }) as typeof fetch;
}

beforeEach(() => {
    process.env.GITHUB_CLIENT_ID = CLIENT_ID;
    process.env.GITHUB_CLIENT_SECRET = CLIENT_SECRET;
});

afterEach(async () => {
    globalThis.fetch = realFetch;
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
    // Some tests never touch the store; make sure tables exist before cleanup.
    await userAuthStore.getUserByEmail("probe@xeygate.test");
    const own = "email LIKE '%@gh-oauth-test.xeygate.test' OR github_id LIKE '99%'";
    await db
        .prepare(`DELETE FROM transactions WHERE user_id IN (SELECT id FROM users WHERE ${own})`)
        .run();
    await db
        .prepare(`DELETE FROM login_rewards WHERE user_id IN (SELECT id FROM users WHERE ${own})`)
        .run();
    await db
        .prepare(`DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE ${own})`)
        .run();
    await db
        .prepare(`DELETE FROM users WHERE ${own}`)
        .run();
});

async function get(path: string, cookie?: string) {
    return app.request(path, { headers: cookie ? { Cookie: cookie } : {} });
}

/** Runs the start step and returns the (state, cookie) pair for the callback. */
async function startFlow() {
    const res = await get("/v1/users/oauth/github/start?consent=1");
    const location = res.headers.get("location") ?? "";
    const setCookie = res.headers.get("set-cookie") ?? "";
    const state = new URL(location).searchParams.get("state");
    const rawCookie = /xeygate_github_oauth=([^;]+)/.exec(setCookie)?.[1];
    // Hono percent-encodes the "|" separator in the cookie value.
    const cookie = rawCookie ? decodeURIComponent(rawCookie) : undefined;
    return { res, location, state, cookie };
}

test("status reports enabled only when the OAuth App is configured", async () => {
    const on = await get("/v1/users/oauth/github/status");
    assert.equal((await on.json()).enabled, true);

    delete process.env.GITHUB_CLIENT_SECRET;
    const off = await get("/v1/users/oauth/github/status");
    assert.equal((await off.json()).enabled, false);
});

test("start without consent redirects back with consent_required", async () => {
    const res = await get("/v1/users/oauth/github/start");
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), "/login?error=consent_required");
});

test("start redirects to GitHub authorize with state and a bound cookie", async () => {
    const { res, location, state, cookie } = await startFlow();
    assert.equal(res.status, 302);
    const url = new URL(location);
    assert.equal(url.origin + url.pathname, "https://github.com/login/oauth/authorize");
    assert.equal(url.searchParams.get("client_id"), CLIENT_ID);
    assert.equal(url.searchParams.get("scope"), "read:user user:email");
    assert.ok(state && state.length > 20);
    assert.ok(cookie && cookie.startsWith(`${state}|`));
});

test("callback with a mismatched state is rejected (CSRF guard)", async () => {
    const { cookie } = await startFlow();
    const res = await get(
        "/v1/users/oauth/github/callback?code=test-code&state=tampered-state",
        `xeygate_github_oauth=${cookie}`
    );
    assert.equal(res.headers.get("location"), "/login?error=github_state_mismatch");
});

test("callback without the state cookie is rejected", async () => {
    const res = await get("/v1/users/oauth/github/callback?code=test-code&state=whatever");
    assert.equal(res.headers.get("location"), "/login?error=github_state_mismatch");
});

test("callback honors the user-cancelling-the-consent error", async () => {
    const { state, cookie } = await startFlow();
    const res = await get(
        `/v1/users/oauth/github/callback?error=access_denied&state=${state}`,
        `xeygate_github_oauth=${cookie}`
    );
    assert.equal(res.headers.get("location"), "/login?error=github_cancelled");
});

test("new GitHub account is created, consented, and signed in", async () => {
    const githubId = nextGitHubId();
    const login = `ghtest-new-${githubId}`;
    const email = nextEmail(login);
    mockGitHub({ id: Number(githubId), login, name: "Gh Tester", email });

    const { state, cookie } = await startFlow();
    const res = await get(
        `/v1/users/oauth/github/callback?code=test-code&state=${state}`,
        `xeygate_github_oauth=${cookie}`
    );
    assert.equal(res.headers.get("location"), "/onboarding");
    assert.match(res.headers.get("set-cookie") ?? "", /xeygate_user_session=/);

    const user = await userAuthStore.getUserByEmail(email);
    assert.ok(user);
    assert.equal(user.githubId, githubId);
    assert.equal(user.name, "Gh Tester");
    assert.equal(user.status, "active");
    assert.ok(user.acceptedTermsAt !== null);
    assert.equal(user.termsVersion, TERMS_VERSION);

    // Re-using the same GitHub identity signs into the same account.
    const second = await startFlow();
    const res2 = await get(
        `/v1/users/oauth/github/callback?code=test-code&state=${second.state}`,
        `xeygate_github_oauth=${second.cookie}`
    );
    assert.equal(res2.headers.get("location"), "/dashboard");
    const again = await userAuthStore.getUserByGitHubId(githubId);
    assert.equal(again?.id, user.id);
});

test("GitHub email fallback: hidden profile email uses the noreply address", async () => {
    const githubId = nextGitHubId();
    const login = `ghtest-noreply-${githubId}`;
    mockGitHub({ id: Number(githubId), login, name: null, email: null });

    const { state, cookie } = await startFlow();
    const res = await get(
        `/v1/users/oauth/github/callback?code=test-code&state=${state}`,
        `xeygate_github_oauth=${cookie}`
    );
    assert.equal(res.headers.get("location"), "/onboarding");

    const user = await userAuthStore.getUserByGitHubId(githubId);
    assert.ok(user);
    assert.equal(user.email, `${githubId}+${login}@users.noreply.github.com`);
    assert.equal(user.name, login);
});

test("existing email account gets the GitHub identity linked, not duplicated", async () => {
    const githubId = nextGitHubId();
    const login = `ghtest-link-${githubId}`;
    const email = nextEmail(login);
    const created = await userAuthStore.createUser({
        email,
        passwordHash: hashUserPassword("ghtest-pass-123"),
        name: "Email First",
        status: "active",
        acceptedTermsAt: Date.now(),
        termsVersion: TERMS_VERSION
    });
    assert.ok(created);

    mockGitHub({ id: Number(githubId), login, name: "Email First", email });
    const { state, cookie } = await startFlow();
    const res = await get(
        `/v1/users/oauth/github/callback?code=test-code&state=${state}`,
        `xeygate_github_oauth=${cookie}`
    );
    assert.equal(res.headers.get("location"), "/dashboard");

    const user = await userAuthStore.getUserById(created.id);
    assert.ok(user);
    assert.equal(user.githubId, githubId);
});

test("legacy linked account re-consents through the checkbox flag", async () => {
    const githubId = nextGitHubId();
    const login = `ghtest-legacy-${githubId}`;
    const email = nextEmail(login);
    const created = await userAuthStore.createUser({
        email,
        passwordHash: hashUserPassword("ghtest-pass-123"),
        name: "Legacy Gh",
        status: "active"
    });
    assert.ok(created);
    await userAuthStore.linkGitHubAccount(created.id, githubId);

    mockGitHub({ id: Number(githubId), login, name: "Legacy Gh", email });

    const flow = await startFlow();
    // Cookie flag forged to 0: simulates a flow started without consent.
    const denied = await get(
        `/v1/users/oauth/github/callback?code=test-code&state=${flow.state}`,
        `xeygate_github_oauth=${flow.state}|0`
    );
    assert.equal(denied.headers.get("location"), "/login?error=github_terms_required");

    const granted = await get(
        `/v1/users/oauth/github/callback?code=test-code&state=${flow.state}`,
        `xeygate_github_oauth=${flow.state}|1`
    );
    assert.equal(granted.headers.get("location"), "/dashboard");
    const user = await userAuthStore.getUserByGitHubId(githubId);
    assert.ok(user);
    assert.ok(user.acceptedTermsAt !== null);
    assert.equal(user.termsVersion, TERMS_VERSION);
});

test("registration gate holds new GitHub accounts as pending", async () => {
    const githubId = nextGitHubId();
    const login = `ghtest-gated-${githubId}`;
    mockGitHub({ id: Number(githubId), login, name: "Gated", email: null });

    await setRequireRegistrationApprovalDB(true);
    try {
        const { state, cookie } = await startFlow();
        const res = await get(
            `/v1/users/oauth/github/callback?code=test-code&state=${state}`,
            `xeygate_github_oauth=${cookie}`
        );
        assert.equal(res.headers.get("location"), "/login?error=github_pending_approval");
        const user = await userAuthStore.getUserByGitHubId(githubId);
        assert.ok(user);
        assert.equal(user.status, "pending");
    } finally {
        await setRequireRegistrationApprovalDB(false);
    }
});

test("banned account cannot sign in through GitHub", async () => {
    const githubId = nextGitHubId();
    const login = `ghtest-banned-${githubId}`;
    const created = await userAuthStore.createUser({
        email: nextEmail(login),
        passwordHash: hashUserPassword("ghtest-pass-123"),
        name: "Banned Gh",
        status: "active",
        githubId
    });
    assert.ok(created);
    await userAuthStore.updateStatus(created.id, "banned");

    mockGitHub({ id: Number(githubId), login, name: "Banned Gh", email: null });
    const { state, cookie } = await startFlow();
    const res = await get(
        `/v1/users/oauth/github/callback?code=test-code&state=${state}`,
        `xeygate_github_oauth=${cookie}`
    );
    assert.equal(res.headers.get("location"), "/login?error=github_banned");
});

test("GitHub sign-in stays disabled without credentials", async () => {
    delete process.env.GITHUB_CLIENT_ID;
    const res = await get("/v1/users/oauth/github/start?consent=1");
    assert.equal(res.headers.get("location"), "/login?error=github_not_configured");
});
