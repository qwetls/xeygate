import { CODEBUDDY_BASE_URL } from "@srouter/constants";
import {
    cleanupExpiredOAuthSessionsDB,
    deleteOAuthSessionDB,
    getOAuthSessionDB,
    saveOAuthSessionDB,
    upsertProviderDB
} from "@srouter/db";
import { CodeBuddyOAuth, generatePKCE, QoderOAuth } from "@srouter/providers";
import { CodeBuddyExecutor, QoderExecutor } from "@srouter/executors";
import type { ProviderConfig } from "@srouter/types";
import { registry } from "@/services/registry.js";
import {
    anthropicAuthHandler,
    antigravityAuthHandler,
    bluesMindsAuthHandler,
    claudeAuthHandler,
    codeBuddyAuthHandler,
    commandCodeAuthHandler,
    goRouterAuthHandler,
    openaiCodexAuthHandler,
    qoderAuthHandler,
    seekAIAuthHandler,
    tabiTokenAuthHandler,
    tokenRouterAuthHandler,
    type AuthProviderHandler,
    type OAuthLoginParams,
    type OAuthLoginResult,
    type TokenImportParams
} from "./auth.providers.js";

export type { OAuthLoginParams, OAuthLoginResult, TokenImportParams } from "./auth.providers.js";

const PKCE_SESSION_MAX_AGE_MS = 15 * 60 * 1000;

function cleanupExpiredSessions(): void {
    cleanupExpiredOAuthSessionsDB(PKCE_SESSION_MAX_AGE_MS);
}

/**
 * Resolve the PKCE client id for a handler, honoring per-call env + query overrides,
 * mirroring the original per-provider defaults exactly.
 */
function resolveClientId(handler: AuthProviderHandler, params: OAuthLoginParams): string {
    return params.clientId || handler.clientId?.() || "";
}

function resolveRedirectUri(handler: AuthProviderHandler, params: OAuthLoginParams): string {
    return params.redirectUri || handler.defaultRedirectUri || "";
}

/**
 * Generate a stable, unique account id + human-friendly name for a newly saved provider.
 */
function buildAccountIdentity(
    handler: AuthProviderHandler,
    now: number
): { accountId: string; accountName: string } {
    return {
        accountId: `${handler.idPrefix}_${now}`,
        accountName: `${handler.displayName} (Account #${now.toString().slice(-4)})`
    };
}

// --- Generic engine (parameterized by an AuthProviderHandler) ---

function initiatePKCEFor(handler: AuthProviderHandler, params: OAuthLoginParams): OAuthLoginResult {
    cleanupExpiredSessions();
    const clientId = resolveClientId(handler, params);
    const redirectUri = resolveRedirectUri(handler, params);
    const prompt = params.prompt;

    const oauthInstance = new handler.oauthClass!({ clientId, redirectUri, prompt });

    const pkce = generatePKCE();
    saveOAuthSessionDB({
        state: pkce.state,
        codeVerifier: pkce.codeVerifier,
        clientId,
        redirectUri,
        createdAt: Date.now()
    });

    const authorizeUrl = oauthInstance.getAuthorizationUrl(pkce);

    return {
        authorizeUrl,
        state: pkce.state,
        codeVerifier: pkce.codeVerifier,
        redirectUri
    };
}

async function processOAuthCallbackFor(
    handler: AuthProviderHandler,
    code: string,
    state: string
): Promise<ProviderConfig> {
    cleanupExpiredSessions();

    const session = getOAuthSessionDB(state);
    if (!session) {
        throw new Error("Invalid or expired OAuth state parameter");
    }

    deleteOAuthSessionDB(state);

    const oauthInstance = new handler.oauthClass!({
        clientId: session.clientId,
        redirectUri: session.redirectUri
    });

    const rawTokens = await oauthInstance.exchangeCodeForTokens(code, session.codeVerifier);
    const tokens = handler.mapOAuthTokens?.(rawTokens) ?? {
        accessToken: rawTokens.accessToken,
        refreshToken: rawTokens.refreshToken,
        expiresIn: rawTokens.expiresIn
    };

    const timestamp = Date.now();
    const { accountId, accountName } = buildAccountIdentity(handler, timestamp);

    const baseUrl = handler.baseUrl ? handler.baseUrl() : undefined;

    const providerConfig = upsertProviderDB({
        id: accountId,
        providerId: handler.providerId,
        name: accountName,
        category: handler.category,
        protocol: handler.protocol,
        baseUrl,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accountId: tokens.accountId,
        organizationId: tokens.organizationId,
        tokenExpiresAt: tokens.expiresIn ? Date.now() + tokens.expiresIn * 1000 : undefined,
        lastRefreshedAt: Date.now(),
        enabled: true,
        createdAt: timestamp
    });

    const providerInstance = handler.buildExecutor({
        id: accountId,
        name: accountName,
        accountId: tokens.accountId,
        organizationId: tokens.organizationId,
        baseUrl,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
    });
    registry.registerProvider(providerInstance);

    return providerConfig;
}

