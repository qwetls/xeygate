import { Hono } from "hono";
import { AuthController } from "@/controllers/auth.controller.js";
import { adminAuth } from "@/middleware/adminAuth.js";

export const authRoute = new Hono();

export const handleOAuthCallback = AuthController.handleOAuthCallback;
export const handleAntigravityOAuthCallback = AuthController.handleAntigravityOAuthCallback;
export const handleClaudeOAuthCallback = AuthController.handleClaudeOAuthCallback;
export const handleCommandCodeTokenImport = AuthController.importCommandCodeToken;
export const handleCodeBuddyTokenImport = AuthController.importCodeBuddyToken;
export const handleQoderOAuthCallback = AuthController.handleQoderOAuthCallback;

// --- OpenAI OAuth ---
// 1. GET /v1/auth/openai/login - Initiate OAuth PKCE Login Flow
authRoute.get("/auth/openai/login", adminAuth, AuthController.loginOpenAI);

// 2. GET & POST /v1/auth/openai/callback - OAuth Callback Receiver
authRoute.get("/auth/openai/callback", AuthController.handleOAuthCallback);
authRoute.post("/auth/openai/callback", AuthController.handleOAuthCallback);

// 3. POST /v1/auth/openai/token & POST /v1/auth/openai/import-token
authRoute.post("/auth/openai/token", adminAuth, AuthController.importToken);
authRoute.post("/auth/openai/import-token", adminAuth, AuthController.importToken);

// --- Antigravity OAuth ---
// 1. GET /v1/auth/antigravity/login - Initiate Antigravity OAuth PKCE Login Flow
authRoute.get("/auth/antigravity/login", adminAuth, AuthController.loginAntigravity);

// 2. GET & POST /v1/auth/antigravity/callback - Antigravity OAuth Callback Receiver
authRoute.get("/auth/antigravity/callback", AuthController.handleAntigravityOAuthCallback);
authRoute.post("/auth/antigravity/callback", AuthController.handleAntigravityOAuthCallback);

// 3. POST /v1/auth/antigravity/token & POST /v1/auth/antigravity/import-token
authRoute.post("/auth/antigravity/token", adminAuth, AuthController.importAntigravityToken);
authRoute.post("/auth/antigravity/import-token", adminAuth, AuthController.importAntigravityToken);

// --- CommandCode Provider (API key) ---
// 1. POST /v1/auth/commandcode/token & POST /v1/auth/commandcode/import-token
authRoute.post("/auth/commandcode/token", adminAuth, AuthController.importCommandCodeToken);
authRoute.post("/auth/commandcode/import-token", adminAuth, AuthController.importCommandCodeToken);

// --- Anthropic Provider (API key) ---
// 1. POST /v1/auth/anthropic/token & POST /v1/auth/anthropic/import-token
authRoute.post("/auth/anthropic/token", adminAuth, AuthController.importAnthropicToken);
authRoute.post("/auth/anthropic/import-token", adminAuth, AuthController.importAnthropicToken);

// --- Claude Code OAuth ---
// 1. GET /v1/auth/claude/login - Initiate Claude Code OAuth PKCE Login Flow
authRoute.get("/auth/claude/login", adminAuth, AuthController.loginClaude);

// 2. GET & POST /v1/auth/claude/callback - OAuth Callback Receiver
authRoute.get("/auth/claude/callback", AuthController.handleClaudeOAuthCallback);
authRoute.post("/auth/claude/callback", AuthController.handleClaudeOAuthCallback);

// 3. POST /v1/auth/claude/token & POST /v1/auth/claude/import-token
authRoute.post("/auth/claude/token", adminAuth, AuthController.importClaudeToken);
authRoute.post("/auth/claude/import-token", adminAuth, AuthController.importClaudeToken);

// --- GoRouter Provider (API key) ---
// 1. POST /v1/auth/gorouter/token & POST /v1/auth/gorouter/import-token
authRoute.post("/auth/gorouter/token", adminAuth, AuthController.importGoRouterToken);
authRoute.post("/auth/gorouter/import-token", adminAuth, AuthController.importGoRouterToken);

// --- BluesMinds Provider (API key) ---
// 1. POST /v1/auth/bluesminds/token & POST /v1/auth/bluesminds/import-token
authRoute.post("/auth/bluesminds/token", adminAuth, AuthController.importBluesMindsToken);
authRoute.post("/auth/bluesminds/import-token", adminAuth, AuthController.importBluesMindsToken);

// --- SeekAI Provider (API key) ---
// 1. POST /v1/auth/seekai/token & POST /v1/auth/seekai/import-token
authRoute.post("/auth/seekai/token", adminAuth, AuthController.importSeekAIToken);
authRoute.post("/auth/seekai/import-token", adminAuth, AuthController.importSeekAIToken);

// --- TabiToken Provider (API key) ---
// 1. POST /v1/auth/tabitoken/token & POST /v1/auth/tabitoken/import-token
authRoute.post("/auth/tabitoken/token", adminAuth, AuthController.importTabiTokenToken);
authRoute.post("/auth/tabitoken/import-token", adminAuth, AuthController.importTabiTokenToken);

// --- CodeBuddy Provider (API key / token) ---
// 1. POST /v1/auth/codebuddy/token & POST /v1/auth/codebuddy/import-token
authRoute.post("/auth/codebuddy/token", adminAuth, AuthController.importCodeBuddyToken);
authRoute.post("/auth/codebuddy/import-token", adminAuth, AuthController.importCodeBuddyToken);

// --- Qoder Provider (OAuth & PAT) ---
// 1. GET /v1/auth/qoder/login - Initiate Qoder OAuth PKCE Login Flow
authRoute.get("/auth/qoder/login", adminAuth, AuthController.loginQoder);

// 2. GET & POST /v1/auth/qoder/callback - Qoder OAuth Callback Receiver
authRoute.get("/auth/qoder/callback", AuthController.handleQoderOAuthCallback);
authRoute.post("/auth/qoder/callback", AuthController.handleQoderOAuthCallback);

// 3. GET & POST /v1/auth/qoder/poll - Device Flow Poll Receiver
authRoute.get("/auth/qoder/poll", adminAuth, AuthController.pollQoder);
authRoute.post("/auth/qoder/poll", adminAuth, AuthController.pollQoder);

// 4. POST /v1/auth/qoder/token & POST /v1/auth/qoder/import-token
authRoute.post("/auth/qoder/token", adminAuth, AuthController.importQoderToken);
authRoute.post("/auth/qoder/import-token", adminAuth, AuthController.importQoderToken);
