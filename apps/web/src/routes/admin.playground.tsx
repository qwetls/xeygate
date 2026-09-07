import { createFileRoute } from "@tanstack/react-router";
import { PlaygroundPanel } from "@/components/playground/playground.panel";

export const Route = createFileRoute("/admin/playground")({
    staticData: { title: "Playground" },
    component: () => <PlaygroundPanel variant="admin" />
});