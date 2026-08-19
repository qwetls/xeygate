import {
    CODEBUDDY_AUTH_PLATFORM,
    CODEBUDDY_AUTH_REFRESH_URL,
    CODEBUDDY_AUTH_STATE_URL,
    CODEBUDDY_AUTH_TOKEN_URL,
    CODEBUDDY_AUTH_USER_AGENT
} from "@srouter/constants";
import type { OAuthTokenResponse } from "./base.js";

export interface CodeBuddyOAuthOptions {
    stateUrl?: string;
    tokenUrl?: string;
    refreshUrl?: string;
    platform?: string;
    userAgent?: string;
}

export class CodeBuddyOAuth {
    private stateUrl: string;
    private tokenUrl: string;
    private refreshUrl: string;
    private platform: string;
    private userAgent: string;

    constructor(options: CodeBuddyOAuthOptions = {}) {
        this.stateUrl = options.stateUrl ?? CODEBUDDY_AUTH_STATE_URL;
        this.tokenUrl = options.tokenUrl ?? CODEBUDDY_AUTH_TOKEN_URL;
        this.refreshUrl = options.refreshUrl ?? CODEBUDDY_AUTH_REFRESH_URL;
        this.platform = options.platform ?? CODEBUDDY_AUTH_PLATFORM;
        this.userAgent = options.userAgent ?? CODEBUDDY_AUTH_USER_AGENT;
    }

    async requestAuthState(): Promise<{ state: string; authUrl: string }> {
        const url = `${this.stateUrl}?platform=${encodeURIComponent(this.platform)}`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                "User-Agent": this.userAgent,
                "X-Requested-With": "XMLHttpRequest",
                "X-Domain": "www.codebuddy.ai",
                "X-No-Authorization": "true",
                "X-No-User-Id": "true",
                "X-Product": "SaaS"
            },
            body: "{}"
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`CodeBuddy state request failed (${response.status}): ${text}`);
        }

        const data = (await response.json()) as {
            code?: number;
            msg?: string;
            data?: { state?: string; authUrl?: string };
        };

        if (data.code !== 0 || !data.data?.state || !data.data?.authUrl) {
            throw new Error(`CodeBuddy state error: ${data.msg || "missing state/authUrl"}`);
        }

        return {
            state: data.data.state,
            authUrl: data.data.authUrl
        };
    }

    async pollToken(state: string): Promise<{
        status: "pending" | "ok";
        accessToken?: string;
        refreshToken?: string;
        expiresIn?: number;
        error?: string;
    }> {
        const url = `${this.tokenUrl}?state=${encodeURIComponent(state)}`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                Accept: "application/json",
                "User-Agent": this.userAgent,
                "X-Requested-With": "XMLHttpRequest",
                "X-Domain": "www.codebuddy.ai",
                "X-No-Authorization": "true",
                "X-No-User-Id": "true",
                "X-No-Enterprise-Id": "true",
                "X-No-Department-Info": "true",
                "X-Product": "SaaS"
            }
        });

        if (response.status === 202 || response.status === 404) {
            return { status: "pending" };
        }

        if (!response.ok) {
            return { status: "pending", error: `Request failed (${response.status})` };
        }

        const data = (await response.json()) as {
            code?: number;
            msg?: string;
            data?: {
                accessToken?: string;
                refreshToken?: string;
                tokenType?: string;
                expiresIn?: number;
            };
        };

        if (data.code === 0 && data.data?.accessToken) {
            return {
                status: "ok",
                accessToken: data.data.accessToken,
                refreshToken: data.data.refreshToken || "",
                expiresIn: data.data.expiresIn || 86400
            };
        }

        if (data.code === 11217) {
            return { status: "pending" };
        }

        return { status: "pending", error: data.msg || "unknown_error" };
    }

    async exchangeCodeForTokens(code: string, _codeVerifier?: string): Promise<OAuthTokenResponse> {
        const poll = await this.pollToken(code);
        if (poll.status !== "ok" || !poll.accessToken) {
            throw new Error(poll.error || "CodeBuddy authorization is still pending or was denied");
        }

        return {
            accessToken: poll.accessToken,
            refreshToken: poll.refreshToken,
            expiresIn: poll.expiresIn,
            tokenType: "Bearer"
        };
    }

    async refreshTokens(refreshToken: string): Promise<OAuthTokenResponse> {
        try {
            const response = await fetch(this.refreshUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    "User-Agent": this.userAgent,
                    "X-Requested-With": "XMLHttpRequest",
                    "X-Domain": "www.codebuddy.ai",
                    "X-Product": "SaaS"
                },
                body: JSON.stringify({ refreshToken })
            });

            if (response.ok) {
                const data = (await response.json()) as {
                    code?: number;
                    data?: { accessToken?: string; refreshToken?: string; expiresIn?: number };
                };
                if (data.code === 0 && data.data?.accessToken) {
                    return {
                        accessToken: data.data.accessToken,
                        refreshToken: data.data.refreshToken || refreshToken,
                        expiresIn: data.data.expiresIn || 86400,
                        tokenType: "Bearer"
                    };
                }
            }
        } catch {
            // fallback to preserving refreshToken
        }

        return {
            accessToken: refreshToken,
            refreshToken,
            tokenType: "Bearer"
        };
    }
}
