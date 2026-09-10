import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, Boxes, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCatalogModels } from "@/hooks/usePublicCatalog";
import type { CatalogFlatModel } from "@/lib/api";

export const Route = createFileRoute("/catalog/")({ component: CatalogModelsPage });

function formatPrice(v: number | undefined): string {
    if (v === undefined) return "—";
    return `$${v}`;
}

function matches(m: CatalogFlatModel, term: string): boolean {
    return (
        m.id.toLowerCase().includes(term) ||
        (m.metadata?.name.toLowerCase().includes(term) ?? false) ||
        (m.metadata?.family?.toLowerCase().includes(term) ?? false) ||
        m.offers.some((o) => o.name.toLowerCase().includes(term) || o.providerName.toLowerCase().includes(term))
    );
}

export function CatalogModelsPage() {
    const catalog = useCatalogModels();
    const [q, setQ] = useState("");

    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase();
        const models = catalog.data?.models ?? [];
        return term ? models.filter((m) => matches(m, term)) : models;
    }, [catalog.data, q]);

    return (
        <div className="space-y-6">
            <div className="space-y-2 max-w-2xl">
                <h1 className="text-2xl font-bold tracking-tight">API marketplace</h1>
                <p className="text-sm text-muted-foreground">Browse every model supplied by the network. Click a model for pricing across providers and live usage.</p>
            </div>

            <div className="flex items-center gap-2 max-w-md">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <Input placeholder="Search model or provider" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                {catalog.isFetching ? <span className="text-xs text-muted-foreground">Loading…</span> : null}
            </div>

            {catalog.isError ? <p className="text-sm text-destructive">Failed to load catalog.</p> : null}

            {!catalog.isError && !catalog.isPending && filtered.length === 0 ? (
                <div className="rounded-xl border border-border/60 bg-card p-8 text-center">
                    <Boxes className="mx-auto size-10 text-muted-foreground/40" />
                    <p className="mt-3 text-sm font-semibold">No listings yet</p>
                    <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">Ask a creator to add an API provider — or become a creator yourself after signing in and choosing “Sell APIs”.</p>
                    <Button size="sm" render={<Link to="/register" />} className="mt-4 gap-2 cursor-pointer">Become a creator <ArrowRight className="size-4" /></Button>
                </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
                {filtered.map((m) => {
                    const hasOfficial = m.offers.some((o) => o.official);
                    return (
                        <Link
                            key={m.id}
                            to="/catalog/$"
                            params={{ _splat: m.id }}
                            className="group rounded-xl border border-border/60 bg-card p-4 space-y-3 hover:border-primary/50 transition-colors"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold leading-none break-all group-hover:text-primary transition-colors">{m.id}</p>
                                    {m.metadata?.description ? (
                                        <p className="mt-1.5 line-clamp-2 text-[11px] text-muted-foreground">{m.metadata.description}</p>
                                    ) : null}
                                </div>
                                {hasOfficial ? (
                                    <span className="inline-flex shrink-0 items-center gap-1 rounded bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                        <BadgeCheck className="size-3" />
                                        Official
                                    </span>
                                ) : null}
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                <span className="inline-flex items-center gap-1">
                                    <span className="font-semibold">{formatPrice(m.bestOffer?.input)} in</span>
                                    <span className="text-muted-foreground">/</span>
                                    <span className="font-semibold">{formatPrice(m.bestOffer?.output)} out</span>
                                    <span className="text-muted-foreground">per 1M</span>
                                </span>
                                <span className="text-muted-foreground">
                                    {m.endpoints} endpoint{m.endpoints === 1 ? "" : "s"}
                                </span>
                            </div>
                        </Link>
                    );
                })}
            </div>

            <div className="flex flex-wrap gap-3">
                <Button variant="outline" size="sm" render={<Link to="/" />} className="cursor-pointer">Back to home</Button>
                <Button size="sm" render={<Link to="/register" />} className="cursor-pointer gap-2">Register to buy or sell <ArrowRight className="size-4" /></Button>
            </div>
        </div>
    );
}
