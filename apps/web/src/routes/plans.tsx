import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/plans")({
    beforeLoad: () => {
        throw redirect({ to: "/catalog" });
    },
    component: () => null,
    staticData: { title: "Plans" }
});
