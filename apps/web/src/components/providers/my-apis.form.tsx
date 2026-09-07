import { useMemo, useState } from "react";
import {
    Boxes,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Globe,
    Key,
    Loader2,
    Plug,
    Search,
    Store,
    X
} from "lucide-react";
import { toast } from "sonner";
import type { ProviderProtocol } from "@srouter/types";
import { KNOWN_PROVIDER_MAP } from "@srouter/constants";
import { api } from "@/lib/api";

interface VerifyResponse {
    success: boolean;
    message: string;
    modelsCount?: number;
    models?: string[];
}

type VerifyStatus = "idle" | "testing" | "success" | "error";

const PROTOCOLS: { value: ProviderProtocol; label: string }[] = [
    { value: "openai", label: "[OI]" },
    { value: "anthropic", label: "Anthropic" }
];

/** Known drivers a creator can wire up with their own API key. */
const QUICK_ADD_DRIVERS = Object.values(KNOWN_PROVIDER_MAP).filter(
    (P) =>
        P.requires_api_key &&
        !P.requires_oauth &&
        P.protocol !== "custom" &&
        Boolean(P.base_url)
);

export interface MyApisAddFormProps {
    isSaving: boolean;
    error?: string | null;
    onSaved: () => void;
    onCancel: () => void;
}

interface ImportState {
    models: string[];
    count?: number;
    open: boolean;
}

