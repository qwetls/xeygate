import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Boxes, Plus, RefreshCw, Store, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MyApisAddForm } from "@/components/providers/my-apis.form";

export const Route = createFileRoute("/_client/dashboard/my-apis")({
    staticData: { title: "My APIs" },
    component: MyApisPage
});

interface MyProvider {
    id: string;
    providerId: string;
    name: string;
    alias?: string;
    category?: string;
    protocol?: string;
    base_url?: string;
    enabled: boolean;
    createdAt?: number;
}

function MyApisPage() {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);

    const list = useQuery({
        queryKey: ["my-providers"],
        queryFn: () =>
            api
                .get<{ object: string; data: MyProvider[] }>("/v1/providers/mine")
                .then((res) => res.data),
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
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 font-mono">
            <header className="flex items-center justify-between border-b border-border/80 pb-5">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">My APIs</h1>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Connect the LLM providers behind your marketplace listings, then test and
                        verify each one before selling.
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
                        <Plus className="size-3" />
                        {showForm ? "Cancel" : "Add Provider"}
                    </Button>
                </div>
            </header>

            {showForm && (
                <MyApisAddForm
                    isSaving={addMut.isPending}
                    error={addMut.error instanceof Error ? addMut.error.message : null}
                    onSaved={() => setShowForm(false)}
                    onCancel={() => setShowForm(false)}
                />
            )}

            {list.isPending ? (
                <p className="text-xs text-muted-foreground">Loading...</p>
            ) : list.error ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-10 text-center">
                    <Boxes
                        className="size-8 mx-auto text-muted-foreground/50 mb-3"
                        strokeWidth={1.5}
                    />
                    <h2 className="text-sm font-semibold text-foreground">
                        Unable to load your APIs
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                        {list.error instanceof Error
                            ? list.error.message
                            : "Failed to load providers."}{" "}
                        This area is for creators — upgrade your account to sell APIs on the
                        marketplace.
                    </p>
                </div>
            ) : providers.length === 0 ? (
                <div className="rounded-xl border border-border/70 bg-secondary/20 p-10 text-center">
                    <Store
                        className="size-8 mx-auto text-muted-foreground/50 mb-3"
                        strokeWidth={1.5}
                    />
                    <h2 className="text-sm font-semibold text-foreground">No providers yet</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                        Add an LLM provider to start selling API access on the marketplace. Pick a
                        known driver, or register a custom [OI]/Anthropic endpoint.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {providers.map((p) => (
                        <div
                            key={p.id}
                            className="flex items-center justify-between rounded-xl border border-border/70 bg-card/60 p-4"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-secondary/50">
                                    <Boxes
                                        className="size-4 text-muted-foreground"
                                        strokeWidth={1.75}
                                    />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold truncate">
                                            {p.name || p.providerId}
                                        </p>
                                        {p.alias && (
                                            <span className="shrink-0 rounded-full border border-border/70 bg-secondary/40 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                                                {p.alias}/*
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                                        {p.base_url || "no base URL"}
                                        {p.protocol ? ` · ${p.protocol}` : ""}
                                        {p.category ? ` · ${p.category}` : ""}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span
                                    className={`inline-block size-2 rounded-full ${
                                        p.enabled ? "bg-emerald-500" : "bg-muted-foreground/40"
                                    }`}
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
