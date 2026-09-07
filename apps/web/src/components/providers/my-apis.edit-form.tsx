import { useState, type FormEvent } from "react";
import { Loader2, Plus, Store, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

export interface EditableProvider {
    id: string;
    name: string;
    enabled: boolean;
    models: string[];
}

interface MyApisEditFormProps {
    provider: EditableProvider;
    isSaving: boolean;
    error?: string | null;
    onSaved: () => void;
    onCancel: () => void;
}

const inputCls =
    "w-full rounded-[8px] border border-[var(--line)] bg-[var(--field)] px-3 py-2 text-xs text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-1 focus:ring-[var(--ink)]";
const labelCls = "font-medium text-[var(--ink)] block text-xs";
const helpCls = "text-[10px] text-[var(--ink-3)]";
const ghostBtnCls =
    "rounded-[6px] border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--field)] disabled:opacity-50 transition-colors cursor-pointer inline-flex items-center gap-1.5";
const primaryBtnCls =
    "rounded-[6px] bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5";

export function MyApisEditForm({
    provider,
    isSaving,
    error,
    onSaved,
    onCancel
}: MyApisEditFormProps) {
    const [name, setName] = useState(provider.name);
    const [enabled, setEnabled] = useState(provider.enabled);
    const [models, setModels] = useState<string[]>(provider.models ?? []);
    const [newModel, setNewModel] = useState("");
    const [formError, setFormError] = useState(error ?? "");
    const [saving, setSaving] = useState(false);

    const displayError = formError || error || "";

    function addModel(e: FormEvent) {
        e.preventDefault();
        const id = newModel.trim();
        if (!id) return;
        if (models.some((m) => m.toLowerCase() === id.toLowerCase())) {
            setFormError(`Model '${id}' is already listed.`);
            return;
        }
        setModels([...models, id]);
        setNewModel("");
        setFormError("");
    }

    function removeModel(id: string) {
        setModels(models.filter((m) => m !== id));
    }

    function save(e: FormEvent) {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) {
            setFormError("Provider name is required");
            return;
        }
        const payload: Record<string, unknown> = { name: trimmed, enabled, models };
        setSaving(true);
        setFormError("");
        api.patch(`/v1/providers/mine/${provider.id}`, payload)
            .then(() => {
                toast.success("Provider updated");
                onSaved();
            })
            .catch((err: Error) => {
                setFormError(err.message || "Failed to update provider");
                setSaving(false);
            });
    }

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
                        <span>Edit Provider</span>
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

            <form onSubmit={(e) => save(e)} className="space-y-4 p-4">
                {/* Name + enabled */}
                <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                    <div className="space-y-1.5">
                        <label className={labelCls} htmlFor="edit-provider-name">
                            Provider name *
                        </label>
                        <input
                            id="edit-provider-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="My provider"
                            className={inputCls}
                        />
                        <p className={helpCls}>
                            Shown as your storefront listing name on the marketplace.
                        </p>
                    </div>
                    <div className="space-y-1.5 sm:pt-5">
                        <span className={`${labelCls} sr-only`}>Enabled</span>
                        <button
                            type="button"
                            onClick={() => setEnabled((v) => !v)}
                            className={`inline-flex items-center gap-2 rounded-[8px] border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                                enabled
                                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : "border-[var(--line)] text-[var(--ink-3)] hover:bg-[var(--field)]"
                            }`}
                            aria-pressed={enabled}
                        >
                            <span
                                className={`inline-block size-2 rounded-full ${
                                    enabled ? "bg-emerald-500" : "bg-[var(--ink-3)]"
                                }`}
                            />
                            {enabled ? "Enabled" : "Disabled"}
                        </button>
                    </div>
                </div>

                {/* Models manager */}
                <div className="space-y-1.5">
                    <label className={labelCls}>Models for sale</label>
                    <div className="rounded-[8px] border border-[var(--line)] bg-[var(--field)]/50 p-3">
                        {models.length === 0 ? (
                            <p className="text-[11px] text-[var(--ink-3)] py-1">
                                No models listed yet — add an upstream model ID (e.g.{" "}
                                <code>gpt-4o-mini</code>, <code>claude-3-5-sonnet</code>) that this
                                gateway routes.
                            </p>
                        ) : (
                            <div className="flex flex-wrap gap-1.5">
                                {models.map((m) => (
                                    <span
                                        key={m}
                                        className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[10px] text-[var(--ink)]"
                                    >
                                        <code>{m}</code>
                                        <button
                                            type="button"
                                            onClick={() => removeModel(m)}
                                            className="text-[var(--ink-3)] hover:text-rose-500 cursor-pointer"
                                            title={`Remove ${m}`}
                                        >
                                            <X className="size-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                        <div className="mt-2.5 flex gap-2">
                            <input
                                type="text"
                                value={newModel}
                                onChange={(e) => setNewModel(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        addModel(e);
                                    }
                                }}
                                placeholder="Add a model ID…"
                                className={inputCls}
                            />
                            <button
                                type="button"
                                onClick={addModel}
                                className="rounded-[6px] border border-[var(--line)] px-3 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--field)] transition-colors cursor-pointer inline-flex items-center gap-1.5 shrink-0"
                            >
                                <Plus className="size-3" />
                                Add
                            </button>
                        </div>
                    </div>
                    <p className={helpCls}>
                        The full list replaces the previous selection when saved.
                    </p>
                </div>

                {displayError && (
                    <p className="rounded-[6px] border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-500">
                        {displayError}
                    </p>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-3">
                    <button type="button" onClick={onCancel} className={ghostBtnCls}>
                        Cancel
                    </button>
                    <button type="submit" disabled={isSaving || saving} className={primaryBtnCls}>
                        {isSaving || saving ? (
                            <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                            <Store className="size-3.5" />
                        )}
                        Save changes
                    </button>
                </div>
            </form>
        </div>
    );
}