import { useState } from "react";
import { Check, Cloud, Code2, Copy, Network } from "lucide-react";
import { toast } from "sonner";
import { getGatewayBaseUrl } from "@/lib/api";
import { useTunnelStatus, useTunnelActions } from "@/hooks/useTunnel";
import { TunnelModal } from "@/components/dashboard/TunnelModal";

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
    const [copied, setCopied] = useState(false);

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            toast.success("Base URL copied", {
                description: "Compatible with OpenAI and Anthropic clients."
            });
            setTimeout(() => setCopied(false), 1500);
        } catch {
            toast.error("Could not copy Base URL");
        }
    }

    return (
        <button
            type="button"
            onClick={() => void handleCopy()}
            aria-label={`${label} to clipboard`}
            className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-border/70 bg-background/70 px-2.5 text-[11px] font-semibold text-muted-foreground transition-[color,background-color,transform] hover:bg-secondary hover:text-foreground active:translate-y-px"
        >
            {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
            <span className={copied ? "text-emerald-500" : undefined}>
                {copied ? "Copied" : label}
            </span>
        </button>
    );
}

export function NetworkStatus() {
    const apiBase = getGatewayBaseUrl();
    const { status: tunnel, fetchStatus } = useTunnelStatus();
    const { startTunnel, stopTunnel, installCloudflared } = useTunnelActions();
    const [modalOpen, setModalOpen] = useState(false);

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
                    <span className="shrink-0 rounded-full border border-border/60 bg-secondary/40 px-2 py-0.5 font-mono text-[9px] text-muted-foreground font-medium">
                        OpenAI & Anthropic
                    </span>
                </header>

                {/* Base URL (Integrated direct display - no inner card) */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                        <span>Base URL</span>
                        <CopyButton text={apiBase} label="Copy" />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/30 px-3 py-2 transition-colors hover:border-border/80">
                        <code className="truncate font-mono text-[11.5px] text-foreground select-all">
                            {apiBase}
                        </code>
                    </div>
                </div>
            </div>

            {/* Bottom: Private Access (Integrated rows - no inner card) */}
            <div className="mt-6 pt-4 border-t border-border/50">
                <div className="flex items-center justify-between gap-3 mb-2">
                    <div>
                        <h3 className="text-xs font-semibold text-foreground">Private access</h3>
                        <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                            Secure routes for remote clients
                        </p>
                    </div>
                    <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground/80 font-semibold">
                        Optional
                    </span>
                </div>

                <div className="divide-y divide-border/35">
                    <div className="group flex items-center justify-between gap-3 py-2.5 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary/50 text-muted-foreground group-hover:text-foreground transition-colors">
                                <Cloud className="size-3.5" strokeWidth={1.75} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11.5px] font-medium text-foreground">
                                    Cloudflare Tunnel
                                </p>
                                <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                                    {tunnel?.running
                                        ? `Running${tunnel.domain ? ` · ${tunnel.domain}` : ""}`
                                        : "Expose gateway without opening ports"}
                                </p>
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setModalOpen(true)}
                                className="inline-flex h-6 items-center rounded-md border border-border/60 px-2 font-mono text-[9px] font-semibold text-sky-500 transition-colors hover:bg-sky-500/10"
                            >
                                {tunnel?.running ? "Open" : "Configure"}
                            </button>
                        </div>
                    </div>

                    <div className="group flex items-center justify-between gap-3 py-2.5 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary/50 text-muted-foreground group-hover:text-foreground transition-colors">
                                <Network className="size-3.5" strokeWidth={1.75} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11.5px] font-medium text-foreground">
                                    Tailscale
                                </p>
                                <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                                    Reach SRouter through your private mesh
                                </p>
                            </div>
                        </div>
                        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/50 bg-secondary/25 px-2 py-0.5 font-mono text-[8.5px] text-muted-foreground">
                            <span
                                className="size-1 rounded-full bg-muted-foreground/50"
                                aria-hidden="true"
                            />
                            Coming soon
                        </span>
                    </div>
                </div>
            </div>

            <TunnelModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                status={tunnel}
                onStart={startTunnel}
                onStop={stopTunnel}
                onInstall={installCloudflared}
                onRefresh={fetchStatus}
            />
        </section>
    );
}
