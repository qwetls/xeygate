import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Coins, Cpu } from "lucide-react";

export const Route = createFileRoute("/_client/dashboard/usage")({
    component: ClientUsagePage
});

interface UsageData {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    byModel: Array<{ model: string; tokens: number; cost: number }>;
}

function ClientUsagePage() {
    const { data: usage, isPending } = useQuery({
        queryKey: ["user-usage"],
        queryFn: () => api.get<UsageData>("/v1/users/usage")
    });

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 font-mono">
            <header className="border-b border-border/80 pb-5">
                <h1 className="text-2xl font-bold tracking-tight">Usage</h1>
                <p className="mt-1 text-xs text-muted-foreground">Your API usage statistics across all keys.</p>
            </header>

            {/* Summary Cards */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <article className="rounded-xl border border-border/80 bg-card/60 p-4">
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">Total Requests</span>
                        <Activity className="size-4" strokeWidth={1.75} />
                    </div>
                    <div className="mt-2 text-2xl font-bold">{(usage?.totalRequests ?? 0).toLocaleString()}</div>
                </article>
                <article className="rounded-xl border border-border/80 bg-card/60 p-4">
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">Total Tokens</span>
                        <Cpu className="size-4" strokeWidth={1.75} />
                    </div>
                    <div className="mt-2 text-2xl font-bold">{(usage?.totalTokens ?? 0).toLocaleString()}</div>
                </article>
                <article className="rounded-xl border border-border/80 bg-card/60 p-4">
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">Total Cost</span>
                        <Coins className="size-4" strokeWidth={1.75} />
                    </div>
                    <div className="mt-2 text-2xl font-bold">${(usage?.totalCost ?? 0).toFixed(4)}</div>
                </article>
            </section>

            {/* By Model Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Usage by Model</CardTitle>
                </CardHeader>
                <CardContent>
                    {isPending ? (
                        <p className="text-xs text-muted-foreground py-4 text-center">Loading...</p>
                    ) : !usage?.byModel.length ? (
                        <p className="text-xs text-muted-foreground py-8 text-center">No usage data yet. Start making API requests to see your usage breakdown.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-border/80 text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                                        <th className="pb-2 pr-4 font-semibold">Model</th>
                                        <th className="pb-2 pr-4 font-semibold text-right">Tokens</th>
                                        <th className="pb-2 font-semibold text-right">Cost</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {usage.byModel.map((m, i) => (
                                        <tr key={`${m.model}-${i}`} className="border-b border-border/40 last:border-0">
                                            <td className="py-2.5 pr-4 font-medium text-foreground">{m.model}</td>
                                            <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">{m.tokens.toLocaleString()}</td>
                                            <td className="py-2.5 text-right tabular-nums text-muted-foreground">${m.cost.toFixed(4)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
