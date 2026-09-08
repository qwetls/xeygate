import type { MiddlewareHandler } from "hono";
import type { MarketplaceScope } from "@/logic/official.logic.js";

/**
 * Pins the marketplace namespace for the request.  /user/v1 resolves only
 * creator-owned listings; /official/v1 resolves only platform-owned ones.
 * Unscoped mounts (/v1) default to "all" in the controllers.
 */
export function MarketplaceScopeMiddleware(
    scope: Exclude<MarketplaceScope, "all">
): MiddlewareHandler {
    return async (c, next) => {
        c.set("marketplaceScope", scope);
        await next();
    };
}
