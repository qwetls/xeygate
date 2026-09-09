import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
    useMarketplaceEndpoints,
    useMarketplaceModels,
    useMarketplaceOverview
} from "@/hooks/useMarketplaceAnalytics";
import type {
    MarketplaceAnalyticsWindow,
    MarketplaceModelStat,
    MarketplaceProviderStat,
    MarketplaceStatPoint
} from "@srouter/types";
import { formatCompactNumber, formatNumber } from "@/lib/utils";
import { formatTime, formatTimeUnit } from "@/utils/format";
import {
    Activity,
    CheckCircle,
    Clock,
    Cpu,
    Globe,
    Layers
} from "lucide-react";
import {
    BarChart,
    Bar,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer
} from "recharts";
import type { TooltipValueType } from "recharts";

// ── Route ──────────────────────────────────────────────────────────────

export const Route = createFileRoute("/_client/dashboard/analytics")({
    staticData: { title: "Analytics" },
    component: MarketplaceAnalyticsPage
});

// ── Constants ──────────────────────────────────────────────────────────

const WINDOWS: { value: MarketplaceAnalyticsWindow; label: string }[] = [
    { value: "24h", label: "24h" },
    { value: "7d", label: "7d" },
    { value: "30d", label: "30d" }
];

const TOOLTIP_STYLE = {
    backgroundColor: "var(--background)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    fontSize: "12px"
} as const;

// ── Page ───────────────────────────────────────────────────────────────

function MarketplaceAnalyticsPage() {
    const [window, setWindow] = useState<MarketplaceAnalyticsWindow>("24h");
    const overview = useMarketplaceOverview(window);
    const models = useMarketplaceModels(window);
    const endpoints = useMarketplaceEndpoints(window);

    const data = overview.data;
    const isInitialLoading = overview.isLoading && !data;

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 font-mono">
            {/* ── Header ── */}
            <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end border-b border-border/80 pb-5">
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
                        Marketplace
                    </p>
                    <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">
                        Analytics
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-secondary/30 p-0.5">
                        {WINDOWS.map((w) => (
                            <button
                                key={w.value}
                                type="button"
                                onClick={() => setWindow(w.value)}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                    window === w.value
                                        ? "bg-foreground text-background font-semibold"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {w.label}
                            </button>
                        ))}
                    </div>
                    {data && (
                        <span className="text-[10px] text-muted-foreground/70 font-mono whitespace-nowrap">
                            Updated {new Date(data.generatedAt).toLocaleTimeString()}
                        </span>
                    )}
                </div>
            </header>

            {/* ── Body ── */}
            {isInitialLoading ? (
                <MarketplaceSkeleton />
            ) : overview.error ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive font-mono">
                    Failed to load marketplace analytics:{" "}
                    {overview.error instanceof Error
                        ? overview.error.message
                        : "Unknown error"}
                </div>
            ) : data ? (
                <>
                    <OverviewCards data={data} />

                    {data.totalRequests === 0 ? (
                        <p className="text-xs text-muted-foreground py-10 text-center">
                            No marketplace traffic in this window yet.
                        </p>
                    ) : (
                        <>
                            {data.series.length > 1 && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <RequestsChart
                                        series={data.series}
                                        window={window}
                                    />
                                    <TokensChart
                                        series={data.series}
                                        window={window}
                                    />
                                </div>
                            )}

                            <ModelLeaderboard
                                models={models.data?.models}
                                isLoading={models.isLoading && !models.data}
                            />

                            <EndpointTable
                                providers={endpoints.data?.providers}
                                isLoading={endpoints.isLoading && !endpoints.data}
                            />
                        </>
                    )}
                </>
            ) : null}
        </div>
    );
}

// ── Stat Cards ─────────────────────────────────────────────────────────

