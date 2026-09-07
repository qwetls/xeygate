import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/pricing")({
    staticData: { title: "Pricing" },
    component: AdminPricingPage,
});

type CatalogProvider = {
    providerId: string;
    name: string;
    models: Array<{ id: string; pricing: Record<string, number>; override: boolean }>;
};
type CatalogPayload = { data?: { providers: CatalogProvider[] } & CatalogProvider[] } & { providers?: CatalogProvider[] };
type PricingOverride = { providerId: string; model: string; input: number; output: number; cached?: number; cacheCreation?: number; reasoning?: number };

function useCatalog() {
    return useQuery<CatalogProvider[]>({
        queryKey: ["admin-catalog"],
        queryFn: async () => {
            const raw = (await api.get<CatalogPayload & { data?: CatalogPayload } & { error?: unknown }>("/v1/catalog")) as any;
            const payload: CatalogPayload = raw?.data ?? raw ?? {};
            const list: CatalogProvider[] = Array.isArray(payload.providers)
                ? payload.providers
                : Array.isArray((payload as any)?.data?.providers)
                    ? (payload as any).data.providers
                    : [];
            return list;
        },
        retry: false,
    });
}

function usePricingList() {
    return useQuery<PricingOverride[]>({
        queryKey: ["admin-pricing-list"],
        queryFn: async () => {
            const raw = (await api.get<{ overrides?: PricingOverride[]; data?: { overrides?: PricingOverride[] } } & { error?: unknown }>("/v1/admin/pricing")) as any;
            const overrides: PricingOverride[] | undefined = raw?.overrides ?? raw?.data?.overrides ?? raw?.data;
            return Array.isArray(overrides) ? overrides : [];
        },
        retry: false,
    });
}

