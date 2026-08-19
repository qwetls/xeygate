import {
    ANTIGRAVITY_IDE_BASE_URL,
    ANTIGRAVITY_OAUTH_CLIENT_ID,
    ANTIGRAVITY_OAUTH_REDIRECT_URI,
    ANTHROPIC_BASE_URL,
    BLUESMINDS_BASE_URL,
    CODEBUDDY_BASE_URL,
    CODEX_OAUTH_CLIENT_ID,
    CODEX_OAUTH_REDIRECT_URI,
    COMMANDCODE_BASE_URL,
    GOROUTER_BASE_URL,
    SEEKAI_BASE_URL,
    TABITOKEN_BASE_URL
} from "@srouter/constants";
import {
    AntigravityExecutor,
    AnthropicExecutor,
    BluesMindsExecutor,
    CodeBuddyExecutor,
    CodexExecutor,
    CommandCodeExecutor,
    GoRouterExecutor,
    QoderExecutor,
    SeekAIExecutor,
    TabiTokenExecutor
} from "@srouter/executors";
import {
    AntigravityOAuth,
    ClaudeOAuth,
    CodeBuddyOAuth,
    OpenAICodexOAuth,
    QoderOAuth
} from "@srouter/providers";
import type { AIProvider, ProviderCategory, ProviderProtocol } from "@srouter/types";

export interface OAuthLoginParams {
    clientId?: string;
    redirectUri?: string;
    prompt?: string;
}

export interface OAuthLoginResult {
    authorizeUrl: string;
    state: string;
    codeVerifier: string;
    redirectUri: string;
}

export interface TokenImportParams {
    id?: string;
    accessToken: string;
    refreshToken?: string;
    accountId?: string;
    baseUrl?: string;
    name?: string;
}

/**
 * A raw OAuth token response as returned by a provider's `exchangeCodeForTokens`.
 * Kept structurally compatible with @srouter/providers' OAuthTokenResponse.
 */
export interface OAuthTokens {
    accessToken: string;
    refreshToken?: string;
    accountId?: string;
    organizationId?: string;
    expiresIn?: number;
}

/**
 * Builds a concrete executor from normalized token data.
 * Each provider's constructor differs (Codex needs accountId, api-key providers need apiKey + baseUrl), so
 * the factory lives per handler.
 */
export type ExecutorFactory = (args: {
    id: string;
    name: string;
    accountId?: string;
    organizationId?: string;
    baseUrl?: string;
    apiKey?: string;
    accessToken?: string;
    refreshToken?: string;
}) => AIProvider;

/**
 * An OAuth (PKCE) client class usable for login/callback/token-refresh.
 */
export interface OAuthClientClass {
    new (options?: { clientId?: string; redirectUri?: string; prompt?: string }): {
        getAuthorizationUrl(pkce: { codeChallenge: string; state: string }): string;
        exchangeCodeForTokens(code: string, codeVerifier: string): Promise<OAuthTokens>;
        refreshTokens(refreshToken: string): Promise<OAuthTokens>;
    };
}

/**
 * Normalizes a raw token import payload into the DB/executor field placements for a provider.
 * api-key providers place the token in `apiKey`; OAuth providers place it in `accessToken`.
 */
export interface ImportTokenMapping {
    accessToken?: string;
    refreshToken?: string;
    accountId?: string;
    organizationId?: string;
    baseUrl?: string;
    apiKey?: string;
}

export interface AuthProviderHandler {
    providerId: string;
    displayName: string;
    category: ProviderCategory;
    protocol: ProviderProtocol;
    /** Prefix for generated account ids (`${idPrefix}_${Date.now()}`). */
    idPrefix: string;
    /** Resolve the OAuth client id at call time (env-first, matching today's behavior). */
    clientId?: () => string | undefined;
    defaultRedirectUri?: string;
    /** Resolve the base URL at call time (env-first). OAuth callback uses this for saved providers. */
    baseUrl?: () => string | undefined;
    /** Message returned on successful OAuth login (preserved verbatim). */
    oauthSuccessMessage: string;
    /** Message returned on successful token import (preserved verbatim). */
    tokenImportMessage: string;
    /** Maps raw OAuth tokens to the fields a provider stores/executes with. */
    mapOAuthTokens?: (tokens: OAuthTokens) => {
        accessToken: string;
        refreshToken?: string;
        accountId?: string;
        organizationId?: string;
        expiresIn?: number;
        baseUrl?: string;
    };
    /** Maps a token-import payload to DB/executor field placements. */
    mapImportTokens?: (params: TokenImportParams) => ImportTokenMapping;
    buildExecutor: ExecutorFactory;
    /** Present only for OAuth-backed providers. */
    oauthClass?: OAuthClientClass;
}

