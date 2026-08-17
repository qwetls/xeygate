import {
    ANTIGRAVITY_BASE_URL,
    ANTIGRAVITY_IDE_BASE_URL,
    ANTIGRAVITY_MODELS
} from "@srouter/constants";
import type {
    AIProvider,
    ChatCompletionChunk,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ModelObject
} from "@srouter/types";
import {
    ANTIGRAVITY_IDE_USER_AGENT,
    accumulateChunks,
    buildAntigravityContents,
    buildAntigravityEnvelope,
    buildAntigravityTools,
    createGeminiStreamState,
    generateProjectId,
    generateSessionId,
    geminiStreamToOpenAIChunks,
    isImageModel,
    parseAntigravityModelName,
    parseImageConfig,
    stripBlacklistedRequest
} from "@srouter/translator";
import { OpenAIExecutor } from "./openai.js";
import { parseDataLine, streamLines } from "./base.js";
import { fetchWithRetry } from "./retry.js";

export interface AntigravityExecutorOptions {
    id?: string;
    name?: string;
    baseUrl?: string;
    apiKey?: string;
    accessToken?: string;
    refreshToken?: string;
    projectId?: string;
}

/**
 * Antigravity Executor — Google Antigravity IDE backend (daily-cloudcode-pa).
 * Ported from 9router open-sse/executors/antigravity.js (envelope + native SSE + retry).
 * Falls back to OpenAI-compatible endpoint for local proxy / AIzaSy API keys.
 */
export class AntigravityExecutor implements AIProvider {
    id: string;
    name: string;
    category = "oauth" as const;
    protocol = "openai" as const;
    private baseUrl: string;
    private apiKey: string;
    private accessToken: string;
    private refreshToken?: string;
    private projectId: string;
    private sessionId: string;
    private openaiFallback: OpenAIExecutor;

    constructor(options: AntigravityExecutorOptions = {}) {
        this.id = options.id ?? "antigravity";
        this.name = options.name ?? "Antigravity Provider";
        this.baseUrl = (options.baseUrl ?? ANTIGRAVITY_IDE_BASE_URL).replace(/\/$/, "");
        this.apiKey = options.apiKey ?? "";
        this.accessToken = options.accessToken ?? "";
        this.refreshToken = options.refreshToken;
        this.projectId = options.projectId ?? generateProjectId();
        this.sessionId = generateSessionId();
        this.openaiFallback = new OpenAIExecutor({
            id: this.id,
            name: this.name,
            baseUrl: options.baseUrl || ANTIGRAVITY_BASE_URL,
            apiKey: options.apiKey,
            accessToken: this.accessToken
        });
    }

    /**
     * Update tokens after a refresh — called by TokenRefreshService.
     */
    updateToken(accessToken: string, refreshToken?: string): void {
        if (accessToken) {
            this.accessToken = accessToken;
            this.openaiFallback.updateToken(accessToken);
        }
        if (refreshToken) this.refreshToken = refreshToken;
    }

