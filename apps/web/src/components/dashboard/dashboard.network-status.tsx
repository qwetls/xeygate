import { useState } from "react";
import { Check, Code2, Copy } from "lucide-react";
import { toast } from "sonner";
import { getGatewayBaseUrl } from "@/lib/api";

export function NetworkStatus() {
    const apiBase = getGatewayBaseUrl();
    const [copied, setCopied] = useState(false);

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(apiBase);
            setCopied(true);
            toast.success("Base URL copied", {
                description: "Compatible with OpenAI and Anthropic SDKs."
            });
            setTimeout(() => setCopied(false), 1600);
        } catch {
            toast.error("Could not copy Base URL");
        }
    }

    return (
        <section
            aria-labelledby="api-integration-title"
            className="flex h-full min-w-0 flex-col justify-between rounded-xl border border-border/80 bg-card/60 p-4 sm:p-5 lg:p-6 shadow-2xs font-mono"
        >
            {/* Top: API Integration & Base URL */}
            <div className="flex flex-col gap-4">
                {/* Header */}
                <header className="flex items-center justify-between gap-3 pb-3.5 border-b border-border/50">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/70 bg-secondary/50 text-foreground shadow-2xs">
                            <Code2 className="size-3.5" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0">
                            <h2
                                id="api-integration-title"
                                className="text-sm font-semibold tracking-tight text-foreground whitespace-nowrap"
                            >
                                API integration
                            </h2>
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                OpenAI & Anthropic compatible
                            </p>
                        </div>
                    </div>
                </header>

                {/* Base URL Card */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                        <span>Base URL</span>
                        <span className="text-[9px] font-normal lowercase tracking-normal text-muted-foreground/60">
                            click to copy
                        </span>
                    </div>

                    <div
                        onClick={() => void handleCopy()}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                void handleCopy();
                            }
                        }}
                        className="group flex items-center justify-between gap-2.5 rounded-lg border border-border/60 bg-secondary/25 px-3 py-2 transition-all hover:border-border hover:bg-secondary/45 cursor-pointer active:scale-[0.99]"
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <code className="truncate font-mono text-[11.5px] text-foreground font-medium select-all">
                                {apiBase}
                            </code>
                        </div>

                        <button
                            type="button"
                            aria-label="Copy base URL"
                            className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background/80 text-muted-foreground transition-colors group-hover:bg-secondary group-hover:text-foreground hover:border-border cursor-pointer"
                        >
                            {copied ? (
                                <Check className="size-3 text-emerald-500" />
                            ) : (
                                <Copy className="size-3" />
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}
