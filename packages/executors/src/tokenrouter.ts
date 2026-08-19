import { TOKENROUTER_BASE_URL } from "@srouter/constants";
import { OpenAIExecutor, type OpenAIExecutorOptions } from "./openai.js";

export interface TokenRouterExecutorOptions extends OpenAIExecutorOptions {}

export class TokenRouterExecutor extends OpenAIExecutor {
    constructor(options: TokenRouterExecutorOptions = {}) {
        super({
            id: options.id ?? "tokenrouter",
            name: options.name ?? "TokenRouter",
            baseUrl: options.baseUrl ?? TOKENROUTER_BASE_URL,
            apiKey: options.apiKey,
            accessToken: options.accessToken
        });
    }
}