function OverviewCards({
    data
}: {
    data: {
        totalRequests: number;
        successRate: number;
        avgLatencyMs: number;
        p95LatencyMs: number;
        totalTokens: number;
        models: number;
        endpoints: number;
    };
}) {
    const cards: { label: string; icon: typeof Activity; value: string }[] = [
        {
            label: "Requests",
            icon: Activity,
            value: formatCompactNumber(data.totalRequests)
        },
        {
            label: "Tokens",
            icon: Cpu,
            value: formatCompactNumber(data.totalTokens)
        },
        {
            label: "Success Rate",
            icon: CheckCircle,
            value: `${(data.successRate * 100).toFixed(1)}%`
        },
        {
            label: "Avg Latency",
            icon: Clock,
            value: `${Math.round(data.avgLatencyMs)}ms`
        },
        {
            label: "P95 Latency",
            icon: Layers,
            value: `${Math.round(data.p95LatencyMs)}ms`
        },
        {
            label: "Endpoints",
            icon: Globe,
            value: formatNumber(data.endpoints)
        }
    ];

    return (
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {cards.map((c) => (
                <article
                    key={c.label}
                    className="rounded-xl border border-border/80 bg-card/60 p-4"
                >
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                            {c.label}
                        </span>
                        <c.icon className="size-4" strokeWidth={1.75} />
                    </div>
                    <div className="mt-2 text-2xl font-bold">{c.value}</div>
                </article>
            ))}
        </section>
    );
}

// ── Charts ─────────────────────────────────────────────────────────────

function deriveBucketLabel(series: MarketplaceStatPoint[]): string {
    if (series.length < 2) return "bucket";
    const ms = series[1].ts - series[0].ts;
    return formatTimeUnit(ms);
}

function timeLabel(ts: number, window: MarketplaceAnalyticsWindow): string {
    if (window === "24h") return formatTime(ts);
    return new Date(ts).toLocaleDateString([], {
        month: "short",
        day: "numeric"
    });
}

const TICK_FMT = (v: number) =>
    v >= 1_000_000
        ? `${(v / 1_000_000).toFixed(1)}M`
        : v >= 1_000
          ? `${Math.round(v / 1_000)}k`
          : String(v);

