import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
    Boxes,
    Pencil,
    Plus,
    RefreshCw,
    Store,
    Trash2,
    ChevronDown,
    ChevronUp,
    ShieldCheck,
    ShieldOff,
    Power,
    PowerOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MyApisAddForm } from "@/components/providers/my-apis.form";
import { MyApisEditForm } from "@/components/providers/my-apis.edit-form";

export const Route = createFileRoute("/_client/dashboard/my-apis")({
    staticData: { title: "My APIs" },
    component: MyApisPage
});

interface ModelInfo {
    id: string;
    disabled: boolean;
    disabledBy?: string;
}

interface MyProvider {
    id: string;
    providerId: string;
    name: string;
    alias?: string;
    category?: string;
    protocol?: string;
    base_url?: string;
    enabled: boolean;
    banned?: boolean;
    models?: ModelInfo[];
    modelsCount?: number;
    createdAt?: number;
}

function MyApisPage() {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<MyProvider | null>(null);
    const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});

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

    const updateMut = useMutation({
        mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
            api.patch(`/v1/providers/mine/${id}`, body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["my-providers"] });
            setEditing(null);
        }
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => api.delete(`/v1/providers/mine/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-providers"] })
    });

    const toggleModelMut = useMutation({
        mutationFn: ({
            providerId,
            modelId,
            action
        }: {
            providerId: string;
            modelId: string;
            action: "disable" | "enable";
        }) =>
            api.post(`/v1/providers/mine/${providerId}/models/toggle`, {
                model_id: modelId,
                action
            }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-providers"] })
    });

    const providers = list.data ?? [];

    const toggleExpand = (id: string) => {
        setExpandedProviders((prev) => ({ ...prev, [id]: !prev[id] }));
    };

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

            {editing && (
                <MyApisEditForm
                    provider={{
                        id: editing.id,
                        name: editing.name,
                        enabled: editing.enabled,
                        models: editing.models?.map(m => m.id) ?? []
                    }}
                    isSaving={updateMut.isPending}
                    error={updateMut.error instanceof Error ? updateMut.error.message : null}
                    onSaved={() => setEditing(null)}
                    onCancel={() => setEditing(null)}
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
                <div className="space-y-4">
                    {providers.map((p) => {
                        const isExpanded = expandedProviders[p.id] ?? false;
                        return (
                            <div
                                key={p.id}
                                className={`rounded-xl border bg-card/60 transition-colors ${
                                    p.banned
                                        ? "border-destructive/50 opacity-70"
                                        : "border-border/70"
                                }`}
                            >
                                <div className="flex items-center justify-between p-4">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-secondary/50">
                                            {p.banned ? (
                                                <ShieldOff
                                                    className="size-5 text-destructive"
                                                    strokeWidth={1.75}
                                                />
                                            ) : (
                                                <Boxes
                                                    className="size-5 text-muted-foreground"
                                                    strokeWidth={1.75}
                                                />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-bold truncate">
                                                    {p.name || p.providerId}
                                                </p>
                                                {p.banned && (
                                                    <span className="shrink-0 rounded-full border border-destructive/50 bg-destructive/10 px-2 py-0.5 text-[9px] font-bold text-destructive">
                                                        BANNED
                                                    </span>
                                                )}
                                                {p.alias && (
                                                    <span className="shrink-0 rounded-full border border-border/70 bg-secondary/40 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                                                        {p.alias}/*
                                                    </span>
                                                )}
                                                {p.modelsCount !== undefined && (
                                                    <span
                                                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                                                            p.modelsCount > 0
                                                                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                                                : "border border-border/70 bg-secondary/40 text-muted-foreground"
                                                        }`}
                                                    >
                                                        {p.modelsCount} model
                                                        {p.modelsCount === 1 ? "" : "s"}
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
                                                p.enabled && !p.banned ? "bg-emerald-500" : "bg-muted-foreground/40"
                                            }`}
                                            title={p.enabled ? "Enabled" : "Disabled"}
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
                                            disabled={showForm || Boolean(editing) || p.banned}
                                            onClick={() => toggleExpand(p.id)}
                                            title={isExpanded ? "Collapse models" : "Expand models"}
                                        >
                                            {isExpanded ? (
                                                <ChevronUp className="size-3.5" />
                                            ) : (
                                                <ChevronDown className="size-3.5" />
                                            )}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
                                            disabled={showForm || Boolean(editing) || p.banned}
                                            onClick={() => {
                                                setShowForm(false);
                                                setEditing(p);
                                            }}
                                            title={`Edit "${p.name || p.providerId}"`}
                                        >
                                            <Pencil className="size-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            className="size-8 text-muted-foreground hover:text-destructive cursor-pointer"
                                            disabled={deleteMut.isPending || p.banned}
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

                                {/* Model list (Collapsible) */}
                                {isExpanded && p.models && p.models.length > 0 && (
                                    <div className="border-t border-border/60 bg-secondary/20 p-3">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                            {p.models.map((m) => {
                                                const isAdminDisabled = m.disabledBy?.startsWith("admin");
                                                return (
                                                    <div
                                                        key={m.id}
                                                        className="flex items-center justify-between rounded-lg border border-border/50 bg-card/50 p-2"
                                                    >
                                                        <span className="text-[10px] font-mono truncate text-muted-foreground" title={m.id}>
                                                            {m.id}
                                                        </span>
                                                        {isAdminDisabled ? (
                                                            <span className="shrink-0 ml-2 text-[9px] font-bold text-destructive flex items-center gap-1" title="Disabled by admin">
                                                                <ShieldOff className="size-3" /> Admin
                                                            </span>
                                                        ) : (
                                                            <button
                                                                onClick={() =>
                                                                    toggleModelMut.mutate({
                                                                        providerId: p.id,
                                                                        modelId: m.id,
                                                                        action: m.disabled ? "enable" : "disable"
                                                                    })
                                                                }
                                                                disabled={toggleModelMut.isPending}
                                                                className={`shrink-0 ml-2 rounded-full p-1 transition-colors ${
                                                                    m.disabled
                                                                        ? "text-muted-foreground/50 hover:text-emerald-500"
                                                                        : "text-emerald-500 hover:text-destructive"
                                                                }`}
                                                                title={m.disabled ? "Enable model" : "Disable model"}
                                                            >
                                                                {m.disabled ? (
                                                                    <PowerOff className="size-3" />
                                                                ) : (
                                                                    <Power className="size-3" />
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