export const openaiCodexAuthHandler: AuthProviderHandler = {
    providerId: "openai_codex",
    displayName: "OpenAI Codex",
    category: "oauth",
    protocol: "openai",
    idPrefix: "openai_codex",
    // Matches the original logic: Codex client id is hardcoded (the env var is only read by the OAuth class itself).
    clientId: () => CODEX_OAUTH_CLIENT_ID,
    defaultRedirectUri: CODEX_OAUTH_REDIRECT_URI,
    oauthSuccessMessage: "Login OpenAI Codex Berhasil!",
    tokenImportMessage:
        "OpenAI Codex Access Token registered and saved directly to SQLite database!",
    oauthClass: OpenAICodexOAuth,
    mapOAuthTokens: (tokens) => ({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accountId: tokens.accountId,
        expiresIn: tokens.expiresIn
    }),
    mapImportTokens: (params) => ({
        accessToken: params.accessToken,
        refreshToken: params.refreshToken,
        accountId: params.accountId
    }),
    buildExecutor: ({ id, name, accessToken, refreshToken, accountId }) =>
        new CodexExecutor({ id, name, accessToken, refreshToken, accountId })
};

export const antigravityAuthHandler: AuthProviderHandler = {
    providerId: "antigravity",
    displayName: "Antigravity",
    category: "oauth",
    protocol: "openai",
    idPrefix: "antigravity",
    clientId: () => ANTIGRAVITY_OAUTH_CLIENT_ID,
    defaultRedirectUri: ANTIGRAVITY_OAUTH_REDIRECT_URI,
    baseUrl: () => ANTIGRAVITY_IDE_BASE_URL,
    oauthSuccessMessage: "Login Antigravity OAuth Berhasil!",
    tokenImportMessage:
        "Antigravity Access Token registered and saved directly to SQLite database!",
    oauthClass: AntigravityOAuth,
    mapOAuthTokens: (tokens) => ({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn
    }),
    mapImportTokens: (params) => ({
        accessToken: params.accessToken,
        refreshToken: params.refreshToken,
        baseUrl: params.baseUrl
    }),
    buildExecutor: ({ id, name, baseUrl, accessToken, refreshToken }) =>
        new AntigravityExecutor({ id, name, baseUrl, accessToken, refreshToken })
};

export const commandCodeAuthHandler: AuthProviderHandler = {
    providerId: "commandcode",
    displayName: "Command Code",
    category: "api_key",
    protocol: "openai",
    idPrefix: "commandcode",
    baseUrl: () => COMMANDCODE_BASE_URL,
    oauthSuccessMessage: "",
    tokenImportMessage: "Command Code API Key registered and saved directly to SQLite database!",
    mapImportTokens: (params) => ({
        apiKey: params.accessToken,
        refreshToken: params.refreshToken,
        baseUrl: params.baseUrl
    }),
    buildExecutor: ({ id, name, baseUrl, apiKey }) =>
        new CommandCodeExecutor({ id, name, baseUrl, apiKey })
};

export const anthropicAuthHandler: AuthProviderHandler = {
    providerId: "anthropic",
    displayName: "Anthropic",
    category: "api_key",
    protocol: "anthropic",
    idPrefix: "anthropic",
    baseUrl: () => ANTHROPIC_BASE_URL,
    oauthSuccessMessage: "",
    tokenImportMessage: "Anthropic API Key registered and saved directly to SQLite database!",
    mapImportTokens: (params) => ({
        apiKey: params.accessToken,
        refreshToken: params.refreshToken,
        baseUrl: params.baseUrl
    }),
    buildExecutor: ({ id, name, baseUrl, apiKey }) =>
        new AnthropicExecutor({ id, name, baseUrl, apiKey })
};

export const claudeAuthHandler: AuthProviderHandler = {
    providerId: "claude",
    displayName: "Claude Code",
    category: "oauth",
    protocol: "anthropic",
    idPrefix: "claude",
    clientId: () => process.env.CLAUDE_OAUTH_CLIENT_ID || "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
    defaultRedirectUri: "http://localhost:1455/auth/claude/callback",
    oauthSuccessMessage: "Login Claude Code OAuth Berhasil!",
    tokenImportMessage: "Claude Code OAuth token registered and saved directly to SQLite database!",
    oauthClass: ClaudeOAuth,
    mapOAuthTokens: (tokens) => ({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        organizationId: tokens.organizationId,
        expiresIn: tokens.expiresIn
    }),
    mapImportTokens: (params) => ({
        accessToken: params.accessToken,
        refreshToken: params.refreshToken
    }),
    buildExecutor: ({ id, name, accessToken, refreshToken, organizationId }) =>
        new AnthropicExecutor({ id, name, accessToken, refreshToken, organizationId })
};

export const qoderAuthHandler: AuthProviderHandler = {
    providerId: "qoder",
    displayName: "Qoder",
    category: "oauth",
    protocol: "openai",
    idPrefix: "qoder",
    oauthSuccessMessage: "Login Qoder Berhasil!",
    tokenImportMessage:
        "Qoder Access Token / PAT registered and saved directly to SQLite database!",
    oauthClass: QoderOAuth,
    mapOAuthTokens: (tokens) => ({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accountId: tokens.accountId,
        expiresIn: tokens.expiresIn
    }),
    mapImportTokens: (params) => ({
        accessToken: params.accessToken,
        refreshToken: params.refreshToken,
        accountId: params.accountId,
        baseUrl: params.baseUrl
    }),
    buildExecutor: ({ id, name, baseUrl, apiKey, accessToken, refreshToken }) =>
        new QoderExecutor({ id, name, baseUrl, apiKey, accessToken, refreshToken })
};