export function MyApisAddForm({ isSaving, error, onSaved, onCancel }: MyApisAddFormProps) {
    const [mode, setMode] = useState<"driver" | "custom">("driver");

    // ── Driver (known driver) state ──
    const [driverId, setDriverId] = useState(QUICK_ADD_DRIVERS[0]?.id ?? "");
    const [driverKey, setDriverKey] = useState("");
    const [showDriverKey, setShowDriverKey] = useState(false);
    const [driverVerify, setDriverVerify] = useState<VerifyStatus>("idle");
    const [driverImport, setDriverImport] = useState<ImportState>({ models: [], open: false });
    const [driverError, setDriverError] = useState("");
    const [driverOpen, setDriverOpen] = useState(false);
    const [quickSearch, setQuickSearch] = useState("");

    // ── Custom endpoint state ──
    const [cName, setCName] = useState("");
    const [cAlias, setCAlias] = useState("");
    const [cProtocol, setCProtocol] = useState<ProviderProtocol>("openai");
    const [cBaseUrl, setCBaseUrl] = useState("");
    const [cApiKey, setCApiKey] = useState("");
    const [cShowKey, setCShowKey] = useState(false);
    const [cVerify, setCVerify] = useState<VerifyStatus>("idle");
    const [cImport, setCImport] = useState<ImportState>({ models: [], open: false });
    const [cError, setCError] = useState("");

    const driver = driverId ? KNOWN_PROVIDER_MAP[driverId] : undefined;
    const displayError = mode === "driver" ? driverError || error || "" : cError || error || "";

    const quickList = QUICK_ADD_DRIVERS;
    const filteredQuick = useMemo(() => {
        const q = quickSearch.trim().toLowerCase();
        return q
            ? quickList.filter((d) => d.name.toLowerCase().includes(q) || d.id.includes(q))
            : quickList;
    }, [quickList, quickSearch]);

    function switchMode(next: "driver" | "custom") {
        if (next === mode) return;
        setMode(next);
        // Keep credentials out of the other mode; reset transient state.
        setDriverVerify("idle");
        setDriverImport({ models: [], open: false });
        setDriverError("");
        setCVerify("idle");
        setCImport({ models: [], open: false });
        setCError("");
    }

    function applyVerified(res: VerifyResponse, setImport: (s: ImportState) => void) {
        if (res.success && res.models?.length) {
            setImport({ models: res.models, count: res.modelsCount, open: true });
        }
    }

    // ── Driver mode ─────────────────────────────────────────────────────────
    async function testDriver() {
        const key = driverKey.trim();
        if (!driver) return;
        if (!key) {
            setDriverError(`API key for ${driver.name} is required`);
            return;
        }
        setDriverError("");
        setDriverVerify("testing");
        try {
            const res = await api.post<VerifyResponse>("/v1/providers/mine/verify", {
                protocol: driver.protocol,
                base_url: driver.base_url,
                api_key: key
            });
            if (res.success) {
                setDriverVerify("success");
                applyVerified(res, setDriverImport);
                toast.success(res.message || "Connection verified.");
            } else {
                setDriverVerify("error");
                setDriverImport({ models: [], open: false });
                toast.error(res.message || "Connection test failed.");
            }
        } catch (err) {
            setDriverVerify("error");
            toast.error(err instanceof Error ? err.message : "Failed to test connection.");
        }
    }

    function addDriver() {
        const key = driverKey.trim();
        if (!driver) return;
        if (!key) {
            setDriverError(`API key for ${driver.name} is required`);
            return;
        }
        if (driverVerify !== "success") {
            setDriverError("Test the connection first — it must pass before adding.");
            return;
        }
        // Same shape as the admin "Add Key" flow: a prefixed row id keeps the
        // exact driver executor dispatch; the backend assigns this creator as owner.
        const payload: Record<string, unknown> = {
            id: `${driver.id}-${Date.now()}`,
            name: driver.name,
            category: driver.category,
            protocol: driver.protocol,
            base_url: driver.base_url,
            api_key: key
        };
        save(payload, setDriverError);
    }

    // ── Custom mode ─────────────────────────────────────────────────────────
    async function testCustom() {
        const baseUrl = cBaseUrl.trim();
        const apiKey = cApiKey.trim();
        if (!baseUrl) {
            setCError("Base URL is required");
            return;
        }
        if (!apiKey) {
            setCError("API key is required");
            return;
        }
        setCError("");
        setCVerify("testing");
        try {
            const res = await api.post<VerifyResponse>("/v1/providers/mine/verify", {
                protocol: cProtocol,
                base_url: baseUrl,
                api_key: apiKey
            });
            if (res.success) {
                setCVerify("success");
                applyVerified(res, setCImport);
                toast.success(res.message || "Connection verified.");
            } else {
                setCVerify("error");
                setCImport({ models: [], open: false });
                toast.error(res.message || "Connection test failed.");
            }
        } catch (err) {
            setCVerify("error");
            toast.error(err instanceof Error ? err.message : "Failed to test connection.");
        }
    }

    function addCustom() {
        const name = cName.trim();
        const alias = cAlias.trim().toLowerCase();
        const baseUrl = cBaseUrl.trim();
        const apiKey = cApiKey.trim();
        if (!name) {
            setCError("Provider name is required");
            return;
        }
        if (!/^[a-z0-9_-]{1,32}$/.test(alias)) {
            setCError("Alias must be 1-32 chars: lowercase letters, numbers, - or _");
            return;
        }
        if (!baseUrl) {
            setCError("Base URL is required");
            return;
        }
        if (!apiKey) {
            setCError("API key is required");
            return;
        }
        if (cVerify !== "success") {
            setCError("Test the connection first — it must pass before adding.");
            return;
        }
        // No `id`: backend generates a UUID v4 as the immutable provider id.
        const payload: Record<string, unknown> = {
            name,
            alias,
            category: "custom_provider",
            protocol: cProtocol,
            base_url: baseUrl,
            api_key: apiKey
        };
        save(payload, setCError);
    }

    function save(payload: Record<string, unknown>, setFormError: (m: string) => void) {
        return api
            .post("/v1/providers/mine", payload)
            .then(() => {
                toast.success("Provider added");
                onSaved();
            })
            .catch((err: Error) => {
                const msg = err.message || "Failed to add provider";
                setFormError(msg);
                throw err;
            });
    }

    const inputCls =
        "w-full rounded-[8px] border border-[var(--line)] bg-[var(--field)] px-3 py-2 text-xs text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-1 focus:ring-[var(--ink)]";
    const labelCls = "font-medium text-[var(--ink)] block text-xs";
    const helpCls = "text-[10px] text-[var(--ink-3)]";
    const ghostBtnCls =
        "rounded-[6px] border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--field)] disabled:opacity-50 transition-colors cursor-pointer inline-flex items-center gap-1.5";
    const primaryBtnCls =
        "rounded-[6px] bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5";

    const verifiedOk = mode === "driver" ? driverVerify === "success" : cVerify === "success";
    const importState = mode === "driver" ? driverImport : cImport;
    const setImportState = mode === "driver" ? setDriverImport : setCImport;
    const verifyState = mode === "driver" ? driverVerify : cVerify;

    return (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xl font-mono overflow-visible">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
                <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-rose-500/80 inline-block" />
                    <span className="size-2.5 rounded-full bg-amber-500/80 inline-block" />
                    <span className="size-2.5 rounded-full bg-emerald-500/80 inline-block" />
                    <h2 className="font-bold text-sm text-[var(--ink)] ml-2 flex items-center gap-1.5">
                        <Store className="size-3.5 text-orange-500" />
                        <span>Add Provider</span>
                    </h2>
                </div>
                <button
                    type="button"
                    onClick={onCancel}
                    className="text-[var(--ink-3)] hover:text-[var(--ink)] p-1 rounded hover:bg-[var(--field)] transition-colors cursor-pointer"
                >
                    <X className="size-4" />
                </button>
            </div>

            <div className="space-y-4 p-4">
                {/* Mode toggle */}
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => switchMode("driver")}
                        className={`rounded-[8px] border px-3 py-2 text-left transition-colors cursor-pointer ${
                            mode === "driver"
                                ? "border-orange-500 bg-orange-500/10"
                                : "border-[var(--line)] hover:bg-[var(--field)]"
                        }`}
                    >
                        <span className="block text-xs font-bold text-[var(--ink)]">
                            Quick-add driver
                        </span>
                        <span className="block text-[10px] text-[var(--ink-3)] mt-0.5">
                            Pick a known provider, paste its API key.
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => switchMode("custom")}
                        className={`rounded-[8px] border px-3 py-2 text-left transition-colors cursor-pointer ${
                            mode === "custom"
                                ? "border-orange-500 bg-orange-500/10"
                                : "border-[var(--line)] hover:bg-[var(--field)]"
                        }`}
                    >
                        <span className="block text-xs font-bold text-[var(--ink)]">
                            Custom endpoint
                        </span>
                        <span className="block text-[10px] text-[var(--ink-3)] mt-0.5">
                            [OI]- or Anthropic-compatible base URL.
                        </span>
                    </button>
                </div>

                {/* Error banner */}
                {displayError && (
                    <div className="rounded-[8px] border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-500">
                        {displayError}
                    </div>
                )}

                {mode === "driver" ? (
                    <div className="space-y-4">
                        {/* Driver picker */}
                        <div className="space-y-1.5">
                            <span className={labelCls}>Provider driver *</span>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDriverOpen((o) => !o);
                                        setQuickSearch("");
                                    }}
                                    className={`${inputCls} text-left flex items-center justify-between cursor-pointer`}
                                >
                                    <span className="truncate">
                                        {driver ? driver.name : "Select a provider…"}
                                    </span>
                                    <ChevronDown className="size-3.5 shrink-0 text-[var(--ink-3)]" />
                                </button>
                                {driverOpen && (
                                    <div className="absolute z-30 mt-1 w-full rounded-[8px] border border-[var(--line)] bg-[var(--surface)] p-1 shadow-xl">
                                        <div className="relative p-1">
                                            <Search className="pointer-events-none absolute left-3 top-1/2 size-3 -translate-y-1/2 text-[var(--ink-3)]" />
                                            <input
                                                type="text"
                                                value={quickSearch}
                                                onChange={(e) => setQuickSearch(e.target.value)}
                                                placeholder="Search drivers…"
                                                className={`${inputCls} pl-7`}
                                            />
                                        </div>
                                        <div className="max-h-44 overflow-y-auto">
                                            {filteredQuick.length === 0 ? (
                                                <p className="py-2 text-center text-[11px] text-[var(--ink-3)]">
                                                    No matching drivers.
                                                </p>
                                            ) : (
                                                filteredQuick.map((d) => (
                                                    <button
                                                        key={d.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setDriverId(d.id);
                                                            setDriverOpen(false);
                                                            setDriverVerify("idle");
                                                            setDriverImport({ models: [], open: false });
                                                            setDriverError("");
                                                        }}
                                                        className="flex w-full items-center justify-between gap-2 rounded-[6px] px-2.5 py-1.5 text-left text-xs text-[var(--ink)] hover:bg-[var(--field)] transition-colors cursor-pointer"
                                                    >
                                                        <span className="truncate">{d.name}</span>
                                                        <span className="shrink-0 font-mono text-[10px] text-[var(--ink-3)]">
                                                            {d.id}
                                                        </span>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {driver && (
                                <p className={helpCls}>
                                    Base URL:{" "}
                                    <code className="text-[var(--ink)]">{driver.base_url}</code>
                                </p>
                            )}
                        </div>

                        {/* API key */}
                        <div className="space-y-1.5">
                            <label className={labelCls}>API Key *</label>
                            <div className="relative">
                                <input
                                    type={showDriverKey ? "text" : "password"}
                                    placeholder="sk-..."
                                    value={driverKey}
                                    onChange={(e) => {
                                        setDriverKey(e.target.value);
                                        setDriverError("");
                                        if (driverVerify !== "idle") setDriverVerify("idle");
                                        if (driverImport.open)
                                            setDriverImport((s) => ({ ...s, open: false }));
                                    }}
                                    className={`${inputCls} pr-9`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowDriverKey((s) => !s)}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer"
                                    tabIndex={-1}
                                >
                                    <Key className="size-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => void testDriver()}
                                disabled={driverVerify === "testing" || !driverKey.trim()}
                                className={ghostBtnCls}
                            >
                                {driverVerify === "testing" ? (
                                    <>
                                        <Loader2 className="size-3.5 animate-spin" />
                                        Testing…
                                    </>
                                ) : (
                                    <>
                                        <Plug className="size-3.5" />
                                        Test Connection
                                    </>
                                )}
                            </button>
                            {driverVerify === "success" && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-500">
                                    <CheckCircle2 className="size-3.5" />
                                    Verified{driverImport.count !== undefined
                                        ? ` · ${driverImport.count} models`
                                        : ""}
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    if (driverVerify === "success" && driverImport.models.length > 0) {
                                        setDriverImport((s) => ({ ...s, open: !s.open }));
                                    } else {
                                        void testDriver();
                                    }
                                }}
                                disabled={driverVerify === "testing" || !driverKey.trim()}
                                className={ghostBtnCls}
                                title="Preview models exposed upstream (read-only)"
                            >
                                Import Models
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className={labelCls}>Provider Name *</label>
                            <input
                                type="text"
                                placeholder="e.g. My Gateway"
                                value={cName}
                                onChange={(e) => {
                                    setCName(e.target.value);
                                    setCError("");
                                }}
                                className={inputCls}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className={labelCls}>Alias (model prefix) *</label>
                            <input
                                type="text"
                                placeholder="e.g. mygateway"
                                value={cAlias}
                                onChange={(e) => {
                                    setCAlias(e.target.value);
                                    setCError("");
                                }}
                                className={inputCls}
                            />
                            <p className={helpCls}>
                                Short prefix for model IDs (e.g.{" "}
                                <code className="text-[var(--ink)]">mygateway/gpt-4</code>). 1-32
                                chars, lowercase, numbers, hyphens, underscores.
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <span className={labelCls}>Protocol *</span>
                            <div className="flex gap-1.5">
                                {PROTOCOLS.map((p) => (
                                    <button
                                        key={p.value}
                                        type="button"
                                        onClick={() => {
                                            setCProtocol(p.value);
                                            setCError("");
                                            setCVerify("idle");
                                            setCImport({ models: [], open: false });
                                        }}
                                        className={`rounded-[6px] border px-3 py-1.5 font-semibold transition-colors cursor-pointer text-xs ${
                                            cProtocol === p.value
                                                ? "border-orange-500 bg-orange-500/10 text-orange-500"
                                                : "border-[var(--line)] text-[var(--ink-3)] hover:text-[var(--ink)]"
                                        }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className={labelCls}>Base URL *</label>
                            <input
                                type="url"
                                placeholder="https://api.example.com/v1"
                                value={cBaseUrl}
                                onChange={(e) => {
                                    setCBaseUrl(e.target.value);
                                    setCError("");
                                    if (cVerify !== "idle") setCVerify("idle");
                                    if (cImport.open) setCImport((s) => ({ ...s, open: false }));
                                }}
                                className={inputCls}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className={labelCls}>API Key *</label>
                            <div className="relative">
                                <input
                                    type={cShowKey ? "text" : "password"}
                                    placeholder="sk-..."
                                    value={cApiKey}
                                    onChange={(e) => {
                                        setCApiKey(e.target.value);
                                        setCError("");
                                        if (cVerify !== "idle") setCVerify("idle");
                                        if (cImport.open) setCImport((s) => ({ ...s, open: false }));
                                    }}
                                    className={`${inputCls} pr-9`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setCShowKey((s) => !s)}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer"
                                    tabIndex={-1}
                                >
                                    <Key className="size-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => void testCustom()}
                                disabled={cVerify === "testing"}
                                className={ghostBtnCls}
                            >
                                {cVerify === "testing" ? (
                                    <>
                                        <Loader2 className="size-3.5 animate-spin" />
                                        Testing…
                                    </>
                                ) : (
                                    <>
                                        <Plug className="size-3.5" />
                                        Test Connection
                                    </>
                                )}
                            </button>
                            {cVerify === "success" && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-500">
                                    <CheckCircle2 className="size-3.5" />
                                    Verified{cImport.count !== undefined
                                        ? ` · ${cImport.count} models`
                                        : ""}
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    if (cVerify === "success" && cImport.models.length > 0) {
                                        setCImport((s) => ({ ...s, open: !s.open }));
                                    } else {
                                        void testCustom();
                                    }
                                }}
                                disabled={cVerify === "testing"}
                                className={ghostBtnCls}
                                title="Preview models exposed upstream (read-only)"
                            >
                                Import Models
                            </button>
                        </div>
                    </div>
                )}

                {/* Import preview */}
                {importState.open && importState.models.length > 0 && (
                    <ImportPreview
                        models={importState.models}
                        count={importState.count}
                        onClose={() =>
                            setImportState((s) => ({ ...s, open: false }))
                        }
                    />
                )}

                {/* Footer */}
                <div className="pt-3 border-t border-[var(--line)] flex items-center justify-end gap-2">
                    <button type="button" onClick={onCancel} className={ghostBtnCls}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => (mode === "driver" ? addDriver() : addCustom())}
                        disabled={isSaving || !verifiedOk}
                        title={verifiedOk ? undefined : "Test the connection successfully before adding"}
                        className={primaryBtnCls}
                    >
                        {isSaving ? "Adding…" : "Add Provider"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ImportPreview({
    models,
    count,
    onClose
}: {
    models: string[];
    count?: number;
    onClose: () => void;
}) {
    const [search, setSearch] = useState("");
    const [open, setOpen] = useState(true);
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return q ? models.filter((m) => m.toLowerCase().includes(q)) : models;
    }, [models, search]);

    return (
        <div className="rounded-[8px] border border-[var(--line)] bg-[var(--field)]/40 overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center justify-between px-3 py-2 text-left cursor-pointer hover:bg-[var(--field)] transition-colors"
            >
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)]">
                    {open ? (
                        <ChevronDown className="size-3.5 text-[var(--ink-3)]" />
                    ) : (
                        <ChevronRight className="size-3.5 text-[var(--ink-3)]" />
                    )}
                    <Globe className="size-3.5 text-orange-500" />
                    Importable models ({count ?? models.length})
                </span>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                    className="rounded p-0.5 text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer"
                    aria-label="Close model preview"
                >
                    <X className="size-3.5" />
                </button>
            </button>
            {open && (
                <div className="px-3 pb-2">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-[var(--ink-3)]" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Filter models…"
                            className="w-full rounded-[6px] border border-[var(--line)] bg-[var(--surface)] py-1.5 pl-7 pr-2 text-[11px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-1 focus:ring-[var(--ink)]"
                        />
                    </div>
                    <div className="mt-1.5 max-h-40 overflow-y-auto rounded-[6px] border border-[var(--line)]">
                        {filtered.length === 0 ? (
                            <p className="py-3 text-center text-[11px] text-[var(--ink-3)]">
                                No models matched your filter.
                            </p>
                        ) : (
                            <ul className="divide-y divide-[var(--line)]">
                                {filtered.map((m) => (
                                    <li
                                        key={m}
                                        className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-[var(--ink)]"
                                    >
                                        <Boxes className="size-3 shrink-0 text-[var(--ink-3)]" />
                                        <code className="truncate">{m}</code>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <p className="mt-1.5 text-[10px] text-[var(--ink-3)]">
                        These are the models exposed upstream. Listing is read-only — configure
                        what you sell from your storefront once the provider is added.
                    </p>
                </div>
            )}
        </div>
    );
}
