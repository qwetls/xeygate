import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Copy, Check, Trash2, Plus, KeyRound, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/_client/dashboard/keys")({
    component: ClientKeysPage
});

interface ApiKey {
    id: string;
    name: string;
    key: string;
    enabled: boolean;
    usageTokens: number;
    creditLimit: number;
    usageCost: number;
    createdAt: number;
}

function ClientKeysPage() {
    const queryClient = useQueryClient();
    const [newKeyName, setNewKeyName] = useState("");
    const [showCreate, setShowCreate] = useState(false);

    const { data, isPending } = useQuery({
        queryKey: ["user-keys"],
        queryFn: () => api.get<{ keys: ApiKey[] }>("/v1/users/keys")
    });

    const createMutation = useMutation({
        mutationFn: (name: string) => api.post<{ id: string; name: string; key: string }>("/v1/users/keys", { name }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["user-keys"] });
            setNewKeyName("");
            setShowCreate(false);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (keyId: string) => api.delete(`/v1/users/keys/${keyId}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user-keys"] })
    });

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 font-mono">
            <header className="flex items-center justify-between border-b border-border/80 pb-5">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">API Keys</h1>
                    <p className="mt-1 text-xs text-muted-foreground">Create and manage your API keys for gateway access.</p>
                </div>
                <Button size="sm" className="gap-1.5 text-xs cursor-pointer" onClick={() => setShowCreate(!showCreate)}>
                    <Plus className="size-3" />
                    Create Key
                </Button>
            </header>

            {showCreate && (
                <Card>
                    <CardContent className="pt-6">
                        <form
                            className="flex gap-2"
                            onSubmit={(e) => { e.preventDefault(); if (newKeyName.trim()) createMutation.mutate(newKeyName.trim()); }}
                        >
                            <Input
                                value={newKeyName}
                                onChange={(e) => setNewKeyName(e.target.value)}
                                placeholder="Key name (e.g. Production, Dev)"
                                className="flex-1 text-xs"
                                autoFocus
                                maxLength={64}
                            />
                            <Button type="submit" size="sm" disabled={createMutation.isPending || !newKeyName.trim()} className="text-xs cursor-pointer">
                                {createMutation.isPending ? "Creating..." : "Create"}
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => setShowCreate(false)} className="text-xs cursor-pointer">Cancel</Button>
                        </form>
                        {createMutation.isError && (
                            <p className="mt-2 text-xs text-destructive">{createMutation.error instanceof ApiError ? createMutation.error.message : "Failed to create key"}</p>
                        )}
                    </CardContent>
                </Card>
            )}

            {isPending ? (
                <div className="text-center text-xs text-muted-foreground py-8">Loading keys...</div>
            ) : !data?.keys.length ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <KeyRound className="mx-auto size-8 text-muted-foreground/40 mb-3" />
                        <p className="text-sm font-medium text-foreground">No API keys yet</p>
                        <p className="mt-1 text-xs text-muted-foreground">Create your first key to start making requests.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {data.keys.map((k) => (
                        <KeyCard key={k.id} apiKeyKey={k} onDelete={() => deleteMutation.mutate(k.id)} isDeleting={deleteMutation.isPending} />
                    ))}
                </div>
            )}
        </div>
    );
}

function KeyCard({ apiKeyKey, onDelete, isDeleting }: { apiKeyKey: ApiKey; onDelete: () => void; isDeleting: boolean }) {
    const [visible, setVisible] = useState(false);
    const [copied, setCopied] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    function handleCopy() {
        navigator.clipboard.writeText(apiKeyKey.key);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    const maskedKey = apiKeyKey.key.slice(0, 7) + "..." + apiKeyKey.key.slice(-4);

    return (
        <Card>
            <CardContent className="py-4 px-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">{apiKeyKey.name}</span>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${apiKeyKey.enabled ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-destructive/10 text-destructive"}`}>
                                {apiKeyKey.enabled ? "Active" : "Disabled"}
                            </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                            <code className="rounded bg-secondary/50 px-2 py-1 text-[11px] text-foreground/80 font-mono">
                                {visible ? apiKeyKey.key : maskedKey}
                            </code>
                            <button type="button" onClick={() => setVisible(!visible)} className="p-1 rounded hover:bg-secondary cursor-pointer">
                                {visible ? <EyeOff className="size-3 text-muted-foreground" /> : <Eye className="size-3 text-muted-foreground" />}
                            </button>
                            <button type="button" onClick={handleCopy} className="p-1 rounded hover:bg-secondary cursor-pointer">
                                {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3 text-muted-foreground" />}
                            </button>
                        </div>
                        <div className="mt-2 flex gap-4 text-[10px] text-muted-foreground">
                            <span>Tokens: {(apiKeyKey.usageTokens ?? 0).toLocaleString()}</span>
                            <span>Cost: ${(apiKeyKey.usageCost ?? 0).toFixed(4)}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {confirmDelete ? (
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] text-destructive">Sure?</span>
                                <Button variant="destructive" size="sm" className="h-6 text-[10px] px-2 cursor-pointer" onClick={onDelete} disabled={isDeleting}>Yes</Button>
                                <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 cursor-pointer" onClick={() => setConfirmDelete(false)}>No</Button>
                            </div>
                        ) : (
                            <button type="button" onClick={() => setConfirmDelete(true)} className="p-1.5 rounded hover:bg-destructive/10 cursor-pointer">
                                <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
                            </button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