function RequestsChart({
    series,
    window
}: {
    series: MarketplaceStatPoint[];
    window: MarketplaceAnalyticsWindow;
}) {
    const bucketLabel = deriveBucketLabel(series);
    const chartData = series.map((p) => ({
        label: timeLabel(p.ts, window),
        requests: p.requests
    }));

    return (
        <div className="flex flex-col rounded-xl border border-border/60 bg-secondary/10 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                Requests / {bucketLabel}
            </h3>
            <div className="flex-1 min-h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                        <XAxis
                            dataKey="label"
                            tick={{ fontSize: 10 }}
                            interval="preserveStartEnd"
                        />
                        <YAxis tick={{ fontSize: 10 }} domain={[0, "auto"]} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Bar
                            dataKey="requests"
                            fill="var(--primary)"
                            radius={[3, 3, 0, 0]}
                            name="Requests"
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

function TokensChart({
    series,
    window
}: {
    series: MarketplaceStatPoint[];
    window: MarketplaceAnalyticsWindow;
}) {
    const bucketLabel = deriveBucketLabel(series);
    const chartData = series.map((p) => ({
        label: timeLabel(p.ts, window),
        tokens: p.tokens
    }));

    return (
        <div className="flex flex-col rounded-xl border border-border/60 bg-secondary/10 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                Tokens / {bucketLabel}
            </h3>
            <div className="flex-1 min-h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient
                                id="mpTokenGrad"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                            >
                                <stop
                                    offset="0%"
                                    stopColor="var(--chart-input)"
                                    stopOpacity={0.35}
                                />
                                <stop
                                    offset="100%"
                                    stopColor="var(--chart-input)"
                                    stopOpacity={0.02}
                                />
                            </linearGradient>
                        </defs>
                        <XAxis
                            dataKey="label"
                            tick={{ fontSize: 10 }}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            tick={{ fontSize: 10 }}
                            domain={[0, "auto"]}
                            tickFormatter={TICK_FMT}
                        />
                        <Tooltip
                            contentStyle={TOOLTIP_STYLE}
                            formatter={(
                                value: TooltipValueType | undefined,
                                name: string | number | undefined
                            ) => [
                                `${Number(value ?? 0).toLocaleString()} tokens`,
                                name
                            ]}
                        />
                        <Area
                            type="monotone"
                            dataKey="tokens"
                            stroke="var(--chart-input)"
                            fill="url(#mpTokenGrad)"
                            strokeWidth={2}
                            name="Tokens"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

// ── Tables ─────────────────────────────────────────────────────────────

function ModelLeaderboard({
    models,
    isLoading
}: {
    models: MarketplaceModelStat[] | undefined;
    isLoading: boolean;
}) {
    return (
        <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Model Leaderboard
            </h2>
            {isLoading ? (
                <TableSkeleton rows={5} cols={6} />
            ) : !models?.length ? (
                <p className="text-xs text-muted-foreground py-6 text-center">
                    No model traffic in this window.
                </p>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-border/80">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-border/80 text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground bg-secondary/20">
                                <th className="px-3 py-2.5 font-semibold">Model</th>
                                <th className="px-3 py-2.5 font-semibold text-right">
                                    Requests
                                </th>
                                <th className="px-3 py-2.5 font-semibold text-right">
                                    Success
                                </th>
                                <th className="px-3 py-2.5 font-semibold text-right">
                                    Avg p50
                                </th>
                                <th className="px-3 py-2.5 font-semibold text-right">
                                    Avg p95
                                </th>
                                <th className="px-3 py-2.5 font-semibold text-right">
                                    Tokens
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {models.map((m) => (
                                <tr
                                    key={m.model}
                                    className="border-b border-border/40 last:border-0 hover:bg-secondary/20 transition-colors"
                                >
                                    <td className="px-3 py-2.5 font-medium text-foreground">
                                        {m.model}
                                    </td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                                        {formatNumber(m.totalRequests)}
                                    </td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                                        {(m.successRate * 100).toFixed(1)}%
                                    </td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                                        {Math.round(m.p50LatencyMs)}ms
                                    </td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                                        {Math.round(m.p95LatencyMs)}ms
                                    </td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                                        {formatCompactNumber(m.totalTokens)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

function EndpointTable({
    providers,
    isLoading
}: {
    providers: MarketplaceProviderStat[] | undefined;
    isLoading: boolean;
}) {
    return (
        <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Endpoint Performance
            </h2>
            {isLoading ? (
                <TableSkeleton rows={4} cols={6} />
            ) : !providers?.length ? (
                <p className="text-xs text-muted-foreground py-6 text-center">
                    No endpoint traffic in this window.
                </p>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-border/80">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-border/80 text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground bg-secondary/20">
                                <th className="px-3 py-2.5 font-semibold">
                                    Endpoint
                                </th>
                                <th className="px-3 py-2.5 font-semibold text-right">
                                    Requests
                                </th>
                                <th className="px-3 py-2.5 font-semibold text-right">
                                    Success
                                </th>
                                <th className="px-3 py-2.5 font-semibold text-right">
                                    Avg Latency
                                </th>
                                <th className="px-3 py-2.5 font-semibold text-right">
                                    Tokens
                                </th>
                                <th className="px-3 py-2.5 font-semibold text-right">
                                    Models
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {providers.map((p) => (
                                <tr
                                    key={p.providerId}
                                    className="border-b border-border/40 last:border-0 hover:bg-secondary/20 transition-colors"
                                >
                                    <td className="px-3 py-2.5 font-medium text-foreground">
                                        <span className="flex items-center gap-1.5">
                                            {p.displayName}
                                            {p.official && (
                                                <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
                                                    Official
                                                </span>
                                            )}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                                        {formatNumber(p.totalRequests)}
                                    </td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                                        {(p.successRate * 100).toFixed(1)}%
                                    </td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                                        {Math.round(p.avgLatencyMs)}ms
                                    </td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                                        {formatCompactNumber(p.totalTokens)}
                                    </td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                                        {p.models}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

// ── Skeleton ───────────────────────────────────────────────────────────

function MarketplaceSkeleton() {
    return (
        <div className="flex flex-col gap-6 animate-pulse">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div
                        key={i}
                        className="h-[88px] rounded-xl bg-secondary/20"
                    />
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="h-[240px] rounded-xl bg-secondary/20" />
                <div className="h-[240px] rounded-xl bg-secondary/20" />
            </div>
            <div className="h-[200px] rounded-xl bg-secondary/20" />
            <div className="h-[180px] rounded-xl bg-secondary/20" />
        </div>
    );
}

function TableSkeleton({ rows, cols }: { rows: number; cols: number }) {
    return (
        <div className="overflow-hidden rounded-xl border border-border/80 animate-pulse">
            <table className="w-full text-xs">
                <thead>
                    <tr className="bg-secondary/20">
                        {Array.from({ length: cols }).map((_, c) => (
                            <th
                                key={c}
                                className="px-3 py-2.5"
                            >
                                <div className="h-3 w-16 rounded bg-secondary/30" />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: rows }).map((_, r) => (
                        <tr
                            key={r}
                            className="border-b border-border/40 last:border-0"
                        >
                            {Array.from({ length: cols }).map((_, c) => (
                                <td
                                    key={c}
                                    className="px-3 py-3"
                                >
                                    <div className="h-3 w-12 rounded bg-secondary/20 ml-auto" />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
