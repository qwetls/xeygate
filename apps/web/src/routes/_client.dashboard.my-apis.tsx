import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Boxes, Plus, Trash2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_client/dashboard/my-apis")({
    staticData: { title: "My APIs" },
    component: MyApisPage
});

interface MyProvider {
    id: string;
    providerId: string;
    name: string;
    baseUrl: string;
    models: string[];
    enabled: boolean;
}

function MyApisPage() {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);

    const list = useQuery({
        queryKey: ["my-providers"],
        queryFn: () => api.get<MyProvider[]>("/v1/providers/mine"),
        staleTime: 30_000
    });

    const addMut = useMutation({
        mutationFn: (body: Record<string, unknown>) => api.post("/v1/providers/mine", body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["my-providers"] });
            setShowForm(false);
        }
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => api.delete(`/v1/providers/mine/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-providers"] })
    });

    const providers = list.data ?? [];

    return (
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 font-mono">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-bold tracking-tight">My APIs</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Manage the API providers you sell on the marketplace.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs cursor-pointer gap-1.5"
                        onClick={() => void list.refetch()}
                    >
                        <RefreshCw className="size-3" />
                        Refresh
                    </Button>
                    <Button
                        size="sm"
                        className="h-8 text-xs cursor-pointer gap-1.5"
                        onClick={() => setShowForm((s) => !s)}
                    >
                        {showForm ? <X className="size-3" /> : <Plus className="size-3" />}
                        {showForm ? "Cancel" : "Add Provider"}
                    </Button>
                </div>
            </div>

            {showForm && <AddProviderForm onAdd={(b) => addMut.mutate(b)} isLoading={addMut.isPending} error={addMut.error} />}

            {addMut.isSuccess && (
                <p className="text-xs text-emerald-600">Provider added successfully.</p>
            )}

            {list.isPending ? (
                <p className="text-xs text-muted-foreground">Loading...</p>
            ) : providers.length === 0 ? (
                <div className="rounded-xl border border-border/70 bg-secondary/20 p-10 text-center">
                    <Boxes className="size-8 mx-auto text-muted-foreground/50 mb-3" strokeWidth={1.5} />
                    <h2 className="text-sm font-semibold text-foreground">No providers yet</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                        Add an LLM provider to start selling API access on the marketplace.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {providers.map((p) => (
                        <div
                            key={p.id}
                            className="flex items-center justify-between rounded-xl border border-border/70 bg-background p-4"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-secondary/50">
                                    <Boxes className="size-4 text-muted-foreground" strokeWidth={1.75} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold truncate">{p.name || p.providerId}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">
                                        {p.baseUrl} · {p.models.length} model{p.models.length !== 1 ? "s" : ""}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span
                                    className={`inline-block size-2 rounded-full ${p.enabled ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                                    title={p.enabled ? "Enabled" : "Disabled"}
                                />
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="size-8 text-muted-foreground hover:text-destructive cursor-pointer"
                                    disabled={deleteMut.isPending}
                                    onClick={() => {
                                        if (confirm(`Remove "${p.name || p.providerId}"?`)) {
                                            deleteMut.mutate(p.id);
                                        }
                                    }}
                                >
                                    <Trash2 className="size-3.5" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function AddProviderForm({
    onAdd,
    isLoading,
    error
}: {
    onAdd: (body: Record<string, unknown>) => void;
    isLoading: boolean;
    error: unknown;
}) {
    const [providerId, setProviderId] = useState("openai");
    const [name, setName] = useState("");
    const [baseUrl, setBaseUrl] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [modelsStr, setModelsStr] = useState("");

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        const models = modelsStr
            .split(",")
            .map((m) => m.trim())
            .filter(Boolean);
        onAdd({
            providerId: providerId.trim(),
            name: name.trim() || undefined,
            baseUrl: baseUrl.trim() || undefined,
            apiKey: apiKey.trim() || undefined,
            models
        });
    }

    return (
        <Card className="border-border/70">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm">Add Provider</CardTitle>
                <CardDescription className="text-xs">
                    Register an LLM provider to sell API access through your store.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Provider ID</label>
                        <Input
                            value={providerId}
                            onChange={(e) => setProviderId(e.target.value)}
                            placeholder="openai"
                            className="h-8 text-xs"
                            required
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Display Name</label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="My OpenAI"
                            className="h-8 text-xs"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Base URL</label>
                        <Input
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                            placeholder="https://api.openai.com/v1"
                            className="h-8 text-xs"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">API Key</label>
                        <Input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="sk-..."
                            className="h-8 text-xs"
                        />
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Models (comma-separated)
                        </label>
                        <Input
                            value={modelsStr}
                            onChange={(e) => setModelsStr(e.target.value)}
                            placeholder="gpt-4o, gpt-4o-mini"
                            className="h-8 text-xs"
                            required
                        />
                    </div>
                    {error && (
                        <p className="sm:col-span-2 text-xs text-destructive">
                            {error instanceof Error ? error.message : "Failed to add provider"}
                        </p>
                    )}
                    <div className="sm:col-span-2">
                        <Button type="submit" size="sm" className="h-8 text-xs cursor-pointer" disabled={isLoading}>
                            {isLoading ? "Adding..." : "Add Provider"}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
