import { randomBytes } from "node:crypto";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export const ErrorType = {
    INVALID_REQUEST: "invalid_request_error",
    AUTHENTICATION: "authentication_error",
    PERMISSION: "permission_error",
    RATE_LIMIT: "rate_limit_error",
    API_ERROR: "api_error"
} as const;

export type ErrorType = (typeof ErrorType)[keyof typeof ErrorType];

const STATUS_TO_ERROR_TYPE: Record<number, ErrorType> = {
    400: ErrorType.INVALID_REQUEST,
    404: ErrorType.INVALID_REQUEST,
    409: ErrorType.INVALID_REQUEST,
    422: ErrorType.INVALID_REQUEST,
    401: ErrorType.AUTHENTICATION,
    403: ErrorType.PERMISSION,
    429: ErrorType.RATE_LIMIT
};

export function GetErrorTypeFromStatus(status: number): ErrorType {
    return STATUS_TO_ERROR_TYPE[status] ?? ErrorType.API_ERROR;
}

export interface ErrorResponseOptions {
    type?: ErrorType | string;
    code?: string;
    param?: string;
    request_id?: string;
}

export interface OpenAIErrorPayload {
    error: {
        message: string;
        type: string;
        code?: string;
        param?: string;
        request_id?: string;
    };
}

export function FormatErrorPayload(
    message: string,
    status: number = 500,
    options: ErrorResponseOptions = {}
): OpenAIErrorPayload {
    return {
        error: {
            message,
            type: options.type ?? GetErrorTypeFromStatus(status),
            ...(options.code ? { code: options.code } : {}),
            ...(options.param ? { param: options.param } : {}),
            ...(options.request_id ? { request_id: options.request_id } : {})
        }
    };
}

export const formatErrorPayload = FormatErrorPayload;

export function Ok<T>(c: Context, data: T, status: ContentfulStatusCode = 200): Response {
    return c.json(data, status);
}

export const ok = Ok;

export function Err(
    c: Context,
    message: string,
    status: ContentfulStatusCode = 500,
    options: ErrorResponseOptions = {}
): Response {
    return c.json(FormatErrorPayload(message, status, options), status);
}

export interface AnthropicErrorPayload {
    type: "error";
    error: {
        type: string;
        message: string;
    };
}

export function ToContentfulStatusCode(status?: number): ContentfulStatusCode {
    if (typeof status === "number" && status >= 400 && status <= 599) {
        return status as ContentfulStatusCode;
    }
    return 500;
}

/**
 * HTTP status for an inference failure raised below the controller layer.
 * Registry/provider errors arrive as plain Errors, so the message is the only
 * carrier of intent: an admin's disable veto is a definitive client error (400
 * — retrying is pointless), an unroutable model is a 404, and an upstream
 * rejection carries its own status inside the executor's framing
 * ("... Provider Error (429): ..."), which is more trustworthy than the loose
 * text heuristics below it.
 */
export function InferenceErrorStatus(error: unknown): ContentfulStatusCode {
    const Carrier = error as { status?: number; statusCode?: number } | null;
    const Explicit = Carrier?.status || Carrier?.statusCode;
    if (typeof Explicit === "number" && Explicit >= 400 && Explicit <= 599) {
        return Explicit as ContentfulStatusCode;
    }
    const Message = error instanceof Error ? error.message : String(error);
    if (/is disabled on this gateway/i.test(Message)) return 400;
    if (/no active provider connection/i.test(Message)) return 404;

    // Every executor frames upstream failures as "Provider Error (NNN)",
    // "Provider Stream Error (NNN)" or "Provider Image Error (NNN)".
    const Upstream = /Provider (?:Stream |Image )?Error \((\d{3})\)/.exec(Message);
    if (Upstream) {
        const Code = Number(Upstream[1]);
        if (Code >= 400 && Code <= 599) return Code as ContentfulStatusCode;
    }

    if (/not found/i.test(Message)) return 404;
    return 500;
}

// ── Upstream error sanitization ─────────────────────────────────────────
// Provider failures bubble up as plain Errors carrying the raw upstream body
// ("[OI] Provider Error (402): {insufficient_quota: ...}"). That is fine for a
// gateway operator and wrong for a buyer: it exposes the supply chain, leaks
// account state, and tells the client nothing actionable. Callers surface the
// message below instead and correlate with `traceId`, which is logged together
// with the real error server-side.

/** Short, unambiguous correlation id — "xg-1f2e3d4c". */
export function NewTraceId(): string {
    return `xg-${randomBytes(4).toString("hex")}`;
}

/**
 * Correlation id for the request in flight, created on first use and reused
 * afterwards so the response header and the error body always agree.
 */
export function EnsureRequestId(c: Context): string {
    const existing = c.get("requestId") as string | undefined;
    if (existing) return existing;
    const id = NewTraceId();
    c.set("requestId", id);
    c.header("X-Request-Id", id);
    return id;
}

/**
 * Record the real failure against its trace id. Without this the client-facing
 * message is the only surviving evidence and debugging becomes guesswork.
 */
export function LogUpstreamFailure(traceId: string, error: unknown, status: number): void {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error(`🔥 [${traceId}] upstream failure (status ${status}): ${message}`);
    if (stack) console.error(`🔥 [${traceId}] stack: ${stack}`);
}

/**
 * Client-facing shape of an inference failure. `ModelDisabledError` and the
 * unroutable-model errors are authored by this gateway, so they stay verbatim:
 * they name no provider, leak no upstream detail, and the client can act on
 * them. Everything else is replaced with a generic sentence plus the trace id.
 */
export function PublicInferenceError(error: unknown): {
    message: string;
    status: ContentfulStatusCode;
    traceId: string;
} {
    const status = InferenceErrorStatus(error);
    const traceId = NewTraceId();
    const Raw = error instanceof Error ? error.message : String(error);
    const GatewayAuthored =
        /is disabled on this gateway/i.test(Raw) || /no active provider connection/i.test(Raw);

    if (GatewayAuthored) {
        return { message: Raw, status, traceId };
    }

    let message: string;
    if (status === 404) {
        message = "Model is not available right now.";
    } else if (status === 429) {
        message = "The upstream provider is at capacity. Please retry in a moment.";
    } else if (status === 402) {
        message = "This model is temporarily unavailable.";
    } else if (status === 408 || status === 504) {
        message = "The upstream provider timed out. Please retry.";
    } else if (status === 400 || status === 422) {
        message = "The request was rejected by the upstream provider.";
    } else {
        message = "The request could not be completed. Please try again.";
    }

    return { message: `${message} (ref: ${traceId})`, status, traceId };
}

export function FormatAnthropicErrorPayload(
    message: string,
    status: number = 500,
    type?: string
): AnthropicErrorPayload {
    return {
        type: "error",
        error: {
            type: type ?? GetErrorTypeFromStatus(status),
            message
        }
    };
}

export const err = Err;

export function AnthropicErr(
    c: Context,
    message: string,
    status: ContentfulStatusCode = 500,
    type?: string
): Response {
    return c.json(FormatAnthropicErrorPayload(message, status, type), status);
}
