import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";

interface RouterContext {
    queryClient: QueryClient;
}

declare module "@tanstack/react-router" {
    interface StaticDataRouteOption {
        title?: string;
    }
}

export const Route = createRootRouteWithContext<RouterContext>()({
    component: () => (
        <>
            <Outlet />
            <CookieConsentBanner />
        </>
    )
});
