import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsSkeleton } from "@/components/skeletons";
import {
    AnalyticsHeader,
    AnalyticsStatCards,
    TrafficChart,
    LatencyChart,
    TokenUsageChart,
    BreakdownTabsCard
} from "@/components/analytics";
import type { AnalyticsWindow } from "@srouter/types";
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";

export const Route = createFileRoute("/_admin/analytics")({
    staticData: { title: "Analytics" },
    component: AnalyticsPage
});

function AnalyticsPage() {
    const [window, setWindow] = useState<AnalyticsWindow>("24h");
    const { data, isLoading, isPlaceholderData, error } = useAnalytics(window);

    if (isLoading && !data) {
        return <AnalyticsSkeleton />;
    }

    if (error || !data) {
        return (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive font-mono">
                Failed to load analytics: {error instanceof Error ? error.message : "Unknown error"}
            </div>
        );
    }

    const hasData = data.totalRequests > 0;

    return (
        <div
            className={`flex flex-col gap-6 font-mono transition-opacity duration-200 ${isPlaceholderData ? "opacity-60" : "opacity-100"}`}
        >
            <AnalyticsHeader
                window={window}
                onWindowChange={setWindow}
                lastUpdated={data.generatedAt}
            />

            <AnalyticsStatCards
                requestsPerSecond={data.requestsPerSecond}
                totalRequests={data.totalRequests}
                errorRate={data.errorRate}
                p95LatencyMs={data.p95LatencyMs}
            />

            {!hasData ? (
                <Empty className="p-12">
                    <EmptyTitle>No requests in this window.</EmptyTitle>
                </Empty>
            ) : (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <TrafficChart buckets={data.buckets} bucketSizeMs={data.bucketSizeMs} />
                        <LatencyChart buckets={data.buckets} />
                    </div>
                    <TokenUsageChart buckets={data.buckets} bucketSizeMs={data.bucketSizeMs} />
                    <BreakdownTabsCard
                        models={data.topModels}
                        agents={data.topAgents}
                        providers={data.providers}
                        totalRequests={data.totalRequests}
                    />
                </>
            )}
        </div>
    );
}
