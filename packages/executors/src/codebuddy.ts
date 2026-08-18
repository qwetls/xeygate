import { CODEBUDDY_BASE_URL, CODEBUDDY_MODELS } from "@srouter/constants";
import { accumulateChunks } from "@srouter/translator";
import type {
    AIProvider,
    ChatCompletionChunk,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ModelObject
} from "@srouter/types";
import { parseDataLine, streamLines } from "./base.js";

function stripProviderPrefix(model: string): string {
    const slash = model.indexOf("/");
    return slash >= 0 ? model.slice(slash + 1) : model;
}

export interface CodeBuddyExecutorOptions {
    id?: string;
    name?: string;
    baseUrl?: string;
    apiKey?: string;
    accessToken?: string;
}

export class CodeBuddyExecutor implements AIProvider {
    id: string;
    name: string;
    private baseUrl: string;
    private apiKey: string;
    private accessToken: string;

    constructor(options: CodeBuddyExecutorOptions = {}) {
        this.id = options.id ?? "codebuddy";
        this.name = options.name ?? "CodeBuddy Provider";
        this.baseUrl = (options.baseUrl ?? CODEBUDDY_BASE_URL).replace(/\/$/, "");
        this.apiKey = options.apiKey ?? "";
        this.accessToken = options.accessToken ?? "";
    }

    updateToken(accessToken: string): void {
        if (accessToken) this.accessToken = accessToken;
    }

    private getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "User-Agent": "IDE/2.108.1 CodeBuddy/2.108.1",
            "X-Product": "SaaS",
            "X-IDE-Type": "IDE",
            "X-IDE-Name": "IDE",
            "x-requested-with": "XMLHttpRequest",
            "x-codebuddy-request": "1"
        };
        const token = this.accessToken || this.apiKey;
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }
        return headers;
    }

    private getChatUrl(): string {
        if (this.baseUrl.endsWith("/chat/completions")) {
            return this.baseUrl;
        }
        if (this.baseUrl.endsWith("/v2")) {
            return `${this.baseUrl}/chat/completions`;
        }
        return `${this.baseUrl}/v2/chat/completions`;
    }

    private transformRequestBody(req: ChatCompletionRequest): Record<string, unknown> {
        const targetModel = stripProviderPrefix(req.model);
        const transformed: Record<string, unknown> = {
            ...req,
            model: targetModel,
            stream: true // CodeBuddy requires stream: true
        };

        // Handle reasoning effort
        const eff = (req as unknown as { reasoning_effort?: unknown }).reasoning_effort;
        if (eff === "none" || eff === "off") {
            delete transformed.reasoning_effort;
        } else if (eff) {
            transformed.reasoning_summary = "auto";
        }

        // CodeBuddy requires a leading system prompt and typed blocks for user content
        const source = Array.isArray(req.messages) ? req.messages : [];
        const messages: unknown[] = [{ role: "system", content: "You are CodeBuddy Code." }];

        for (const message of source) {
            if (
                !message ||
                typeof message !== "object" ||
                ["system", "developer"].includes((message as { role?: string }).role ?? "")
            ) {
                continue;
            }
            if (
                (message as { role?: string }).role === "user" &&
                typeof (message as { content?: unknown }).content === "string"
            ) {
                messages.push({
                    ...message,
                    content: [{ type: "text", text: (message as { content: string }).content }]
                });
            } else {
                messages.push({ ...message });
            }
        }

        transformed.messages = messages;
        return transformed;
    }

    async listModels(): Promise<ModelObject[]> {
        const baseId = this.id.split("_")[0]?.split("-")[0] ?? this.id;
        return CODEBUDDY_MODELS.map((m) => ({
            id: `${baseId}/${m.id}`,
            object: "model",
            owned_by: baseId
        }));
    }

    async chatCompletion(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
        // CodeBuddy upstream is stream-only (forceStream). Run the stream and
        // accumulate the final response for non-streaming callers.
        const chunks: ChatCompletionChunk[] = [];
        for await (const chunk of this.chatCompletionStream(req)) {
            chunks.push(chunk);
        }
        return accumulateChunks(chunks, req.model);
    }

    async *chatCompletionStream(
        req: ChatCompletionRequest
    ): AsyncGenerator<ChatCompletionChunk, void, void> {
        const body = this.transformRequestBody(req);
        const res = await fetch(this.getChatUrl(), {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`CodeBuddy Provider Error (${res.status}): ${errorText}`);
        }

        if (!res.body) {
            throw new Error("No response body received for streaming");
        }

        for await (const line of streamLines(res.body)) {
            const jsonStr = parseDataLine(line);
            if (jsonStr === null) continue;
            try {
                const parsed = JSON.parse(jsonStr) as ChatCompletionChunk;
                yield parsed;
            } catch {
                // ignore malformed chunk
            }
        }
    }
}
