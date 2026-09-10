import { useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, BadgeCheck, Clock, Gauge, Layers, Percent, Search, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCatalogModel, useCatalogModels, useMarketplaceModelStats } from "@/hooks/usePublicCatalog";
import type { MarketplaceAnalyticsWindow } from "@srouter/types";
import type { CatalogFlatOffer } from "@/lib/api";

export const Route = createFileRoute("/catalog/$")({ component: CatalogModelDetailPage });

const WINDOWS: MarketplaceAnalyticsWindow[] = ["24h", "7d", "30d"];

function fmtCompact(n: number): string {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return `${n}`;
}

function fmtPct(v: number): string {
    return `${(v * 100).toFixed(v >= 0.995 && v < 1 ? 2 : 1)}%`;
}

function fmtPrice(v: number | undefined): string {
    return v === undefined ? "—" : `$${v}`;
}

function offerKey(o: CatalogFlatOffer): string {
    return o.providerId;
}

function SeriesBars({ points }: { points: { ts: number; requests: number }[] }) {
    if (points.length === 0) return null;
    const max = Math.max(...points.map((p) => p.requests), 1);
    return (
        <div className="flex h-16 items-end gap-px" role="img" aria-label="requests over time">
            {points.map((p) => (
                <div
                    key={p.ts}
                    className="flex-1 rounded-sm bg-primary/60 hover:bg-primary transition-colors"
                    style={{ height: `${Math.max((p.requests / max) * 100, p.requests > 0 ? 4 : 1)}%` }}
                    title={`${p.requests} req @ ${new Date(p.ts).toLocaleString()}`}
                />
            ))}
        </div>
    );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Zap; label: string; value: string }) {
    return (
        <div className="rounded-lg border border-border/60 bg-card px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                <Icon className="size-3" /> {label}
            </p>
            <p className="mt-1 text-sm font-semibold">{value}</p>
        </div>
    );
}