export const goRouterAuthHandler: AuthProviderHandler = {
    providerId: "gorouter",
    displayName: "GoRouter",
    category: "api_key",
    protocol: "openai",
    idPrefix: "gorouter",
    baseUrl: () => GOROUTER_BASE_URL,
    oauthSuccessMessage: "",
    tokenImportMessage: "GoRouter API Key registered and saved directly to SQLite database!",
    mapImportTokens: (params) => ({
        apiKey: params.accessToken,
        refreshToken: params.refreshToken,
        baseUrl: params.baseUrl
    }),
    buildExecutor: ({ id, name, baseUrl, apiKey }) =>
        new GoRouterExecutor({ id, name, baseUrl: baseUrl || GOROUTER_BASE_URL, apiKey })
};

export const bluesMindsAuthHandler: AuthProviderHandler = {
    providerId: "bluesminds",
    displayName: "BluesMinds",
    category: "api_key",
    protocol: "openai",
    idPrefix: "bluesminds",
    baseUrl: () => BLUESMINDS_BASE_URL,
    oauthSuccessMessage: "",
    tokenImportMessage: "BluesMinds API Key registered and saved directly to SQLite database!",
    mapImportTokens: (params) => ({
        apiKey: params.accessToken,
        refreshToken: params.refreshToken,
        baseUrl: params.baseUrl
    }),
    buildExecutor: ({ id, name, baseUrl, apiKey }) =>
        new BluesMindsExecutor({ id, name, baseUrl: baseUrl || BLUESMINDS_BASE_URL, apiKey })
};

export const seekAIAuthHandler: AuthProviderHandler = {
    providerId: "seekai",
    displayName: "SeekAI",
    category: "api_key",
    protocol: "openai",
    idPrefix: "seekai",
    baseUrl: () => SEEKAI_BASE_URL,
    oauthSuccessMessage: "",
    tokenImportMessage: "SeekAI API Key registered and saved directly to SQLite database!",
    mapImportTokens: (params) => ({
        apiKey: params.accessToken,
        refreshToken: params.refreshToken,
        baseUrl: params.baseUrl
    }),
    buildExecutor: ({ id, name, baseUrl, apiKey }) =>
        new SeekAIExecutor({ id, name, baseUrl: baseUrl || SEEKAI_BASE_URL, apiKey })
};

export const tabiTokenAuthHandler: AuthProviderHandler = {
    providerId: "tabitoken",
    displayName: "TabiToken",
    category: "api_key",
    protocol: "openai",
    idPrefix: "tabitoken",
    baseUrl: () => TABITOKEN_BASE_URL,
    oauthSuccessMessage: "",
    tokenImportMessage: "TabiToken API Key registered and saved directly to SQLite database!",
    mapImportTokens: (params) => ({
        apiKey: params.accessToken,
        refreshToken: params.refreshToken,
        baseUrl: params.baseUrl
    }),
    buildExecutor: ({ id, name, baseUrl, apiKey }) =>
        new TabiTokenExecutor({ id, name, baseUrl: baseUrl || TABITOKEN_BASE_URL, apiKey })
};

export const codeBuddyAuthHandler: AuthProviderHandler = {
    providerId: "codebuddy",
    displayName: "CodeBuddy",
    category: "oauth",
    protocol: "openai",
    idPrefix: "codebuddy",
    baseUrl: () => CODEBUDDY_BASE_URL,
    oauthSuccessMessage: "Login CodeBuddy Berhasil!",
    tokenImportMessage: "CodeBuddy Access Token registered and saved directly to SQLite database!",
    oauthClass: CodeBuddyOAuth,
    mapOAuthTokens: (tokens) => ({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn
    }),
    mapImportTokens: (params) => ({
        accessToken: params.accessToken,
        refreshToken: params.refreshToken,
        baseUrl: params.baseUrl
    }),
    buildExecutor: ({ id, name, baseUrl, accessToken, apiKey }) =>
        new CodeBuddyExecutor({
            id,
            name,
            baseUrl: baseUrl || CODEBUDDY_BASE_URL,
            accessToken: accessToken || apiKey
        })
};

export const authProviderHandlers: Record<string, AuthProviderHandler> = {
    openai_codex: openaiCodexAuthHandler,
    antigravity: antigravityAuthHandler,
    commandcode: commandCodeAuthHandler,
    anthropic: anthropicAuthHandler,
    claude: claudeAuthHandler,
    qoder: qoderAuthHandler,
    gorouter: goRouterAuthHandler,
    bluesminds: bluesMindsAuthHandler,
    seekai: seekAIAuthHandler,
    tabitoken: tabiTokenAuthHandler,
    codebuddy: codeBuddyAuthHandler
};
