import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, Search, Boxes } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/catalog")({ component: CatalogPage });

type CatalogPayload = {
    data?: { providers: CatalogProvider[]; total: number };
    providers?: CatalogProvider[];
    total?: number;
};
type CatalogProvider = {
    providerId: string;
    name: string;
    protocol: string | null;
    category: string | null;
    ownerId: string | null;
    models: Array<{ id: string; pricing: { input: number; output: number; cached?: number; reasoning?: number }; override: boolean }>;
};

function useCatalog() {
    return useQuery<CatalogProvider[]>({
        queryKey: ["public-catalog"],
        queryFn: async () => {
            const raw = (await api.get<CatalogPayload & { data?: CatalogPayload } & { error?: unknown }>("/v1/catalog")) as any;
            const payload: CatalogPayload = raw?.data ?? raw ?? {};
            return Array.isArray(payload.providers) ? payload.providers : Array.isArray(payload.data?.providers) ? payload.data.providers : [];
        },
        retry: false,
    });
}

export function CatalogPage() {
    const catalog = useCatalog();
    const [q, setQ] = useState("");

    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase();
        if (!term) return catalog.data ?? [];
        return (catalog.data ?? []).filter((p) => {
            if (p.name.toLowerCase().includes(term) || p.providerId.toLowerCase().includes(term)) return true;
            return p.models.some((m) => m.id.toLowerCase().includes(term));
        });
    }, [catalog.data, q]);

    return (
        <div className="min-h-screen bg-background text-foreground font-mono">
            <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md">
                <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
                    <Link to="/" className="flex items-center gap-2">
                        <span className="text-sm font-bold tracking-tight">XEYGATE</span>
                        <span className="rounded-xs border border-border/70 bg-secondary/70 px-1 py-0.5 text-[8px] font-semibold text-muted-foreground/80 uppercase leading-none">Marketplace</span>
                    </Link>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" render={<Link to="/login" />} className="text-xs cursor-pointer">Sign in</Button>
                        <Button size="sm" render={<Link to="/register" />} className="text-xs cursor-pointer">Get started</Button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-5xl px-4 py-10">
                <div className="space-y-2 max-w-2xl">
                    <h1 className="text-2xl font-bold tracking-tight">API marketplace</h1>
                    <p className="text-sm text-muted-foreground">Browse models supplied by the community. Pricing shown is the admin-approved buyer-facing rate.</p>
                </div>

                <div className="mt-6 flex items-center gap-2 max-w-md">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                        <Input placeholder="Search provider or model" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
                    </div>
                    {catalog.isFetching ? <span className="text-xs text-muted-foreground">Loading…</span> : null}
                </div>

                {catalog.isError ? <p className="mt-6 text-sm text-destructive">Failed to load catalog.</p> : null}

                {!catalog.isError && filtered.length === 0 && !catalog.isPending ? (
                    <div className="mt-10 rounded-xl border border-border/60 bg-card p-8 text-center">
                        <Boxes className="mx-auto size-10 text-muted-foreground/40" />
                        <p className="mt-3 text-sm font-semibold">No listings yet</p>
                        <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">Ask a creator to add an API provider — or become a creator yourself after signing in and choosing “Sell APIs”.</p>
                        <Button size="sm" render={<Link to="/register" />} className="mt-4 gap-2 cursor-pointer">Become a creator <ArrowRight className="size-4" /></Button>
                    </div>
                ) : null}

                <div className="mt-8 grid gap-6 sm:grid-cols-2">
                    {filtered.map((p) => (
                        <div key={p.providerId} className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <p className="text-sm font-semibold leading-none">{p.name}</p>
                                    <p className="mt-1 text-[11px] text-muted-foreground">{p.providerId} · {p.protocol ?? "custom"} · {p.category ?? "api_key"}</p>
                                </div>
                                {p.ownerId ? <span className="rounded bg-secondary px-2 py-1 text-[10px] font-semibold text-muted-foreground">Creator</span> : null}
                            </div>
                            {p.models.length === 0 ? <p className="text-xs text-muted-foreground">No models listed yet.</p> : (
                                <ul className="space-y-1.5">
                                    {p.models.map((m) => (
                                        <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 bg-background px-2.5 py-2">
                                            <span className="text-xs font-medium break-all">{m.id}</span>
                                            <span className="inline-flex items-center gap-1 text-[11px]">
                                                <span title="input / 1M tokens">${m.pricing.input}</span>
                                                <span className="text-muted-foreground">/</span>
                                                <span title="output / 1M tokens">${m.pricing.output}</span>
                                                {m.override ? <BadgeCheck className="size-3 text-emerald-500" /> : null}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}
                </div>

                <div className="mt-12 flex flex-wrap gap-3">
                    <Button variant="outline" size="sm" render={<Link to="/" />} className="cursor-pointer">Back to home</Button>
                    <Button size="sm" render={<Link to="/register" />} className="cursor-pointer gap-2">Register to buy or sell <ArrowRight className="size-4" /></Button>
                </div>
            </main>
        </div>
    );
}