export function CatalogModelDetailPage() {
    const { _splat: modelId } = useParams({ from: "/catalog/$" });
    const [window, setWindow] = useState<MarketplaceAnalyticsWindow>("7d");

    const flat = useCatalogModels();
    const model = (flat.data?.models ?? []).find((m) => m.id === modelId);
    const offerings = useCatalogModel(modelId);
    const stats = useMarketplaceModelStats(modelId, window);

    const meta = model?.metadata ?? null;
    const bestKey = model?.bestOffer ? offerKey(model.bestOffer) : null;
    // Prefer the flat catalog's per-model offers; fall back to the per-model
    // endpoint when the id is not in the flat list (deep link to a delisted or
    // newly-added model).
    const tableOffers: CatalogFlatOffer[] =
        (model?.offers ?? []).length > 0
            ? model!.offers
            : (offerings.data?.offerings ?? []).map((o) => ({
                  providerId: o.providerId,
                  name: o.name,
                  providerName: o.providerName,
                  official: o.official,
                  override: o.override,
                  ...o.pricing
              }));

    return (
        <div className="space-y-8">
            <div className="space-y-3">
                <Button variant="ghost" size="sm" render={<Link to="/catalog" />} className="-ml-2 gap-2 text-xs cursor-pointer">
                    <ArrowLeft className="size-4" /> All models
                </Button>
                <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-bold tracking-tight break-all">{modelId}</h1>
                    {meta?.family ? (
                        <span className="rounded bg-secondary px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">{meta.family}</span>
                    ) : null}
                    {meta?.reasoning ? <span className="rounded bg-violet-500/15 px-2 py-1 text-[10px] font-semibold text-violet-600 dark:text-violet-400">Reasoning</span> : null}
                    {meta?.toolCall ? <span className="rounded bg-sky-500/15 px-2 py-1 text-[10px] font-semibold text-sky-600 dark:text-sky-400">Tools</span> : null}
                </div>
                {meta?.description ? (
                    <p className="max-w-2xl text-sm text-muted-foreground">{meta.description}</p>
                ) : null}
                {meta ? (
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
                        {meta.context ? <span>Context <span className="font-semibold text-foreground">{fmtCompact(meta.context)}</span></span> : null}
                        {meta.output ? <span>Max output <span className="font-semibold text-foreground">{fmtCompact(meta.output)}</span></span> : null}
                        {meta.modality?.length ? <span>Input <span className="font-semibold text-foreground">{meta.modality.join(", ")}</span></span> : null}
                        {meta.released ? <span>Released <span className="font-semibold text-foreground">{meta.released}</span></span> : null}
                    </div>
                ) : null}
            </div>

            {/* Pricing across supply endpoints */}
            <section className="space-y-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <Layers className="size-4 text-muted-foreground" /> Providers
                    <span className="text-xs font-normal text-muted-foreground">({tableOffers.length || (offerings.data?.total ?? 0)})</span>
                </h2>
                {tableOffers.length === 0 && offerings.isPending ? (
                    <p className="text-xs text-muted-foreground">Loading…</p>
                ) : null}
                {tableOffers.length === 0 && !offerings.isPending ? (
                    <div className="rounded-xl border border-border/60 bg-card p-6 text-center">
                        <Search className="mx-auto size-6 text-muted-foreground/40" />
                        <p className="mt-2 text-xs text-muted-foreground">This model is not listed on the marketplace right now.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-border/60">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-secondary/50 text-muted-foreground">
                                <tr>
                                    <th className="px-3 py-2 font-medium">Provider</th>
                                    <th className="px-3 py-2 font-medium">Input / 1M</th>
                                    <th className="px-3 py-2 font-medium">Output / 1M</th>
                                    <th className="px-3 py-2 font-medium">Cached</th>
                                    <th className="px-3 py-2 font-medium text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tableOffers.map((o) => (
                                    <tr key={offerKey(o)} className="border-t border-border/50">
                                        <td className="px-3 py-2">
                                            <span className="font-semibold">{o.name}</span>
                                            <span className="ml-2 text-[10px] text-muted-foreground">{o.providerId}</span>
                                        </td>
                                        <td className="px-3 py-2">{fmtPrice(o.input)}</td>
                                        <td className="px-3 py-2">{fmtPrice(o.output)}</td>
                                        <td className="px-3 py-2 text-muted-foreground">{fmtPrice(o.cached)}</td>
                                        <td className="px-3 py-2 text-right">
                                            <span className="inline-flex items-center gap-1.5 justify-end">
                                                {bestKey === o.providerId ? <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Best price</span> : null}
                                                {o.override ? <BadgeCheck className="size-3.5 text-emerald-500" aria-label="admin-priced" /> : null}
                                                {o.official ? <span className="text-[10px] text-muted-foreground">Official</span> : <span className="text-[10px] text-muted-foreground">Creator</span>}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* Live usage */}
            <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="flex items-center gap-2 text-sm font-semibold">
                        <Gauge className="size-4 text-muted-foreground" /> Usage
                    </h2>
                    <div className="flex gap-1">
                        {WINDOWS.map((w) => (
                            <Button
                                key={w}
                                size="sm"
                                variant={w === window ? "default" : "outline"}
                                className="text-xs cursor-pointer"
                                onClick={() => setWindow(w)}
                            >
                                {w}
                            </Button>
                        ))}
                    </div>
                </div>

                {stats.isPending ? (
                    <p className="text-xs text-muted-foreground">Loading usage…</p>
                ) : stats.isError ? (
                    <p className="text-xs text-destructive">Failed to load usage.</p>
                ) : stats.data === null ? (
                    <div className="rounded-xl border border-border/60 bg-card p-6 text-center">
                        <Clock className="mx-auto size-6 text-muted-foreground/40" />
                        <p className="mt-2 text-xs text-muted-foreground">No traffic for this model in the last {window}.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                            <StatCard icon={Zap} label="Requests" value={fmtCompact(stats.data.total.totalRequests)} />
                            <StatCard icon={Percent} label="Success" value={fmtPct(stats.data.total.successRate)} />
                            <StatCard icon={Gauge} label="Avg latency" value={`${Math.round(stats.data.total.avgLatencyMs)} ms`} />
                            <StatCard icon={Clock} label="P95 latency" value={`${Math.round(stats.data.total.p95LatencyMs)} ms`} />
                            <StatCard icon={Layers} label="Tokens" value={fmtCompact(stats.data.total.totalTokens)} />
                            <StatCard icon={BadgeCheck} label="Cache hit" value={fmtPct(stats.data.total.cacheHitRate)} />
                        </div>
                        <div className="rounded-xl border border-border/60 bg-card p-4">
                            <SeriesBars points={stats.data.series.map((p) => ({ ts: p.ts, requests: p.requests }))} />
                        </div>
                        {stats.data.endpoints.length > 0 ? (
                            <div className="overflow-x-auto rounded-xl border border-border/60">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-secondary/50 text-muted-foreground">
                                        <tr>
                                            <th className="px-3 py-2 font-medium">Endpoint</th>
                                            <th className="px-3 py-2 font-medium text-right">Requests</th>
                                            <th className="px-3 py-2 font-medium text-right">Success</th>
                                            <th className="px-3 py-2 font-medium text-right">Avg latency</th>
                                            <th className="px-3 py-2 font-medium text-right">tok/s</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.data.endpoints.map((e) => (
                                            <tr key={e.providerId} className="border-t border-border/50">
                                                <td className="px-3 py-2">
                                                    <span className="font-semibold">{e.displayName}</span>
                                                    {e.official ? <span className="ml-2 text-[10px] text-muted-foreground">Official</span> : <span className="ml-2 text-[10px] text-muted-foreground">Creator</span>}
                                                </td>
                                                <td className="px-3 py-2 text-right">{fmtCompact(e.totalRequests)}</td>
                                                <td className="px-3 py-2 text-right">{fmtPct(e.successRate)}</td>
                                                <td className="px-3 py-2 text-right">{Math.round(e.avgLatencyMs)} ms</td>
                                                <td className="px-3 py-2 text-right">{e.throughputTokensPerSec.toFixed(0)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : null}
                    </div>
                )}
            </section>

            <div className="flex flex-wrap gap-3 border-t border-border/60 pt-6">
                <Button variant="outline" size="sm" render={<Link to="/catalog" />} className="cursor-pointer gap-2">
                    <ArrowLeft className="size-4" /> Back to marketplace
                </Button>
                <Button size="sm" render={<Link to="/register" />} className="cursor-pointer gap-2">
                    Get your own key <Zap className="size-4" />
                </Button>
            </div>
        </div>
    );
}