    private getHeaders(extra?: Record<string, string>): Record<string, string> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "User-Agent": ANTIGRAVITY_IDE_USER_AGENT
        };
        const token = this.accessToken || this.apiKey;
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
            if (token.startsWith("AIzaSy")) {
                headers["x-goog-api-key"] = token;
            } else if (token.startsWith("ya29.")) {
                headers["x-goog-api-client"] = "gl-node/18.0.0 gd/1.0.0";
            }
        }
        if (extra) {
            Object.assign(headers, extra);
        }
        return headers;
    }

    private isLocalProxy(): boolean {
        return (
            /^https?:\/\/127\.0\.0\.1(:\d+)?(\/|$)/.test(this.baseUrl) ||
            /^https?:\/\/localhost(:\d+)?(\/|$)/.test(this.baseUrl)
        );
    }

    private isApiKey(): boolean {
        const token = this.accessToken || this.apiKey;
        return token.startsWith("AIzaSy");
    }

    private getToken(): string {
        return this.accessToken || this.apiKey;
    }

    async listModels(): Promise<ModelObject[]> {
        const token = this.getToken();
        const isLocalProxy = this.isLocalProxy();
        const isApiKey = this.isApiKey();

        // 1. OpenAI-compatible endpoint (local proxy or AIzaSy key on /openai base)
        if (isLocalProxy || (isApiKey && this.baseUrl.includes("/openai"))) {
            return await this.openaiFallback.listModels();
        }

        // 2. Return the official Antigravity exposed models
        if (token) {
            return ANTIGRAVITY_MODELS.map((m) => ({
                id: m.id,
                object: "model" as const,
                created: Math.floor(Date.now() / 1000),
                owned_by: "antigravity"
            }));
        }

        return [];
    }

    /**
     * Build the Antigravity request envelope + sanitized request body.
     * Port of 9router transformRequest (standard agent request path).
     */
    private buildRequest(
        model: string,
        req: ChatCompletionRequest,
        stream: boolean
    ): { url: string; body: Record<string, unknown> } {
        const cleanBaseUrl = this.baseUrl.replace(/\/openai$/, "");
        const modelName = parseAntigravityModelName(model);

        // Build contents (with tool support)
        const contents = buildAntigravityContents(req);

        // ─── Image generation: different request structure ───
        if (isImageModel(modelName)) {
            const imageConfig = parseImageConfig(modelName);
            const cleanModel = modelName.replace(/-\d+x\d+$/, "");
            const request: Record<string, unknown> = {
                contents,
                generationConfig: {
                    temperature: 1.0,
                    topP: 0.95,
                    topK: 40,
                    maxOutputTokens: 8192,
                    imageConfig
                },
                sessionId: this.sessionId
            };
            const envelope = buildAntigravityEnvelope({
                projectId: this.projectId,
                model: cleanModel,
                requestType: "image_gen",
                request,
                body: req as unknown as { requestId?: string },
                sessionId: this.sessionId
            });
            // Image gen MUST use non-streaming generateContent
            const url = `${cleanBaseUrl}/v1internal:generateContent`;
            return { url, body: envelope };
        }

        // ─── Standard request ───
        const tools = buildAntigravityTools(req);

        const request: Record<string, unknown> = {
            contents,
            sessionId: this.sessionId,
            safetySettings: undefined
        };
        if (tools.length > 0) {
            request.tools = tools;
            request.toolConfig = { functionCallingConfig: { mode: "VALIDATED" } };
        }

        stripBlacklistedRequest(request);

        const envelope = buildAntigravityEnvelope({
            projectId: this.projectId,
            model: modelName,
            requestType: "agent",
            request,
            body: req as unknown as { requestId?: string },
            sessionId: this.sessionId
        });

        const url = stream
            ? `${cleanBaseUrl}/v1internal:streamGenerateContent?alt=sse`
            : `${cleanBaseUrl}/v1internal:generateContent`;

        return { url, body: envelope };
    }

    async chatCompletion(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
        const isLocalProxy = this.isLocalProxy();
        const isApiKey = this.isApiKey();

        // 1. OpenAI-compatible fallback
        if (isLocalProxy || (isApiKey && this.baseUrl.includes("/openai"))) {
            return await this.openaiFallback.chatCompletion(req);
        }

        // 2. Native Antigravity — accumulate stream for non-streaming callers
        const chunks: ChatCompletionChunk[] = [];
        for await (const chunk of this.chatCompletionStream(req)) {
            chunks.push(chunk);
        }
        return accumulateChunks(chunks, req.model);
    }

    async *chatCompletionStream(
        req: ChatCompletionRequest
    ): AsyncGenerator<ChatCompletionChunk, void, void> {
        const isLocalProxy = this.isLocalProxy();
        const isApiKey = this.isApiKey();

        if (isLocalProxy || (isApiKey && this.baseUrl.includes("/openai"))) {
            yield* this.openaiFallback.chatCompletionStream(req);
            return;
        }

        const { url, body } = this.buildRequest(req.model, req, true);
        const streamUrl = url.includes("?") ? url : `${url}?alt=sse`;
        const res = await fetchWithRetry(streamUrl, body, this.getHeaders());

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Antigravity Provider Error (${res.status}): ${errorText}`);
        }

        if (!res.body) {
            throw new Error("No response body received for streaming");
        }

        const state = createGeminiStreamState(req.model);
        for await (const line of streamLines(res.body)) {
            const jsonStr = parseDataLine(line);
            if (jsonStr === null) continue;
            try {
                const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
                const chunks = geminiStreamToOpenAIChunks(parsed, state);
                if (chunks) {
                    for (const chunk of chunks) yield chunk;
                }
            } catch {
                // ignore malformed JSON
            }
        }
    }
}