function processTokenImportFor(
    handler: AuthProviderHandler,
    params: TokenImportParams
): ProviderConfig {
    const timestamp = Date.now();
    const accountId = params.id || `${handler.idPrefix}_${timestamp}`;
    const providerName =
        params.name || `${handler.displayName} (Account #${timestamp.toString().slice(-4)})`;
    const mapping = handler.mapImportTokens?.(params) ?? {
        accessToken: params.accessToken,
        refreshToken: params.refreshToken,
        accountId: params.accountId
    };
    const baseUrl = params.baseUrl || handler.baseUrl?.();

    const providerConfig = upsertProviderDB({
        id: accountId,
        providerId: handler.providerId,
        name: providerName,
        category: handler.category,
        protocol: handler.protocol,
        baseUrl: mapping.baseUrl ?? baseUrl,
        apiKey: mapping.apiKey,
        accessToken: mapping.accessToken,
        refreshToken: mapping.refreshToken,
        accountId: mapping.accountId,
        organizationId: mapping.organizationId,
        enabled: true,
        createdAt: timestamp
    });

    const providerInstance = handler.buildExecutor({
        id: accountId,
        name: providerName,
        accountId: mapping.accountId,
        organizationId: mapping.organizationId,
        baseUrl: mapping.baseUrl ?? baseUrl,
        apiKey: mapping.apiKey,
        accessToken: mapping.accessToken,
        refreshToken: mapping.refreshToken
    });
    registry.registerProvider(providerInstance);

    return providerConfig;
}

// --- Public API (thin adapters, names preserved so routes/index.ts stay unchanged) ---

export class AuthLogic {
    // OpenAI Codex OAuth
    public static initiateOAuthPKCE(params: OAuthLoginParams): OAuthLoginResult {
        return initiatePKCEFor(openaiCodexAuthHandler, params);
    }

    public static async processOAuthCallback(code: string, state: string): Promise<ProviderConfig> {
        return processOAuthCallbackFor(openaiCodexAuthHandler, code, state);
    }

    public static processTokenImport(params: TokenImportParams): ProviderConfig {
        return processTokenImportFor(openaiCodexAuthHandler, params);
    }

    // Antigravity OAuth
    public static initiateAntigravityOAuthPKCE(params: OAuthLoginParams): OAuthLoginResult {
        return initiatePKCEFor(antigravityAuthHandler, params);
    }

    public static async processAntigravityOAuthCallback(
        code: string,
        state: string
    ): Promise<ProviderConfig> {
        return processOAuthCallbackFor(antigravityAuthHandler, code, state);
    }

    public static processAntigravityTokenImport(params: TokenImportParams): ProviderConfig {
        return processTokenImportFor(antigravityAuthHandler, params);
    }

    // CommandCode (API key)
    public static processCommandCodeTokenImport(params: TokenImportParams): ProviderConfig {
        return processTokenImportFor(commandCodeAuthHandler, params);
    }

    // Anthropic (API key)
    public static processAnthropicTokenImport(params: TokenImportParams): ProviderConfig {
        return processTokenImportFor(anthropicAuthHandler, params);
    }

    // Claude Code (OAuth)
    public static initiateClaudeOAuthPKCE(params: OAuthLoginParams): OAuthLoginResult {
        return initiatePKCEFor(claudeAuthHandler, params);
    }

    public static async processClaudeOAuthCallback(
        code: string,
        state: string
    ): Promise<ProviderConfig> {
        return processOAuthCallbackFor(claudeAuthHandler, code, state);
    }

    public static processClaudeTokenImport(params: TokenImportParams): ProviderConfig {
        return processTokenImportFor(claudeAuthHandler, params);
    }

    // GoRouter (API key)
    public static processGoRouterTokenImport(params: TokenImportParams): ProviderConfig {
        return processTokenImportFor(goRouterAuthHandler, params);
    }

    // BluesMinds (API key)
    public static processBluesMindsTokenImport(params: TokenImportParams): ProviderConfig {
        return processTokenImportFor(bluesMindsAuthHandler, params);
    }

    // SeekAI (API key)
    public static processSeekAITokenImport(params: TokenImportParams): ProviderConfig {
        return processTokenImportFor(seekAIAuthHandler, params);
    }

    // TabiToken (API key)
    public static processTabiTokenTokenImport(params: TokenImportParams): ProviderConfig {
        return processTokenImportFor(tabiTokenAuthHandler, params);
    }

    // TokenRouter (API key)
    public static processTokenRouterTokenImport(params: TokenImportParams): ProviderConfig {
        return processTokenImportFor(tokenRouterAuthHandler, params);
    }

    // CodeBuddy (OAuth & token import)
    public static async initiateCodeBuddyOAuth(): Promise<{ authorizeUrl: string; state: string }> {
        cleanupExpiredSessions();
        const codeBuddyOAuth = new CodeBuddyOAuth();
        const { state, authUrl } = await codeBuddyOAuth.requestAuthState();

        saveOAuthSessionDB({
            state,
            codeVerifier: "",
            clientId: "",
            redirectUri: "",
            createdAt: Date.now()
        });

        return {
            authorizeUrl: authUrl,
            state
        };
    }

