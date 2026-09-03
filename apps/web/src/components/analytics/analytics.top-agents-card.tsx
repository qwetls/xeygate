import type { AnalyticsTopAgent } from "@srouter/types";
import { AgentBadgeIcon } from "./analytics.agent-icons";
import { parseUserAgent } from "@/utils/agent-detector";

interface Props {
    agents?: AnalyticsTopAgent[];
    totalRequests: number;
}

export function TopCodingAgentsCard({ agents = [], totalRequests }: Props) {
    if (!agents || agents.length === 0) {
        return (
            <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-2xs font-mono">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                    Top Coding Agents
                </h3>
                <p className="text-xs text-muted-foreground">No agent telemetry recorded in this window.</p>
            </div>
        );
    }

    // Aggregate parsed agents (e.g. various OpenCode or Cursor versions into one group)
    const aggregated = new Map<string, { agentName: string; totalRequests: number; totalTokens: number }>();
    for (const item of agents) {
        const parsed = parseUserAgent(item.rawUserAgent || item.agent);
        const key = parsed.name;
        const existing = aggregated.get(key) || {
            agentName: key,
            totalRequests: 0,
            totalTokens: 0
        };
        existing.totalRequests += item.totalRequests;
        existing.totalTokens += item.totalTokens;
        aggregated.set(key, existing);
    }

    const sortedList = Array.from(aggregated.values()).sort(
        (a, b) => b.totalRequests - a.totalRequests
    );

    return (
        <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-2xs font-mono">
            <div className="flex items-center justify-between mb-3 border-b border-border/40 pb-2">
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                    Top Coding Agents
                </h3>
                <span className="text-[10px] text-muted-foreground">
                    Telemetry by User-Agent
                </span>
            </div>

            <div className="space-y-3">
                {sortedList.map((item) => {
                    const share = totalRequests > 0 ? (item.totalRequests / totalRequests) * 100 : 0;
                    return (
                        <div key={item.agentName} className="flex items-center gap-3">
                            <div className="size-6 shrink-0 flex items-center justify-center rounded border border-border/60 bg-secondary/30">
                                <AgentBadgeIcon agentName={item.agentName} className="size-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-medium text-foreground truncate">
                                        {item.agentName}
                                    </span>
                                    <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                                        {item.totalRequests} req ({share.toFixed(1)}%)
                                    </span>
                                </div>
                                <div className="mt-1 h-1.5 w-full rounded-full bg-secondary/30 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-foreground/60 transition-all duration-300"
                                        style={{ width: `${Math.max(share, 1.5)}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-[9px] text-muted-foreground/70 mt-0.5">
                                    <span>{item.totalTokens.toLocaleString()} tokens routed</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
