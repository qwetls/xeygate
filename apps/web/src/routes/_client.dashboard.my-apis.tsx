import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
    Boxes,
    KeyRound,
    Pencil,
    Plus,
    RefreshCw,
    Store,
    Trash2,
    ChevronDown,
    ChevronUp,
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

/** Group connections by driver — one card per driver, keys collapsed inside. */
interface ProviderGroup {
    key: string;
    title: string;
    base_url?: string;
    protocol?: string;
    category?: string;
    alias?: string;
    banned: boolean;
    connections: MyProvider[];
    models: ModelInfo[];
    modelsCount: number;
}

function groupProviders(providers: MyProvider[]): ProviderGroup[] {
    const groups = new Map<string, ProviderGroup>();
    for (const p of providers) {
        // Custom endpoints share a UUID namespace per connection; group them
        // under their alias so each custom endpoint stays its own card.
        const gkey = (p.providerId || p.id).toLowerCase();
        let g = groups.get(gkey);
        if (!g) {
            g = {
                key: gkey,
                title: p.name || p.providerId,
                base_url: p.base_url,
                protocol: p.protocol,
                category: p.category,
                alias: p.alias,
                banned: false,
                connections: [],
                models: [],
                modelsCount: 0
            };
            groups.set(gkey, g);
        }
        g.connections.push(p);
        if (p.banned) g.banned = true;
        // Merge model lists (dedupe by id) — inherited base-id rows repeat
        // across bulk connections of the same driver.
        const seen = new Set(g.models.map((m) => m.id.toLowerCase()));
        for (const m of p.models ?? []) {
            if (!seen.has(m.id.toLowerCase())) {
                seen.add(m.id.toLowerCase());
                g.models.push(m);
            }
        }
        g.modelsCount = Math.max(g.modelsCount, p.modelsCount ?? 0, g.models.length);
    }
    // Show biggest groups first.
    return [...groups.values()].sort((a, b) => b.connections.length - a.connections.length);
}

