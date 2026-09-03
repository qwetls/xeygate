import { useState } from "react";
import { ProviderIcon } from "@/components/providers";
import { AgentBadgeIcon } from "./analytics.agent-icons";
import { parseUserAgent } from "@/utils/agent-detector";
import type { AnalyticsTopModel, AnalyticsProviderSlice, AnalyticsTopAgent } from "@srouter/types";

interface Props {
    models: AnalyticsTopModel[];
    providers: AnalyticsProviderSlice[];
    agents?: AnalyticsTopAgent[];
    totalRequests: number;
}

function parseModelIdentifier(model: string): { provider: string; name: string } {
    const slashIdx = model.indexOf("/");
    if (slashIdx !== -1) {
        return { provider: model.slice(0, slashIdx), name: model.slice(slashIdx + 1) };
    }
    const lower = model.toLowerCase();
    if (lower.startsWith("gpt") || lower.startsWith("o1") || lower.startsWith("o3") || lower.startsWith("text-embedding")) {
        return { provider: "openai", name: model };
    }
    if (lower.startsWith("claude")) {
        return { provider: "anthropic", name: model };
    }
    if (lower.startsWith("gemini")) {
        return { provider: "gemini", name: model };
    }
    if (lower.startsWith("deepseek")) {
        return { provider: "deepseek", name: model };
    }
    return { provider: model, name: model };
}

type TabType = "models" | "agents" | "providers";

export function BreakdownTabsCard({ models, providers, agents = [], totalRequests }: Props) {
    const [activeTab, setActiveTab] = useState<TabType>("models");

    // Aggregate parsed agents
    const aggregatedAgents = new Map<string, { agentName: string; totalRequests: number; totalTokens: number }>();
    for (const item of agents) {
        const parsed = parseUserAgent(item.rawUserAgent || item.agent);
        const key = parsed.name;
        const existing = aggregatedAgents.get(key) || {
            agentName: key,
            totalRequests: 0,
            totalTokens: 0
        };
        existing.totalRequests += item.totalRequests;
        existing.totalTokens += item.totalTokens;
        aggregatedAgents.set(key, existing);
    }
    const sortedAgents = Array.from(aggregatedAgents.values()).sort(
        (a, b) => b.totalRequests - a.totalRequests
    );

    return (
        <div className="rounded-xl border border-border/70 bg-card/60 p-5 shadow-2xs font-mono">
            {/* Clean Segmented Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4 mb-3">
                <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
                        Breakdown & Distribution
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        Categorized telemetry across models, coding clients, and upstream providers.
                    </p>
                </div>

                <div className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-secondary/30 p-0.5 self-start sm:self-auto">
                    <button
                        type="button"
                        onClick={() => setActiveTab("models")}
                        className={[
                            "rounded px-3 py-1 text-xs font-medium transition-all cursor-pointer",
                            activeTab === "models"
                                ? "bg-foreground text-background font-semibold"
                                : "text-muted-foreground hover:text-foreground"
                        ].join(" ")}
                    >
                        Models ({models.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("agents")}
                        className={[
                            "rounded px-3 py-1 text-xs font-medium transition-all cursor-pointer",
                            activeTab === "agents"
                                ? "bg-foreground text-background font-semibold"
                                : "text-muted-foreground hover:text-foreground"
                        ].join(" ")}
                    >
                        Agents ({sortedAgents.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("providers")}
                        className={[
                            "rounded px-3 py-1 text-xs font-medium transition-all cursor-pointer",
                            activeTab === "providers"
                                ? "bg-foreground text-background font-semibold"
                                : "text-muted-foreground hover:text-foreground"
                        ].join(" ")}
                    >
                        Providers ({providers.length})
                    </button>
                </div>
            </div>

            {/* Content List: Clean Flat Rows (No Nested Card Boxes) */}
            <div className="divide-y divide-border/40">
                {activeTab === "models" && (
                    models.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-6 text-center">No model requests in this window.</p>
                    ) : (
                        models.map((m) => {
                            const { provider, name } = parseModelIdentifier(m.model);
                            const share = totalRequests > 0 ? (m.totalRequests / totalRequests) * 100 : 0;
                            return (
                                <div key={m.model} className="py-3 flex items-center gap-3.5 group">
                                    <ProviderIcon providerId={provider} className="size-5 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <span className="text-xs font-medium text-foreground truncate">
                                                {name}
                                            </span>
                                            <span className="text-[11px] font-mono text-muted-foreground tabular-nums whitespace-nowrap">
                                                {m.totalRequests} req <span className="text-muted-foreground/60">({share.toFixed(1)}%)</span>
                                            </span>
                                        </div>
                                        <div className="mt-1.5 h-1 w-full rounded-full bg-secondary/30 overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-foreground/60 transition-all duration-300"
                                                style={{ width: `${Math.max(share, 1.5)}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-[10px] text-muted-foreground/60 mt-1">
                                            <span>{provider}</span>
                                            <span>{m.totalTokens.toLocaleString()} tokens</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )
                )}

                {activeTab === "agents" && (
                    sortedAgents.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-6 text-center">No agent telemetry recorded in this window.</p>
                    ) : (
                        sortedAgents.map((item) => {
                            const share = totalRequests > 0 ? (item.totalRequests / totalRequests) * 100 : 0;
                            return (
                                <div key={item.agentName} className="py-3 flex items-center gap-3.5 group">
                                    <div className="size-5 shrink-0 flex items-center justify-center">
                                        <AgentBadgeIcon agentName={item.agentName} className="size-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <span className="text-xs font-medium text-foreground truncate">
                                                {item.agentName}
                                            </span>
                                            <span className="text-[11px] font-mono text-muted-foreground tabular-nums whitespace-nowrap">
                                                {item.totalRequests} req <span className="text-muted-foreground/60">({share.toFixed(1)}%)</span>
                                            </span>
                                        </div>
                                        <div className="mt-1.5 h-1 w-full rounded-full bg-secondary/30 overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-foreground/60 transition-all duration-300"
                                                style={{ width: `${Math.max(share, 1.5)}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-[10px] text-muted-foreground/60 mt-1">
                                            <span>Coding Client</span>
                                            <span>{item.totalTokens.toLocaleString()} tokens routed</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )
                )}

                {activeTab === "providers" && (
                    providers.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-6 text-center">No provider requests in this window.</p>
                    ) : (
                        providers.map((p) => {
                            const share = totalRequests > 0 ? (p.totalRequests / totalRequests) * 100 : 0;
                            return (
                                <div key={p.providerId} className="py-3 flex items-center gap-3.5 group">
                                    <ProviderIcon providerId={p.providerId} className="size-5 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <span className="text-xs font-medium text-foreground capitalize truncate">
                                                {p.providerId}
                                            </span>
                                            <span className="text-[11px] font-mono text-muted-foreground tabular-nums whitespace-nowrap">
                                                {p.totalRequests} req <span className="text-muted-foreground/60">({share.toFixed(1)}%)</span>
                                            </span>
                                        </div>
                                        <div className="mt-1.5 h-1 w-full rounded-full bg-secondary/30 overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-foreground/60 transition-all duration-300"
                                                style={{ width: `${Math.max(share, 1.5)}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-[10px] text-muted-foreground/60 mt-1">
                                            <span>Upstream Target</span>
                                            <span>{share.toFixed(1)}% traffic</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )
                )}
            </div>
        </div>
    );
}