    public static async pollCodeBuddyDeviceToken(state: string): Promise<{
        status: "pending" | "ok";
        provider?: ProviderConfig;
        error?: string;
    }> {
        if (!state) {
            return { status: "pending", error: "Missing state parameter" };
        }

        const session = getOAuthSessionDB(state);
        if (!session) {
            return { status: "pending", error: "Session expired or not found" };
        }

        const codeBuddyOAuth = new CodeBuddyOAuth();
        let poll: {
            status: "pending" | "ok";
            accessToken?: string;
            refreshToken?: string;
            expiresIn?: number;
            error?: string;
        };

        try {
            poll = await codeBuddyOAuth.pollToken(state);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { status: "pending", error: msg };
        }

        if (poll.status !== "ok" || !poll.accessToken) {
            return { status: "pending", error: poll.error };
        }

        deleteOAuthSessionDB(state);

        const timestamp = Date.now();
        const accountId = `codebuddy_${timestamp}`;
        const accountName = `CodeBuddy (Account #${timestamp.toString().slice(-4)})`;

        const providerConfig = upsertProviderDB({
            id: accountId,
            providerId: "codebuddy",
            name: accountName,
            category: "oauth",
            protocol: "openai",
            baseUrl: CODEBUDDY_BASE_URL,
            accessToken: poll.accessToken,
            refreshToken: poll.refreshToken,
            tokenExpiresAt: poll.expiresIn ? timestamp + poll.expiresIn * 1000 : undefined,
            lastRefreshedAt: timestamp,
            enabled: true,
            createdAt: timestamp
        });

        const providerInstance = new CodeBuddyExecutor({
            id: accountId,
            name: accountName,
            baseUrl: CODEBUDDY_BASE_URL,
            accessToken: poll.accessToken
        });
        registry.registerProvider(providerInstance);

        return {
            status: "ok",
            provider: providerConfig
        };
    }

    public static processCodeBuddyTokenImport(params: TokenImportParams): ProviderConfig {
        return processTokenImportFor(codeBuddyAuthHandler, params);
    }

    // Qoder OAuth & Token Import
    public static initiateQoderOAuthPKCE(params: OAuthLoginParams): OAuthLoginResult {
        return initiatePKCEFor(qoderAuthHandler, params);
    }

    public static async processQoderOAuthCallback(
        code: string,
        state: string
    ): Promise<ProviderConfig> {
        return processOAuthCallbackFor(qoderAuthHandler, code, state);
    }

    public static processQoderTokenImport(params: TokenImportParams): ProviderConfig {
        return processTokenImportFor(qoderAuthHandler, params);
    }

    public static async pollQoderDeviceToken(state: string): Promise<{
        status: "pending" | "ok";
        provider?: ProviderConfig;
        error?: string;
    }> {
        if (!state) {
            return { status: "pending", error: "Missing state parameter" };
        }

        const session = getOAuthSessionDB(state);
        if (!session) {
            return { status: "pending", error: "Session expired or not found" };
        }

        const qoderOAuth = new QoderOAuth();
        let poll: {
            status: "pending" | "ok";
            accessToken?: string;
            refreshToken?: string;
            userId?: string;
            expiresIn?: number;
        };
        try {
            poll = await qoderOAuth.pollDeviceToken({
                nonce: state,
                codeVerifier: session.codeVerifier
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { status: "pending", error: msg };
        }

        if (poll.status !== "ok" || !poll.accessToken) {
            return { status: "pending" };
        }

        deleteOAuthSessionDB(state);

        const userInfo = await qoderOAuth.fetchUserInfo(poll.accessToken);
        const timestamp = Date.now();
        const accountId = `qoder_${timestamp}`;
        const accountName = userInfo.name
            ? `Qoder (${userInfo.name})`
            : `Qoder (Account #${timestamp.toString().slice(-4)})`;

        const providerConfig = upsertProviderDB({
            id: accountId,
            providerId: "qoder",
            name: accountName,
            category: "oauth",
            protocol: "openai",
            accessToken: poll.accessToken,
            refreshToken: poll.refreshToken,
            accountId: poll.userId || userInfo.id,
            tokenExpiresAt: poll.expiresIn ? timestamp + poll.expiresIn * 1000 : undefined,
            lastRefreshedAt: timestamp,
            providerSpecificData: {
                authMethod: "device",
                userId: poll.userId || userInfo.id || "",
                email: userInfo.email || "",
                name: userInfo.name || "",
                organizationId: userInfo.organizationId || ""
            },
            enabled: true,
            createdAt: timestamp
        });

        const providerInstance = new QoderExecutor({
            id: accountId,
            name: accountName,
            accessToken: poll.accessToken,
            refreshToken: poll.refreshToken,
            providerSpecificData: {
                authMethod: "device",
                userId: poll.userId || userInfo.id || "",
                email: userInfo.email || "",
                name: userInfo.name || "",
                organizationId: userInfo.organizationId || ""
            }
        });
        registry.registerProvider(providerInstance);

        return {
            status: "ok",
            provider: providerConfig
        };
    }
}
