import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";

interface RouterContext {
    queryClient: QueryClient;
}

declare module "@tanstack/react-router" {
    interface StaticDataRouteOption {
        title?: string;
    }
}

export const Route = createRootRouteWithContext<RouterContext>()({
    component: () => <Outlet />
});
