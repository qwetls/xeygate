import type { MiddlewareHandler } from "hono";

/**
 * Placeholder middleware — plan-based access control is disabled while
 * XEYGATE operates as a marketplace (credits-based, not subscription).
 * Kept as an import site so re-enabling later requires only filling the body.
 */
export function EnforcePlanAccess(): MiddlewareHandler {
    return async (_c, next) => {
        await next();
    };
}
