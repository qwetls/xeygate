import type { ComponentType } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
    Activity,
    Boxes,
    Coins,
    CircleDollarSign,
    RefreshCw,
    Store,
    TriangleAlert,
    UserCheck,
    Users
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCompactNumber } from "@/lib/utils";
import type { UsageStats } from "@srouter/types";
import { GatewayTopologyMap, ModelUsageOverview, NetworkStatus, UsageByModelTable } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/skeletons";

export const Route = createFileRoute("/admin/")({
    staticData: { title: "Dashboard" },
    component: DashboardPage
});

type StatCardProps = {
    label: string;
    value: string;
    detail: string;
    icon: ComponentType<{ className?: string; strokeWidth?: number }>;
    tooltip?: string;
    subValue?: string;
};

function StatCard({ label, value, detail, icon: Icon, tooltip, subValue }: StatCardProps) {
    return (
        <article className="relative flex flex-col justify-between rounded-xl border border-border/80 bg-card/60 p-4 transition-all duration-150 hover:border-foreground/20 shadow-2xs font-mono">
            <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                    {label}
                </span>
                <div className="flex size-6 items-center justify-center rounded-md border border-border/60 bg-secondary/50">
                    <Icon className="size-3 text-foreground/70" strokeWidth={1.75} />
                </div>
            </div>

            <div className="mt-3">
                <div
                    className="text-2xl font-bold tracking-tight text-foreground cursor-default"
                    title={tooltip ?? value}
                >
                    {value}
                </div>
                {subValue && (
                    <div className="mt-0.5 text-[11px] font-medium text-foreground/70">
                        {subValue}
                    </div>
                )}
            </div>

            <p
                className="mt-2 truncate text-[10.5px] text-muted-foreground border-t border-border/50 pt-2"
                title={detail}
            >
                {detail}
            </p>
        </article>
    );
}

interface PlatformSummary {
    users: { total: number; active: number; pending: number; banned: number };
    creators: { approved: number; pending: number };
    usage: { totalRequests: number; totalTokens: number; totalCost: number };
    topUsers: Array<{
        userId: string;
        name: string;
        email: string;
        totalRequests: number;
        totalTokens: number;
        totalCost: number;
    }>;
    generatedAt: number;
}

