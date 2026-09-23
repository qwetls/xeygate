import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Save, X } from "lucide-react";

export const Route = createFileRoute("/_client/dashboard/pricing")({
    staticData: { title: "Pricing" },
    component: CreatorPricingPage,
});

type Provider = {
    id: string;
    providerId: string;
    name: string;
    alias?: string;
    models?: string[];
};

type PricingOverride = {
    providerId: string;
    model: string;
    input: number;
    output: number;
    cached?: number;
    cacheCreation?: number;
    reasoning?: number;
};

function CreatorPricingPage() {
    const queryClient = useQueryClient();
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [form, setForm] = useState({
        input: "",
        output: "",
        cached: "",
        cacheCreation: "",
        reasoning: "",
    });

    const { data, isPending, error } = useQuery<{
        providers: Provider[];
        overrides: PricingOverride[];
    }>({
        queryKey: ["creator-pricing"],
        queryFn: () => api.get("/v1/user/pricing"),
    });

    const upsert = useMutation({
        mutationFn: (args: { providerId: string; model: string; body: Record<string, number> }) =>
            api.put("/v1/user/pricing", { ...args.body, providerId: args.providerId, model: args.model }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["creator-pricing"] });
            setEditingKey(null);
        },
        onError: (e) => alert(e instanceof ApiError ? e.message : String(e)),
    });

    const overridesMap = useMemo(() => {
        const map = new Map<string, PricingOverride>();
        for (const o of data?.overrides ?? []) map.set(`${o.providerId}:${o.model}`, o);
        return map;
    }, [data?.overrides]);

    if (isPending) return <div className="p-8 text-center text-muted-foreground">Loading pricing...</div>;
    if (error) return <div className="p-8 text-center text-destructive">Failed to load pricing: {error.message}</div>;
    if (!data?.providers?.length) return <div className="p-8 text-center text-muted-foreground">No providers found. Add a provider first.</div>;

    return (
        <div className="mx-auto w-full max-w-5xl space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Token Pricing</h1>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Set custom pricing for the models exposed by your providers. Rates are in USD per 1M tokens.
                    </p>
                </div>
            </header>

            <div className="space-y-4">
                {data.providers.map((p) => (
                    <Card key={p.id}>
                        <CardHeader>
                            <CardTitle>{p.name || p.providerId}</CardTitle>
                            <CardDescription>{p.alias ? `Alias: ${p.alias}` : `Driver: ${p.providerId}`}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {(!p.models || p.models.length === 0) ? (
                                <p className="text-xs text-muted-foreground">No models exposed.</p>
                            ) : (
                                p.models.map((model) => {
                                    const key = `${p.id}:${model}`;
                                    const isEditing = editingKey === key;
                                    const existing = overridesMap.get(key);

                                    return (
                                        <div key={model} className="flex items-center gap-4 rounded border p-3">
                                            <div className="flex-1 font-mono text-sm">{model}</div>
                                            
                                            {isEditing ? (
                                                <div className="flex items-end gap-2">
                                                    <Input placeholder="Input" className="w-20" value={form.input} onChange={(e) => setForm({...form, input: e.target.value})} />
                                                    <Input placeholder="Output" className="w-20" value={form.output} onChange={(e) => setForm({...form, output: e.target.value})} />
                                                    <Button size="icon" className="shrink-0" onClick={() => upsert.mutate({ providerId: p.id, model, body: { input: Number(form.input), output: Number(form.output) } })}>
                                                        <Save className="size-4" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="shrink-0" onClick={() => setEditingKey(null)}>
                                                        <X className="size-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-4">
                                                    <div className="text-right text-xs">
                                                        <div>In: <span className="font-mono">{existing?.input ?? "-"}</span></div>
                                                        <div>Out: <span className="font-mono">{existing?.output ?? "-"}</span></div>
                                                    </div>
                                                    <Button variant="outline" size="sm" onClick={() => {
                                                        setEditingKey(key);
                                                        setForm({
                                                            input: String(existing?.input ?? ""),
                                                            output: String(existing?.output ?? ""),
                                                            cached: String(existing?.cached ?? ""),
                                                            cacheCreation: String(existing?.cacheCreation ?? ""),
                                                            reasoning: String(existing?.reasoning ?? "")
                                                        });
                                                    }}>
                                                        <DollarSign className="mr-1 size-3" /> Edit
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
