import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/providers")({
    staticData: { title: "Providers" },
    component: ProvidersLayout
});

function ProvidersLayout() {
    return <Outlet />;
}