function MyApisPage() {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<MyProvider | null>(null);
    const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});
    const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

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
                    {(() => {
                        const groups = groupProviders(providers);
                        return groups.map((g) => {
                            const isExpanded = expandedProviders[g.key] ?? false;
                            const keysExpanded = expandedKeys[g.key] ?? false;
                            const singleKey = g.connections.length === 1;
                            const c = g.connections[0];
                            const enabledCount = g.connections.filter((x) => x.enabled && !x.banned).length;
                            return (
                                <div
                                    key={g.key}
                                    className={`rounded-xl border bg-card/60 transition-colors ${
                                        g.banned
                                            ? "border-destructive/50 opacity-70"
                                            : "border-border/70"
                                    }`}
                                >
                                    <div className="flex items-center justify-between p-4">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-secondary/50">
                                                {g.banned ? (
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
                                                        {g.title}
                                                    </p>
                                                    {g.banned && (
                                                        <span className="shrink-0 rounded-full border border-destructive/50 bg-destructive/10 px-2 py-0.5 text-[9px] font-bold text-destructive">
                                                            BANNED
                                                        </span>
                                                    )}
                                                    {g.alias && (
                                                        <span className="shrink-0 rounded-full border border-border/70 bg-secondary/40 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                                                            {g.alias}/*
                                                        </span>
                                                    )}
                                                    {g.modelsCount > 0 && (
                                                        <span
                                                            className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                                        >
                                                            {g.modelsCount} model{g.modelsCount === 1 ? "" : "s"}
                                                        </span>
                                                    )}
                                                    {!singleKey && (
                                                        <span className="shrink-0 rounded-full border border-border/70 bg-secondary/40 px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                                                            <KeyRound className="inline size-2.5 mr-0.5 align-middle" />{g.connections.length} keys
                                                            {enabledCount < g.connections.length && (
                                                                <span className="text-muted-foreground/60 ml-1">· {enabledCount} active</span>
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                                                    {g.base_url || "no base URL"}
                                                    {g.protocol ? ` · ${g.protocol}` : ""}
                                                    {g.category ? ` · ${g.category}` : ""}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`inline-block size-2 rounded-full ${
                                                    enabledCount > 0 ? "bg-emerald-500" : "bg-muted-foreground/40"
                                                }`}
                                                title={`${enabledCount}/${g.connections.length} active`}
                                            />
                                            {!singleKey && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
                                                    disabled={showForm || Boolean(editing) || g.banned}
                                                    onClick={() => setExpandedKeys((prev) => ({ ...prev, [g.key]: !prev[g.key] }))}
                                                    title={keysExpanded ? "Collapse keys" : "Show keys"}
                                                >
                                                    {keysExpanded ? (
                                                        <ChevronUp className="size-3.5" />
                                                    ) : (
                                                        <ChevronDown className="size-3.5" />
                                                    )}
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
                                                disabled={showForm || Boolean(editing) || g.banned}
                                                onClick={() => toggleExpand(g.key)}
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
                                                disabled={showForm || Boolean(editing) || g.banned || !singleKey}
                                                onClick={() => {
                                                    if (singleKey) {
                                                        setShowForm(false);
                                                        setEditing(c);
                                                    }
                                                }}
                                                title={singleKey ? `Edit "${c.name}"` : "Select a key to edit"}
                                            >
                                                <Pencil className="size-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                className="size-8 text-muted-foreground hover:text-destructive cursor-pointer"
                                                disabled={deleteMut.isPending || g.banned || !singleKey}
                                                onClick={() => {
                                                    if (singleKey) {
                                                        if (confirm(`Remove "${c.name || c.providerId}"?`)) {
                                                            deleteMut.mutate(c.id);
                                                        }
                                                    }
                                                }}
                                            >
                                                <Trash2 className="size-3.5" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Keys list (Collapsible for bulk imports) */}
                                    {!singleKey && keysExpanded && (
                                        <div className="border-t border-border/60 bg-secondary/20 p-3">
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase mb-2">Connections</p>
                                            <div className="space-y-1.5">
                                                {g.connections.map((conn) => (
                                                    <div
                                                        key={conn.id}
                                                        className={`flex items-center justify-between rounded-lg border border-border/50 bg-card/50 px-2.5 py-1.5 ${
                                                            conn.banned ? "border-destructive/40 bg-destructive/5" : ""
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <span
                                                                className={`inline-block size-1.5 rounded-full shrink-0 ${
                                                                    conn.enabled && !conn.banned ? "bg-emerald-500" : "bg-muted-foreground/40"
                                                                }`}
                                                            />
                                                            <span className="text-[10px] font-mono text-muted-foreground truncate" title={conn.id}>
                                                                {conn.id}
                                                            </span>
                                                            {conn.banned && (
                                                                <span className="text-[8px] font-bold text-destructive">BANNED</span>
                                                            )}
                                                            {!conn.enabled && !conn.banned && (
                                                                <span className="text-[8px] font-bold text-muted-foreground/60">OFF</span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon-sm"
                                                                className="size-6 text-muted-foreground hover:text-foreground cursor-pointer"
                                                                disabled={showForm || Boolean(editing) || conn.banned}
                                                                onClick={() => {
                                                                    setShowForm(false);
                                                                    setEditing(conn);
                                                                }}
                                                                title="Edit key"
                                                            >
                                                                <Pencil className="size-3" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon-sm"
                                                                className="size-6 text-muted-foreground hover:text-destructive cursor-pointer"
                                                                disabled={deleteMut.isPending || conn.banned}
                                                                onClick={() => {
                                                                    if (confirm(`Remove connection "${conn.id}"?`)) {
                                                                        deleteMut.mutate(conn.id);
                                                                    }
                                                                }}
                                                                title="Delete key"
                                                            >
                                                                <Trash2 className="size-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Model list (Collapsible) */}
                                    {isExpanded && g.models.length > 0 && (
                                        <div className="border-t border-border/60 bg-secondary/20 p-3">
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase mb-2">Models</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                {g.models.map((m) => {
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
                                                                            providerId: c.id,
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
                        });
                    })()}
                </div>
            )}
        </div>
    );
}
