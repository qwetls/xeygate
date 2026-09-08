import { useMemo, useState } from "react";
import { Bot, Boxes, Check, ChevronDown, ChevronRight, Globe, Loader2, Plus, RefreshCw, Search, X } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface VerifyResponse {
    success: boolean;
    message: string;
    modelsCount?: number;
    models?: string[];
}

interface ManageModelsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    providerName: string;
    protocol: string;
    baseUrl?: string;
    /** Full model ids already visible on the provider detail page. */
    existingModelIds: string[];
    isAdding: boolean;
    isBulkDeleting: boolean;
    onAddModels: (modelIds: string[]) => void;
    onDeleteModels: (modelIds: string[]) => void;
}

export function ManageModelsDialog({
    open,
    onOpenChange,
    providerName,
    protocol,
    baseUrl,
    existingModelIds,
    isAdding,
    isBulkDeleting,
    onAddModels,
    onDeleteModels
}: ManageModelsDialogProps) {
    const [manualId, setManualId] = useState("");
    const [manualError, setManualError] = useState("");
    const [imported, setImported] = useState<string[] | null>(null);
    const [importing, setImporting] = useState(false);
    const [importError, setImportError] = useState("");
    const [showList, setShowList] = useState(true);
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<string[]>([]);

    const existingSet = useMemo(() => {
        const set = new Set<string>();
        for (const id of existingModelIds) {
            set.add(id.toLowerCase());
            // Live/custom rows may carry an "alias/" or "baseId/" prefix —
            // compare bare ids so already-listed models stay unselectable.
            if (id.includes("/")) set.add(id.slice(id.indexOf("/") + 1).toLowerCase());
        }
        return set;
    }, [existingModelIds]);

    const resetImport = () => {
        setImported(null);
        setImportError("");
        setSearch("");
        setSelected([]);
    };

    const handleFetchModels = async () => {
        setImporting(true);
        setImportError("");
        try {
            const result = await api.post<VerifyResponse>("/v1/providers/verify", {
                protocol,
                base_url: baseUrl || undefined
            });
            if (!result.success || !result.models || result.models.length === 0) {
                setImportError(result.message || "No models returned by the upstream endpoint");
                setImported(null);
            } else {
                setImported(result.models);
            }
        } catch (err) {
            setImportError(err instanceof Error ? err.message : "Failed to fetch upstream models");
            setImported(null);
        } finally {
            setImporting(false);
        }
    };

    const filteredImported = useMemo(() => {
        if (!imported) return [];
        const q = search.trim().toLowerCase();
        return q ? imported.filter((m) => m.toLowerCase().includes(q)) : imported;
    }, [imported, search]);

    const newSelectable = useMemo(
        () => filteredImported.filter((m) => !existingSet.has(m.toLowerCase())),
        [filteredImported, existingSet]
    );

    const toggleSelect = (m: string) => {
        setSelected((prev) => (prev.includes(m) ? prev.filter((id) => id !== m) : [...prev, m]));
    };

    const selectAllVisible = () => setSelected(newSelectable);

    const handleManualSubmit = () => {
        const trimmed = manualId.trim();
        if (!trimmed) {
            setManualError("Model ID is required");
            return;
        }
        if (existingSet.has(trimmed.toLowerCase())) {
            setManualError(`"${trimmed}" is already listed for this provider`);
            return;
        }
        setManualError("");
        onAddModels([trimmed]);
        setManualId("");
    };

    const handleAddSelected = () => {
        if (selected.length === 0) return;
        onAddModels(selected);
        setSelected([]);
        setImported(null);
    };

    const handleRemoveSelected = () => {
        if (selected.length === 0) return;
        onDeleteModels(selected);
        setSelected([]);
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) {
                    setManualId("");
                    setManualError("");
                    resetImport();
                }
                onOpenChange(next);
            }}
        >
            <DialogContent className="sm:max-w-lg font-mono">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-sm">
                        <Bot className="size-4 text-amber-500" />
                        Manage Models — {providerName}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Fetch the models this provider's connection actually exposes, tick the ones
                        to list, or register a model manually. Existing custom models can be
                        selected and removed below.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-1">
                    {/* Upstream import */}
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs cursor-pointer gap-1.5"
                            disabled={importing}
                            onClick={() => void handleFetchModels()}
                        >
                            {importing ? (
                                <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                                <Globe className="size-3.5" />
                            )}
                            <span>Fetch from upstream</span>
                        </Button>
                        {imported && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs cursor-pointer gap-1.5"
                                onClick={resetImport}
                            >
                                <RefreshCw className="size-3.5" />
                                <span>Reset</span>
                            </Button>
                        )}
                    </div>
                    {importError && <p className="text-[11px] text-destructive">{importError}</p>}

                    {imported && (
                        <div className="rounded-lg border border-border/70 bg-secondary/30 overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setShowList((o) => !o)}
                                className="flex w-full items-center justify-between px-3 py-2 text-left cursor-pointer hover:bg-secondary/50 transition-colors"
                            >
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                                    {showList ? (
                                        <ChevronDown className="size-3.5 text-muted-foreground" />
                                    ) : (
                                        <ChevronRight className="size-3.5 text-muted-foreground" />
                                    )}
                                    <Boxes className="size-3.5 text-amber-500" />
                                    Importable models ({imported.length})
                                </span>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        resetImport();
                                    }}
                                    className="rounded p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                                    aria-label="Close model preview"
                                >
                                    <X className="size-3.5" />
                                </button>
                            </button>
                            {showList && (
                                <div className="px-3 pb-2.5">
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
                                        <input
                                            type="text"
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Filter models…"
                                            className="w-full rounded-md border border-border/70 bg-background py-1.5 pl-7 pr-2 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                                        />
                                    </div>
                                    <div className="mt-1.5 flex items-center justify-between">
                                        <span className="text-[10px] font-semibold text-foreground">
                                            {selected.length} selected
                                        </span>
                                        <div className="flex items-center gap-2.5">
                                            <button
                                                type="button"
                                                onClick={selectAllVisible}
                                                className="text-[10px] font-semibold text-amber-500 hover:text-amber-400 cursor-pointer"
                                            >
                                                Select all new
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSelected([])}
                                                disabled={selected.length === 0}
                                                className="text-[10px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40 cursor-pointer"
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mt-1.5 max-h-48 overflow-y-auto rounded-md border border-border/70">
                                        {filteredImported.length === 0 ? (
                                            <p className="py-3 text-center text-[11px] text-muted-foreground">
                                                No models matched your filter.
                                            </p>
                                        ) : (
                                            <ul className="divide-y divide-border/70">
                                                {filteredImported.map((m) => {
                                                    const isExisting = existingSet.has(m.toLowerCase());
                                                    const isSelected = selected.includes(m);
                                                    return (
                                                        <li
                                                            key={m}
                                                            className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-foreground"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                disabled={isExisting}
                                                                onChange={() => toggleSelect(m)}
                                                                className="size-3 shrink-0 accent-amber-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                                            />
                                                            <Boxes className="size-3 shrink-0 text-muted-foreground" />
                                                            <code className="truncate flex-1">{m}</code>
                                                            {isExisting && (
                                                                <span className="inline-flex items-center gap-0.5 rounded-[4px] bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                                                                    <Check className="size-2.5" />
                                                                    Listed
                                                                </span>
                                                            )}
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Manual add */}
                    <div>
                        <div className="flex items-center gap-2">
                            <Input
                                placeholder="e.g. gemini-3.0-ultra-preview"
                                value={manualId}
                                onChange={(e) => setManualId(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleManualSubmit();
                                }}
                                className="h-8 font-mono text-xs"
                            />
                            <Button
                                type="button"
                                size="sm"
                                className="h-8 text-xs cursor-pointer gap-1.5 shrink-0"
                                disabled={isAdding}
                                onClick={handleManualSubmit}
                            >
                                {isAdding ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                    <Plus className="size-3.5" />
                                )}
                                <span>Add</span>
                            </Button>
                        </div>
                        {manualError && <p className="mt-1 text-[11px] text-destructive">{manualError}</p>}
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs cursor-pointer"
                        onClick={() => onOpenChange(false)}
                    >
                        Close
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant={selected.length > 0 ? "destructive" : "outline"}
                        className="h-8 text-xs cursor-pointer gap-1.5"
                        disabled={selected.length === 0 || isBulkDeleting}
                        onClick={handleRemoveSelected}
                    >
                        {isBulkDeleting && <Loader2 className="size-3.5 animate-spin" />}
                        Remove selected ({selected.length})
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        className="h-8 text-xs cursor-pointer gap-1.5"
                        disabled={selected.length === 0 || isAdding}
                        onClick={handleAddSelected}
                    >
                        {isAdding && <Loader2 className="size-3.5 animate-spin" />}
                        Add selected ({selected.length})
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
