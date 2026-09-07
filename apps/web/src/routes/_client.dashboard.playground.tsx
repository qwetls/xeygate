import { createFileRoute } from "@tanstack/react-router";
import { PlaygroundPanel } from "@/components/playground/playground.panel";

export const Route = createFileRoute("/_client/dashboard/playground")({
    staticData: { title: "Playground" },
    component: PlaygroundPanel
});