function AdminPricingPage() {
    const catalog = useCatalog();
    const pricing = usePricingList();
    const qc = useQueryClient();
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [form, setForm] = useState<{ input: string; output: string; cached: string; cacheCreation: string; reasoning: string }>({
        input: "",
        output: "",
        cached: "",
        cacheCreation: "",
        reasoning: "",
    });
    const [error, setError] = useState<string | null>(null);

    const allItems = useMemo(() => {
        const providers = catalog.data ?? [];
        const map = new Map<string, PricingOverride>();
        for (const o of pricing.data ?? []) map.set(`${o.providerId}:${o.model}`, o);
        const rows: Array<{ provider: CatalogProvider; model: string; override: PricingOverride | undefined }> = [];
        for (const p of providers) {
            for (const m of p.models) {
                rows.push({ provider: p, model: m.id, override: map.get(`${p.providerId}:${m.id}`) });
            }
        }
        return rows;
    }, [catalog.data, pricing.data]);

    const upsert = useMutation({
        mutationFn: (args: { providerId: string; model: string; body: Record<string, number | undefined> }) => {
            return api.put<{ data?: any }>("/v1/admin/pricing", {
                providerId: args.providerId,
                model: args.model,
                ...args.body,
            });
        },
        onSuccess: async () => {
            await Promise.all([
                qc.invalidateQueries({ queryKey: ["admin-pricing-list"] }),
                qc.invalidateQueries({ queryKey: ["admin-catalog"] }),
            ]);
            setEditingKey(null);
            setError(null);
        },
        onError: (e) => setError(e instanceof ApiError ? e.message : String(e)),
    });

    const del = useMutation({
        mutationFn: (args: { providerId: string; model: string }) => {
            const qs = new URLSearchParams({ providerId: args.providerId, model: args.model });
            return api.delete(`/v1/admin/pricing?${qs.toString()}`);
        },
        onSuccess: async () => {
            await Promise.all([
                qc.invalidateQueries({ queryKey: ["admin-pricing-list"] }),
                qc.invalidateQueries({ queryKey: ["admin-catalog"] }),
            ]);
            setError(null);
        },
        onError: (e) => setError(e instanceof ApiError ? e.message : String(e)),
    });

    function startEdit(providerId: string, model: string, override?: PricingOverride) {
        const key = `${providerId}:${model}`;
        setEditingKey(key);
        if (override) {
            setForm({
                input: String(override.input),
                output: String(override.output),
                cached: override.cached != null ? String(override.cached) : "",
                cacheCreation: override.cacheCreation != null ? String(override.cacheCreation) : "",
                reasoning: override.reasoning != null ? String(override.reasoning) : "",
            });
        } else {
            setForm({ input: "2", output: "8", cached: "", cacheCreation: "", reasoning: "" });
        }
        setError(null);
    }

    function submit(providerId: string, model: string) {
        const input = Number(form.input);
        const output = Number(form.output);
        if (!Number.isFinite(input) || !Number.isFinite(output)) {
            setError("input and output are required numbers");
            return;
        }
        const body: Record<string, number | undefined> = { input, output };
        const cached = form.cached.trim() ? Number(form.cached) : undefined;
        const cacheCreation = form.cacheCreation.trim() ? Number(form.cacheCreation) : undefined;
        const reasoning = form.reasoning.trim() ? Number(form.reasoning) : undefined;
        if (cached != null) body.cached = cached;
        if (cacheCreation != null) body.cacheCreation = cacheCreation;
        if (reasoning != null) body.reasoning = reasoning;
        upsert.mutate({ providerId, model, body });
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Marketplace pricing</CardTitle>
                    <CardDescription>
                        Set buyer-facing per-model pricing (USD per 1M tokens). When an override exists it governs billing; otherwise the static catalog price is used. Failing to set any override is fine — defaults apply.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {error ? <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p> : null}

                    {(catalog.isPending || pricing.isPending) ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

                    {!catalog.isPending && allItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No models to price yet. Have a creator add a provider and at least one model first — then models will appear here.</p>
                    ) : null}

                    <div className="space-y-3">
                        {allItems.map(({ provider, model, override }) => {
                            const key = `${provider.providerId}:${model}`;
                            const isEditing = editingKey === key;
                            return (
                                <div key={key} className="rounded-lg border border-border/60 bg-card px-3 py-3 space-y-2">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="space-y-0.5 min-w-0">
                                            <p className="text-sm font-semibold leading-none break-all">{model}</p>
                                            <p className="text-xs text-muted-foreground">{provider.name} · {provider.providerId}</p>
                                            <p className="text-[11px] text-muted-foreground">
                                                {override ? <>Override: <span className="font-mono">${override.input} in / ${override.output} out</span></> : <span className="text-muted-foreground/70">Using static catalog price</span>}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="cursor-pointer"
                                                onClick={() => startEdit(provider.providerId, model, override)}
                                            >
                                                {override ? "Edit" : "Set price"}
                                            </Button>
                                            {override ? (
                                                <Button size="sm" variant="ghost" className="cursor-pointer text-destructive" disabled={del.isPending} onClick={() => del.mutate({ providerId: provider.providerId, model })}>Clear override</Button>
                                            ) : null}
                                        </div>
                                    </div>

                                    {isEditing ? (
                                        <div className="rounded-md border border-border/40 bg-background p-3 space-y-3">
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <label className="flex flex-col gap-1.5 text-xs font-medium">Input / 1M<Input value={form.input} onChange={(e) => setForm((s) => ({ ...s, input: e.target.value }))} placeholder="2" /></label>
                                                <label className="flex flex-col gap-1.5 text-xs font-medium">Output / 1M<Input value={form.output} onChange={(e) => setForm((s) => ({ ...s, output: e.target.value }))} placeholder="8" /></label>
                                                <label className="flex flex-col gap-1.5 text-xs font-medium">Cached (optional)<Input value={form.cached} onChange={(e) => setForm((s) => ({ ...s, cached: e.target.value }))} placeholder="e.g. 1" /></label>
                                                <label className="flex flex-col gap-1.5 text-xs font-medium">Cache creation (optional)<Input value={form.cacheCreation} onChange={(e) => setForm((s) => ({ ...s, cacheCreation: e.target.value }))} placeholder="e.g. 2" /></label>
                                                <label className="flex flex-col gap-1.5 text-xs font-medium sm:col-span-2">Reasoning (optional)<Input value={form.reasoning} onChange={(e) => setForm((s) => ({ ...s, reasoning: e.target.value }))} placeholder="e.g. 12" /></label>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button size="sm" className="cursor-pointer" disabled={upsert.isPending} onClick={() => submit(provider.providerId, model)}>{upsert.isPending ? "Saving…" : "Save override"}</Button>
                                                <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setEditingKey(null)}>Cancel</Button>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
