import { useEffect, useMemo, useState } from "react";
import { Key, X, Layers } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";

export interface BulkConnectionFormInput {
    name?: string;
    base_url?: string;
    apiKeys: string[];
}

interface BulkConnectionFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    providerName: string;
    defaultBaseUrl?: string;
    isSaving: boolean;
    error?: string | null;
    onSubmit: (payload: BulkConnectionFormInput) => void;
}

const MAX_KEYS = 500;

function parseKeys(text: string): { unique: string[]; duplicates: number } {
    const lines = text
        .split(/[,\n]/)
        .map((line) => line.trim())
        .filter(Boolean);
    const unique = [...new Set(lines)];
    return { unique, duplicates: lines.length - unique.length };
}

export function BulkConnectionForm({
    open,
    onOpenChange,
    providerName,
    defaultBaseUrl,
    isSaving,
    error,
    onSubmit
}: BulkConnectionFormProps) {
    const [keysText, setKeysText] = useState("");
    const [name, setName] = useState("");
    const [baseUrl, setBaseUrl] = useState("");
    const [formError, setFormError] = useState("");

    useEffect(() => {
        if (open) {
            setKeysText("");
            setName("");
            setBaseUrl(defaultBaseUrl || "");
            setFormError("");
        }
    }, [open, defaultBaseUrl]);

    const parsed = useMemo(() => parseKeys(keysText), [keysText]);
    const trimmedBaseUrl = baseUrl.trim();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (parsed.unique.length === 0) {
            setFormError("Paste at least one API key — one key per line.");
            return;
        }
        if (parsed.unique.length > MAX_KEYS) {
            setFormError(`Too many keys — split the batch into ${MAX_KEYS} keys or fewer.`);
            return;
        }
        setFormError("");
        onSubmit({
            name: name.trim() || undefined,
            base_url: trimmedBaseUrl || undefined,
            apiKeys: parsed.unique
        });
    };

    const displayError = error || formError;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md w-full p-5 bg-[var(--surface)] border border-[var(--line)] rounded-xl space-y-4 shadow-xl font-mono">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                            <span className="size-2.5 rounded-full bg-rose-500/80 inline-block" />
                            <span className="size-2.5 rounded-full bg-amber-500/80 inline-block" />
                            <span className="size-2.5 rounded-full bg-emerald-500/80 inline-block" />
                        </div>
                        <h2 className="font-bold text-sm text-[var(--ink)] ml-2 flex items-center gap-1.5">
                            <Layers className="size-3.5 text-orange-500" />
                            <span>Bulk Add Keys for {providerName}</span>
                        </h2>
                    </div>

                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="text-[var(--ink-3)] hover:text-[var(--ink)] p-1 rounded hover:bg-[var(--field)] transition-colors cursor-pointer"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                <DialogHeader className="p-0 space-y-1">
                    <DialogTitle className="sr-only">
                        Bulk Add Keys for {providerName}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-[var(--ink-3)]">
                        Tempel banyak API Key sekaligus — satu key per baris. Setiap key menjadi
                        connection tersendiri di pool {providerName} (round-robin otomatis ikut
                        tersebar).
                    </DialogDescription>
                </DialogHeader>

                {displayError && (
                    <div className="rounded-[8px] border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-500">
                        {displayError}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                    <div className="space-y-1.5">
                        <label
                            htmlFor="bulk-api-keys"
                            className="font-medium text-[var(--ink)] block"
                        >
                            API Keys *
                        </label>
                        <textarea
                            id="bulk-api-keys"
                            rows={7}
                            placeholder={"sk-key-1\nsk-key-2\nsk-key-3"}
                            value={keysText}
                            onChange={(e) => {
                                setKeysText(e.target.value);
                                if (formError) setFormError("");
                            }}
                            autoFocus
                            spellCheck={false}
                            className="w-full rounded-[8px] border border-[var(--line)] bg-[var(--field)] px-3 py-2 text-xs text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-1 focus:ring-[var(--ink)] resize-y"
                        />
                        <p className="text-[10.5px] text-[var(--ink-3)]">
                            {parsed.unique.length > 0 ? (
                                <>
                                    <span className="text-[var(--ink)] font-semibold">
                                        {parsed.unique.length} key
                                        {parsed.unique.length === 1 ? "" : "s"}
                                    </span>{" "}
                                    siap ditambahkan
                                    {parsed.duplicates > 0 &&
                                        ` · ${parsed.duplicates} duplikat diabaikan`}
                                </>
                            ) : (
                                "Satu key per baris (koma juga diterima)."
                            )}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        <div className="space-y-1.5">
                            <label
                                htmlFor="bulk-conn-name"
                                className="font-medium text-[var(--ink)] flex items-center gap-1"
                            >
                                <Key className="size-3 text-orange-500" />
                                Connection Name
                            </label>
                            <input
                                id="bulk-conn-name"
                                type="text"
                                placeholder={`${providerName} Key`}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full rounded-[8px] border border-[var(--line)] bg-[var(--field)] px-3 py-2 text-xs text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-1 focus:ring-[var(--ink)]"
                            />
                            <p className="text-[10.5px] text-[var(--ink-3)]">
                                Diberi nomor otomatis per key (cth. “… Key #2”).
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <label
                                htmlFor="bulk-conn-base-url"
                                className="font-medium text-[var(--ink)]"
                            >
                                Base URL
                            </label>
                            <input
                                id="bulk-conn-base-url"
                                type="url"
                                placeholder="https://api.example.com/v1"
                                value={baseUrl}
                                onChange={(e) => setBaseUrl(e.target.value)}
                                className="w-full rounded-[8px] border border-[var(--line)] bg-[var(--field)] px-3 py-2 text-xs text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-1 focus:ring-[var(--ink)]"
                            />
                        </div>
                    </div>

                    <div className="pt-3 border-t border-[var(--line)] flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            className="rounded-[6px] border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving || parsed.unique.length === 0}
                            className="rounded-[6px] bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs"
                        >
                            {isSaving
                                ? "Adding…"
                                : `Add ${parsed.unique.length || ""} Key${parsed.unique.length === 1 ? "" : "s"}`}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
