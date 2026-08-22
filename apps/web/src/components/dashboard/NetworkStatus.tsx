import { useState } from "react";
import { Check, Cloud, Code2, Copy, Network, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { getGatewayBaseUrl } from "@/lib/api";
import { useTunnelStatus, useTunnelActions } from "@/hooks/useTunnel";

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
    const { startTunnel, stopTunnel } = useTunnelActions();
    const [tunnelBusy, setTunnelBusy] = useState(false);
    const [showTokenInput, setShowTokenInput] = useState(false);
    const [tokenInput, setTokenInput] = useState("");
    const [domainInput, setDomainInput] = useState("");

    const handleToggleTunnel = async () => {
        setTunnelBusy(true);
        try {
            if (tunnel?.running) {
                await stopTunnel();
            } else {
                const payload: { token?: string; domain?: string } = {};
                if (tokenInput.trim()) payload.token = tokenInput.trim();
                if (domainInput.trim()) payload.domain = domainInput.trim();
                const okStart = await startTunnel(payload);
                if (okStart) {
                    setShowTokenInput(false);
                    setTokenInput("");
                }
            }
            await fetchStatus();
        } finally {
            setTunnelBusy(false);
        }
    };

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
                            <span
                                className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[8.5px] ${
                                    tunnel?.running
                                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                                        : "border-border/50 bg-secondary/25 text-muted-foreground"
                                }`}
                            >
                                <span
                                    className={`size-1 rounded-full ${
                                        tunnel?.running
                                            ? "bg-emerald-500"
                                            : "bg-muted-foreground/50"
                                    }`}
                                    aria-hidden="true"
                                />
                                {tunnel?.running ? "Connected" : "Offline"}
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    if (tunnel?.running) {
                                        void handleToggleTunnel();
                                    } else if (tunnel?.tokenConfigured) {
                                        void handleToggleTunnel();
                                    } else {
                                        setShowTokenInput((v) => !v);
                                    }
                                }}
                                disabled={
                                    tunnelBusy || (tunnel !== null && !tunnel.cloudflaredAvailable)
                                }
                                title={
                                    tunnel && !tunnel.cloudflaredAvailable
                                        ? "cloudflared binary not found on server"
                                        : undefined
                                }
                                className={`inline-flex h-6 items-center gap-1 rounded-md border border-border/60 px-2 font-mono text-[9px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                    tunnel?.running
                                        ? "text-red-500 hover:bg-red-500/10"
                                        : "text-emerald-600 hover:bg-emerald-500/10"
                                }`}
                            >
                                {tunnel?.running ? (
                                    <>
                                        <Square className="size-2.5" /> Stop
                                    </>
                                ) : (
                                    <>
                                        <Play className="size-2.5" /> Start
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {showTokenInput && (
                        <div className="space-y-2 py-2.5">
                            <input
                                type="password"
                                value={tokenInput}
                                onChange={(e) => setTokenInput(e.target.value)}
                                placeholder="Cloudflare Tunnel Token (eyJ...)"
                                className="w-full rounded-md border border-border/50 bg-secondary/30 px-2.5 py-1.5 font-mono text-[10.5px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                            <input
                                type="text"
                                value={domainInput}
                                onChange={(e) => setDomainInput(e.target.value)}
                                placeholder="Custom domain (e.g. router.example.com) — optional"
                                className="w-full rounded-md border border-border/50 bg-secondary/30 px-2.5 py-1.5 font-mono text-[10.5px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                            <p className="font-mono text-[9px] leading-relaxed text-muted-foreground/70">
                                Create a tunnel in Cloudflare Zero Trust, copy its token, then map
                                your hostname to http://localhost:PORT.
                            </p>
                            <button
                                type="button"
                                onClick={() => void handleToggleTunnel()}
                                disabled={!tokenInput.trim() || tunnelBusy}
                                className="inline-flex h-6 items-center rounded-md bg-emerald-600 px-3 font-mono text-[9px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Connect Tunnel
                            </button>
                        </div>
                    )}

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
        </section>
    );
}
