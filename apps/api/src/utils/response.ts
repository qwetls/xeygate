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
}

export interface OpenAIErrorPayload {
    error: {
        message: string;
        type: string;
        code?: string;
        param?: string;
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
            ...(options.param ? { param: options.param } : {})
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
 * — retrying is pointless), an unroutable model is a 404, anything else is a
 * gateway failure.
 */
export function InferenceErrorStatus(error: unknown): ContentfulStatusCode {
    const Carrier = error as { status?: number; statusCode?: number } | null;
    const Explicit = Carrier?.status || Carrier?.statusCode;
    if (typeof Explicit === "number" && Explicit >= 400 && Explicit <= 599) {
        return Explicit as ContentfulStatusCode;
    }
    const Message = error instanceof Error ? error.message : String(error);
    if (/is disabled on this gateway/i.test(Message)) return 400;
    if (/no active provider connection|not found/i.test(Message)) return 404;
    return 500;
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
