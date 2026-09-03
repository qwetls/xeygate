import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
    Activity,
    Coins,
    Cpu,
    KeyRound,
    RefreshCw,
    Search,
    ShieldAlert,
    ShieldCheck
} from "lucide-react";
import { api } from "@/lib/api";
import type { APIKeyZod, RequestLogEntry } from "@srouter/types";
import type { ListResponse } from "@/lib/types";
import { LogsSkeleton } from "@/components/skeletons";
import { useLogs } from "@/hooks/useLogs";
import { LogDetailSheet, LogTable } from "@/components/logs";
import { Empty, EmptyTitle } from "@/components/ui/empty";

interface ServerSettingsResponse {
    require_api_key?: boolean;
    requireApiKey?: boolean;
}

export const Route = createFileRoute("/logs")({
    staticData: { title: "Logs" },
    component: LogsPage
});

function LogsPage() {
    const [selectedLog, setSelectedLog] = useState<RequestLogEntry | null>(null);

    // Fetch server settings to determine whether require_api_key is active
    const { data: serverSettings } = useQuery<ServerSettingsResponse>({
        queryKey: ["server_settings"],
        queryFn: () => api.get<ServerSettingsResponse>("/v1/settings")
    });

    const requireApiKey = Boolean(
        serverSettings?.require_api_key ?? serverSettings?.requireApiKey
    );

    // Fetch API Keys list if requireApiKey is enabled to enrich filters
    const { data: keysData } = useQuery<{ data: APIKeyZod[] }>({
        queryKey: ["api_keys_list"],
        queryFn: () => api.get<{ data: APIKeyZod[] }>("/v1/keys"),
        enabled: requireApiKey
    });

    const keys = keysData?.data ?? [];

    const { data, isLoading, error, refetch, isFetching } = useQuery({
        queryKey: ["logs"],
        queryFn: () => api.get<ListResponse<RequestLogEntry>>("/v1/logs?limit=100"),
        refetchInterval: 10000
    });

    const logs: RequestLogEntry[] = data?.data ?? [];
    const filter = useLogs(logs);

    // Calculate aggregated metrics from recent logs
    const stats = useMemo(() => {
        let totalTokens = 0;
        let totalCost = 0;
        let cachedTokens = 0;
        let successCount = 0;

        for (const log of logs) {
            totalTokens += log.totalTokens;
            totalCost += log.costBreakdown?.totalCost ?? log.estimatedCost ?? 0;
            cachedTokens += log.cachedTokens ?? 0;
            if (log.statusCode >= 200 && log.statusCode < 300) {
                successCount++;
            }
        }

        const successRate = logs.length > 0 ? (successCount / logs.length) * 100 : 100;

        return {
            totalRequests: logs.length,
            totalTokens,
            totalCost,
            cachedTokens,
            successRate
        };
    }, [logs]);

    if (isLoading) {
        return <LogsSkeleton />;
    }

    if (error || !data) {
        return (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-xs text-destructive font-mono space-y-2">
                <div className="font-bold flex items-center gap-2">
                    <ShieldAlert className="size-4" />
                    Failed to load request audit stream
                </div>
                <div>{error instanceof Error ? error.message : "Unknown gateway connection error"}</div>
                <button
                    type="button"
                    onClick={() => void refetch()}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded bg-destructive text-destructive-foreground font-semibold hover:opacity-90 cursor-pointer"
                >
                    <RefreshCw className="size-3" /> Retry
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 font-mono">
            {/* Header with Gateway Auth Status Badge */}
            <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end border-b border-border/70 pb-5">
                <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
                            Observability & Auditing
                        </p>
                        {requireApiKey ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                                <ShieldCheck className="size-3" />
                                API Key Enforced
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary/50 text-muted-foreground border border-border/50">
                                Loopback Bypass (No Key Required)
                            </span>
                        )}
                    </div>
                    <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">
                        Request Audit Logs
                    </h1>
                    <p className="mt-1 max-w-2xl text-xs text-muted-foreground leading-relaxed">
                        Live stream of recent 100 API gateway requests with token usage, caching ratio, and itemized cost telemetry.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => void refetch()}
                        disabled={isFetching}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/70 bg-secondary/30 text-xs font-semibold text-foreground hover:bg-secondary transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                        title="Refresh audit logs"
                    >
                        <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
                        <span>Refresh</span>
                    </button>
                </div>
            </header>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                        <span>Total Requests</span>
                        <Activity className="size-3.5 text-muted-foreground" />
                    </div>
                    <div className="mt-1.5 font-mono text-xl font-bold text-foreground">
                        {stats.totalRequests}
                    </div>
                    <span className="text-[10px] text-emerald-500 font-semibold">
                        {stats.successRate.toFixed(1)}% success
                    </span>
                </div>

                <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                        <span>Tokens Consumed</span>
                        <Cpu className="size-3.5 text-muted-foreground" />
                    </div>
                    <div className="mt-1.5 font-mono text-xl font-bold text-foreground">
                        {stats.totalTokens.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-sky-400 font-semibold">
                        ⚡ {stats.cachedTokens.toLocaleString()} cached
                    </span>
                </div>

                <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-emerald-400 text-[10px] font-semibold uppercase tracking-wider">
                        <span>Total Cost</span>
                        <Coins className="size-3.5 text-emerald-400" />
                    </div>
                    <div className="mt-1.5 font-mono text-xl font-bold text-emerald-400">
                        ${stats.totalCost.toFixed(4)}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                        Incurred across recent 100
                    </span>
                </div>

                <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                        <span>Security Gate</span>
                        <KeyRound className="size-3.5 text-indigo-400" />
                    </div>
                    <div className="mt-1.5 font-mono text-sm font-bold text-foreground truncate">
                        {requireApiKey ? "Virtual Keys Active" : "Key Optional"}
                    </div>
                    <span className="text-[10px] text-muted-foreground truncate block">
                        {requireApiKey ? `${keys.length} keys provisioned` : "API Key column hidden"}
                    </span>
                </div>
            </div>

            {/* Filter Toolbar */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 border-b border-border/60 pb-4">
                <div className="flex flex-1 items-center gap-2 max-w-xl">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder={requireApiKey ? "Search by Model, IP, Key, Provider, or ID…" : "Search by Model, IP, Provider, or ID…"}
                            value={filter.searchQuery}
                            onChange={(e) => filter.setSearchQuery(e.target.value)}
                            className="w-full rounded-lg border border-border/60 bg-secondary/30 pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                    </div>

                    {/* API Key Selector filter (hanya jika requireApiKey aktif dan ada kunci) */}
                    {requireApiKey && keys.length > 0 && (
                        <select
                            value={filter.apiKeyFilter}
                            onChange={(e) => filter.setApiKeyFilter(e.target.value)}
                            className="rounded-lg border border-border/60 bg-secondary/30 px-2.5 py-1.5 text-xs text-foreground focus:outline-none cursor-pointer"
                        >
                            <option value="all">All Keys</option>
                            <option value="none">No Key (Bypass)</option>
                            {keys.map((k) => (
                                <option key={k.id} value={k.id}>
                                    Key: {k.name}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                <div className="flex items-center gap-1.5 self-end lg:self-auto">
                    <button
                        type="button"
                        onClick={() => filter.setStatusFilter("all")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            filter.statusFilter === "all"
                                ? "bg-foreground text-background font-semibold shadow-2xs"
                                : "bg-secondary/30 text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        All ({logs.length})
                    </button>

                    <button
                        type="button"
                        onClick={() => filter.setStatusFilter("success")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            filter.statusFilter === "success"
                                ? "bg-emerald-500 text-white shadow-2xs font-semibold"
                                : "bg-secondary/30 text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        Success (2xx)
                    </button>
                    <button
                        type="button"
                        onClick={() => filter.setStatusFilter("error")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            filter.statusFilter === "error"
                                ? "bg-rose-500 text-white shadow-2xs font-semibold"
                                : "bg-secondary/30 text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        Errors (4xx/5xx)
                    </button>
                </div>
            </div>

            {filter.filteredLogs.length === 0 ? (
                <Empty className="p-12 border border-dashed border-border/70 rounded-xl">
                    <EmptyTitle className="text-xs text-muted-foreground">
                        No matching audit logs for current filters.
                    </EmptyTitle>
                </Empty>
            ) : (
                <LogTable
                    logs={filter.filteredLogs}
                    requireApiKey={requireApiKey}
                    onSelect={setSelectedLog}
                />
            )}

            <LogDetailSheet
                log={selectedLog}
                requireApiKey={requireApiKey}
                onClose={() => setSelectedLog(null)}
            />
        </div>
    );
}
