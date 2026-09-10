import { Ban, Bot, Check, Copy, RotateCcw, Star, Store, Trash2 } from "lucide-react";
import type { ModelObject } from "@srouter/types";
import { useFavorites } from "@/hooks/useFavorites";

interface ProviderModelCardProps {
    model: ModelObject;
    copied: boolean;
    onCopy: (modelId: string) => void;
    /** Unlist: hard-remove the custom listing (row in `custom_models`). */
    onDelete?: (modelId: string) => void;
    /** List on the marketplace: register an upstream model as a custom listing. */
    onList?: (modelId: string) => void;
    /** Server-side disable: platform veto over the listing (routing + storefront). */
    onDisable?: (modelId: string) => void;
    onEnable?: (modelId: string) => void;
}

export function ProviderModelCard({
    model,
    copied,
    onCopy,
    onDelete,
    onList,
    onDisable,
    onEnable
}: ProviderModelCardProps) {
    const { isFavorite, toggleFavorite } = useFavorites();
    const isFav = isFavorite(model.id);
    const isDisabled = Boolean(model.disabled);

    return (
        <div
            className={`group flex flex-col justify-between gap-3 rounded-[12px] border bg-[var(--surface)] p-3.5 transition-all duration-150 shadow-2xs font-mono ${
                isDisabled
                    ? "border-dashed border-[var(--line-strong)] opacity-70"
                    : isFav
                      ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-500/70"
                      : "border-[var(--line)] hover:border-[var(--line-strong)]"
            }`}
        >
            {/* Header: Star + Icon + Model ID + Actions */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <button
                        type="button"
                        onClick={() => toggleFavorite(model.id)}
                        className={`p-1 rounded-[4px] transition-all cursor-pointer shrink-0 ${
                            isFav
                                ? "text-amber-500 hover:text-amber-400 bg-amber-500/10"
                                : "text-[var(--ink-3)] hover:text-amber-500 opacity-40 group-hover:opacity-100 hover:bg-[var(--field)]"
                        }`}
                        title={
                            isFav
                                ? "Favorited (Pinned) - Click to unpin"
                                : "Star model (Pin to top)"
                        }
                        aria-label={isFav ? "Unstar model" : "Star model"}
                    >
                        <Star
                            className={`size-3.5 transition-transform ${
                                isFav ? "fill-amber-500 text-amber-500 scale-110" : ""
                            }`}
                        />
                    </button>

                    <div className="flex size-6 shrink-0 items-center justify-center rounded-[4px] bg-[var(--field)] text-[var(--ink-2)]">
                        <Bot className="size-3.5" />
                    </div>

                    <span
                        className={`text-xs font-bold truncate block flex-1 ${
                            isDisabled
                                ? "text-[var(--ink-3)] line-through"
                                : isFav
                                  ? "text-amber-500 dark:text-amber-400"
                                  : "text-[var(--ink)]"
                        }`}
                        title={model.id}
                    >
                        {model.id}
                    </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    <button
                        type="button"
                        onClick={() => onCopy(model.id)}
                        className="text-[var(--ink-3)] hover:text-[var(--ink)] p-1 rounded hover:bg-[var(--field)] transition-colors cursor-pointer"
                        title="Copy Model ID"
                    >
                        {copied ? (
                            <Check className="size-3 text-emerald-500" />
                        ) : (
                            <Copy className="size-3" />
                        )}
                    </button>
                    {isDisabled && onEnable && (
                        <button
                            type="button"
                            onClick={() => onEnable(model.id)}
                            className="text-[var(--ink-3)] hover:text-emerald-500 hover:bg-emerald-500/10 p-1 rounded transition-colors cursor-pointer"
                            title="Enable model — restore routing"
                            aria-label="Enable model"
                        >
                            <RotateCcw className="size-3" />
                        </button>
                    )}
                    {!isDisabled && onDisable && (
                        <button
                            type="button"
                            onClick={() => onDisable(model.id)}
                            className="text-[var(--ink-3)] hover:text-amber-500 hover:bg-amber-500/10 p-1 rounded transition-colors cursor-pointer"
                            title="Disable model — platform veto: hides it from the storefront and blocks traffic (listing kept)"
                            aria-label="Disable model"
                        >
                            <Ban className="size-3" />
                        </button>
                    )}
                    {!model.custom && onList && (
                        <button
                            type="button"
                            onClick={() => onList(model.id)}
                            className="text-[var(--ink-3)] hover:text-emerald-500 hover:bg-emerald-500/10 p-1 rounded transition-colors cursor-pointer"
                            title="List on marketplace — publish this model in the public catalog"
                            aria-label="List on marketplace"
                        >
                            <Store className="size-3" />
                        </button>
                    )}
                    {onDelete && model.custom && (
                        <button
                            type="button"
                            onClick={() => onDelete(model.id)}
                            className="text-[var(--ink-3)] hover:text-rose-500 hover:bg-rose-500/10 p-1 rounded transition-colors cursor-pointer"
                            title="Unlist — remove the marketplace listing for this model"
                            aria-label="Unlist from marketplace"
                        >
                            <Trash2 className="size-3" />
                        </button>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="pt-2.5 border-t border-[var(--line)] flex items-center justify-between text-[10.5px]">
                <div className="flex items-center gap-2">
                    {isDisabled ? (
                        <span className="inline-flex items-center gap-1 rounded-[4px] bg-[var(--field)] px-1.5 py-0.2 text-[9.5px] font-bold text-[var(--ink-3)] border border-[var(--line-strong)]">
                            <Ban className="size-2.5" />
                            <span>Disabled</span>
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Active</span>
                        </span>
                    )}
                    {isFav && (
                        <span className="inline-flex items-center gap-0.5 rounded-[4px] bg-amber-500/10 px-1.5 py-0.2 text-[9.5px] font-bold text-amber-500 border border-amber-500/20">
                            ★ Pinned
                        </span>
                    )}
                    {model.custom ? (
                        <span
                            className="inline-flex items-center gap-1 rounded-[4px] bg-emerald-500/10 px-1.5 py-0.2 text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            title={
                                isDisabled
                                    ? "Listed on the marketplace, but hidden while disabled"
                                    : "Listed on the public marketplace"
                            }
                        >
                            <Store className="size-2.5" />
                            <span>{isDisabled ? "Listed (hidden)" : "Listed"}</span>
                        </span>
                    ) : (
                        <span
                            className="inline-flex items-center gap-1 rounded-[4px] bg-[var(--field)] px-1.5 py-0.2 text-[9.5px] font-bold text-[var(--ink-3)] border border-[var(--line)]"
                            title="Upstream model, not published to the marketplace catalog yet"
                        >
                            <Store className="size-2.5 opacity-60" />
                            <span>Not listed</span>
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