function DashboardPage() {
    const {
        data: stats,
        isPending,
        error,
        refetch
    } = useQuery({
        queryKey: ["stats"],
        queryFn: () => api.get<UsageStats>("/v1/logs/stats"),
        refetchInterval: 30_000,
        refetchIntervalInBackground: false
    });

    const {
        data: platform,
        isPending: platformPending,
        error: platformError,
        refetch: refetchPlatform
    } = useQuery({
        queryKey: ["platform-summary"],
        queryFn: () => api.get<PlatformSummary>("/v1/admin/platform-analytics"),
        refetchInterval: 60_000,
        refetchIntervalInBackground: false,
        retry: false
    });

    if (isPending || !stats) {
        if (!stats && error) {
            return (
                <div className="mx-auto w-full max-w-7xl font-mono">
                    <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 px-6 text-center">
                        <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-3.5">
                            <TriangleAlert className="size-5" strokeWidth={1.75} />
                        </div>
                        <h1 className="text-sm font-bold text-foreground">
                            Unable to load gateway statistics
                        </h1>
                        <p className="mt-1 max-w-lg text-xs text-muted-foreground leading-relaxed">
                            {error instanceof Error
                                ? error.message
                                : "The gateway returned an unknown error."}
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-4 h-8 text-xs cursor-pointer gap-1.5"
                            onClick={() => void refetch()}
                        >
                            <RefreshCw className="size-3" />
                            <span>Retry Connection</span>
                        </Button>
                    </div>
                </div>
            );
        }
        return <DashboardSkeleton />;
    }

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 font-mono">
            {/* Header */}
            <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end border-b border-border/80 pb-5">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Gateway Operations
                    </h1>
                    <p className="mt-1 max-w-2xl text-xs text-muted-foreground leading-relaxed">
                        Real-time inference telemetry, routed model usage analytics, and active
                        provider node status.
                    </p>
                </div>
            </header>

            {/* 4 KPI Telemetry Tiles */}
            <section
                aria-label="Gateway usage summary"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5"
            >
                <StatCard
                    label="Total Requests"
                    value={stats ? formatCompactNumber(stats.totalRequests) : "0"}
                    tooltip={
                        stats
                            ? `${stats.totalRequests.toLocaleString()} recorded requests`
                            : undefined
                    }
                    detail="All recorded requests"
                    icon={Activity}
                />
                <StatCard
                    label="Total Tokens"
                    value={stats ? formatCompactNumber(stats.totalTokens) : "0"}
                    tooltip={
                        stats
                            ? `${stats.totalTokens.toLocaleString()} total tokens (${stats.totalInputTokens.toLocaleString()} in · ${stats.totalOutputTokens.toLocaleString()} out)`
                            : undefined
                    }
                    detail={
                        stats
                            ? `${formatCompactNumber(stats.totalInputTokens)} in · ${formatCompactNumber(stats.totalOutputTokens)} out`
                            : "0 in · 0 out"
                    }
                    icon={Coins}
                />
                <StatCard
                    label="Estimated Cost"
                    value={stats?.costLabel ?? "$0.00"}
                    detail={
                        stats?.estimated ? "Calculated from pricing catalog" : "Recorded token cost"
                    }
                    icon={CircleDollarSign}
                />
                <StatCard
                    label="Models Routed"
                    value={stats ? stats.byModel.length.toLocaleString() : "0"}
                    detail="Active models with traffic"
                    icon={Boxes}
                />
            </section>

            {/* Platform Analytics — user/creator marketplace summary */}
            {platform && (
                <section
                    aria-label="Platform summary"
                    className="rounded-xl border border-border/80 bg-card/40 p-4 sm:p-5 shadow-2xs"
                >
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                                <Users className="size-4 text-muted-foreground" strokeWidth={1.75} />
                                Platform Overview
                            </h2>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                                Marketplace growth, creator approvals, and platform revenue.
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void refetchPlatform()}
                            className="h-7 gap-1.5 text-[11px] cursor-pointer text-muted-foreground"
                        >
                            <RefreshCw className="size-3" />
                            Refresh
                        </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <div className="rounded-lg border border-border/70 bg-card/60 p-3.5">
                            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                <Users className="size-3" strokeWidth={1.75} />
                                Users
                            </div>
                            <div className="mt-1.5 text-xl font-bold text-foreground">
                                {platform.users.total.toLocaleString()}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                                {platform.users.active.toLocaleString()} active ·{" "}
                                {platform.users.pending.toLocaleString()} pending ·{" "}
                                {platform.users.banned.toLocaleString()} banned
                            </div>
                        </div>
                        <div className="rounded-lg border border-border/70 bg-card/60 p-3.5">
                            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                <Store className="size-3" strokeWidth={1.75} />
                                Creators
                            </div>
                            <div className="mt-1.5 text-xl font-bold text-foreground">
                                {platform.creators.approved.toLocaleString()}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                                {platform.creators.pending.toLocaleString()} pending approval
                            </div>
                        </div>
                        <div className="rounded-lg border border-border/70 bg-card/60 p-3.5">
                            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                <Activity className="size-3" strokeWidth={1.75} />
                                Requests / Tokens
                            </div>
                            <div className="mt-1.5 text-xl font-bold text-foreground">
                                {formatCompactNumber(platform.usage.totalRequests)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                                {formatCompactNumber(platform.usage.totalTokens)} tokens
                            </div>
                        </div>
                        <div className="rounded-lg border border-border/70 bg-card/60 p-3.5">
                            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                <CircleDollarSign className="size-3" strokeWidth={1.75} />
                                Platform Cost
                            </div>
                            <div className="mt-1.5 text-xl font-bold text-foreground">
                                ${platform.usage.totalCost.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                                All recorded estimated cost
                            </div>
                        </div>
                    </div>

                    {(platform.creators.pending > 0 || platform.users.pending > 0) && (
                        <Link
                            to="/admin/users"
                            className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 transition-colors hover:bg-amber-500/15"
                        >
                            <div className="flex items-center gap-2.5">
                                <UserCheck className="size-4 text-amber-500" strokeWidth={1.75} />
                                <span className="text-xs font-semibold text-foreground">
                                    {platform.users.pending + platform.creators.pending} approval
                                    request{platform.users.pending + platform.creators.pending === 1 ? "" : "s"} waiting
                                </span>
                            </div>
                            <span className="text-[11px] font-medium text-muted-foreground underline underline-offset-2">
                                Review in User Management →
                            </span>
                        </Link>
                    )}

                    {platform.topUsers.length > 0 && (
                        <div className="mt-4">
                            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                Top Users by Requests
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-border/60 text-muted-foreground">
                                            <th className="py-2 pr-4 font-medium">User</th>
                                            <th className="py-2 pr-4 font-medium">Requests</th>
                                            <th className="py-2 pr-4 font-medium">Tokens</th>
                                            <th className="py-2 font-medium">Cost</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40">
                                        {platform.topUsers.map((u) => (
                                            <tr key={u.userId}>
                                                <td className="py-2 pr-4">
                                                    <div className="font-semibold text-foreground truncate max-w-52">
                                                        {u.name || "Unnamed"}
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground truncate max-w-52">
                                                        {u.email}
                                                    </div>
                                                </td>
                                                <td className="py-2 pr-4 tabular-nums text-muted-foreground">
                                                    {u.totalRequests.toLocaleString()}
                                                </td>
                                                <td className="py-2 pr-4 tabular-nums text-muted-foreground">
                                                    {formatCompactNumber(u.totalTokens)}
                                                </td>
                                                <td className="py-2 tabular-nums text-muted-foreground">
                                                    ${u.totalCost.toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </section>
            )}

            {!platform && platformError && (
                <p className="text-[11px] text-destructive">
                    Platform analytics unavailable:{" "}
                    {platformError instanceof Error ? platformError.message : "Unknown error"}
                </p>
            )}
            {!platform && platformPending && (
                <p className="text-[11px] text-muted-foreground">Loading platform overview…</p>
            )}

            {/* Overview & Live Network Status */}
            <section
                aria-label="Operational overview"
                className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]"
            >
                <ModelUsageOverview models={stats?.byModel ?? []} />
                <NetworkStatus />
            </section>

            {/* Mesh Routing Topology Map */}
            <GatewayTopologyMap />

            {/* Tabular Usage Breakdown */}
            <UsageByModelTable models={stats?.byModel ?? []} />
        </div>
    );
}
