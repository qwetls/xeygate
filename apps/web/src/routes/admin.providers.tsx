import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/providers")({
    staticData: { title: "Providers" },
    component: ProvidersLayout
});

function ProvidersLayout() {
    return <Outlet />;
}
