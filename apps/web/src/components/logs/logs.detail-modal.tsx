import { useState } from "react";
import {
    AlertCircle,
    Check,
    CheckCircle2,
    Clock,
    Copy,
    Cpu,
    Coins,
    KeyRound,
    Network,
    ScrollText,
    Zap,
    X,
    Calendar,
    Server,
    Globe,
    Code2,
    ChevronDown,
    ChevronRight,
    Bot
} from "lucide-react";
import type { RequestLogEntry } from "@srouter/types";
import {
    Dialog,
    DialogContent,
    DialogTitle
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatTime } from "@/utils/format";
import { parseUserAgent } from "@/utils/agent-detector";

interface LogDetailModalProps {
    log: RequestLogEntry | null;
    requireApiKey?: boolean;
    onClose: () => void;
}

export function LogDetailModal({ log, requireApiKey = false, onClose }: LogDetailModalProps) {
    const [copied, setCopied] = useState(false);
    const [showRawJson, setShowRawJson] = useState(false);

    const isOk = (log?.statusCode ?? 0) >= 200 && (log?.statusCode ?? 0) < 300;
    const clientInfo = parseUserAgent(log?.userAgent);

    const handleCopyPayload = async () => {
        if (!log) return;
        try {
            await navigator.clipboard.writeText(JSON.stringify(log, null, 2));
            setCopied(true);
            toast.success("Log payload copied");
            setTimeout(() => setCopied(false), 1600);
        } catch {
            toast.error("Failed to copy payload");
        }
    };

    const costBreakdown = log?.costBreakdown;
    const totalCost = costBreakdown?.totalCost ?? log?.estimatedCost ?? 0;
    const inputCost = costBreakdown?.inputCost ?? 0;
    const outputCost = costBreakdown?.outputCost ?? 0;
    const cacheReadCost = costBreakdown?.cacheReadCost ?? 0;
    const cacheCreationCost = costBreakdown?.cacheCreationCost ?? 0;

    const cachedTokens = log?.cachedTokens ?? 0;
    const cacheCreationTokens = log?.cacheCreationTokens ?? 0;
    const reasoningTokens = log?.reasoningTokens ?? 0;

    return (
        <Dialog open={!!log} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl max-h-[85vh] p-0 flex flex-col font-mono gap-0 overflow-hidden border border-border/80 shadow-2xl bg-card">
                {log && (
                    <>
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 bg-secondary/20 shrink-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="flex size-7 items-center justify-center rounded-lg bg-secondary/50 text-foreground border border-border/60 shrink-0">
                                    <ScrollText className="size-3.5" />
                                </div>
                                <div className="min-w-0">
                                    <DialogTitle className="text-sm font-bold text-foreground truncate">
                                        Request Details
                                    </DialogTitle>
                                    <p className="text-[10px] text-muted-foreground font-mono truncate">
                                        {log.id}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <span
                                    className={[
                                        "font-mono text-[10px] px-2 py-0.5 rounded border font-semibold tabular-nums inline-flex items-center gap-1",
                                        isOk
                                            ? "bg-secondary/40 text-foreground border-border/60"
                                            : "bg-destructive/10 text-destructive border-destructive/30"
                                    ].join(" ")}
                                >
                                    {isOk ? <CheckCircle2 className="size-3 opacity-70" /> : <AlertCircle className="size-3" />}
                                    {log.statusCode} {isOk ? "OK" : "ERROR"}
                                </span>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 cursor-pointer transition-colors"
                                >
                                    <X className="size-4" />
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-5 overflow-y-auto space-y-4 text-xs">
                            {/* Summary Metadata Table */}
                            <div className="rounded-xl border border-border/70 bg-card/40 divide-y divide-border/40 shadow-2xs">
                                <div className="flex items-center justify-between px-3.5 py-2.5 text-[11px]">
                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                        <Calendar className="size-3 text-muted-foreground/70" /> Timestamp
                                    </span>
                                    <span className="text-foreground font-medium">
                                        {new Date(log.createdAt).toLocaleDateString()} {formatTime(log.createdAt, true)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between px-3.5 py-2.5 text-[11px]">
                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                        <Server className="size-3 text-muted-foreground/70" /> Provider & Model
                                    </span>
                                    <div className="flex items-center gap-1.5 text-right">
                                        <span className="px-1.5 py-0.2 rounded bg-secondary/50 text-muted-foreground border border-border/50 text-[10px]">
                                            {log.providerId}
                                        </span>
                                        <span className="text-foreground font-semibold">{log.model}</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between px-3.5 py-2.5 text-[11px]">
                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                        <Bot className="size-3 text-muted-foreground/70" /> Client Agent
                                    </span>
                                    <div className="flex items-center gap-2 max-w-[280px]">
                                        <span className={[
                                            "font-medium truncate",
                                            clientInfo.isKnownAgent ? "text-foreground font-semibold" : "text-foreground"
                                        ].join(" ")} title={clientInfo.raw || clientInfo.name}>
                                            {clientInfo.name}
                                        </span>
                                        {clientInfo.isKnownAgent && (
                                            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded border border-border/60 bg-secondary/50 text-muted-foreground font-semibold shrink-0">
                                                Agent
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between px-3.5 py-2.5 text-[11px]">
                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                        <Globe className="size-3 text-muted-foreground/70" /> Client IP & Latency
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground">{log.ipAddress || "127.0.0.1"}</span>
                                        <span className="text-border">·</span>
                                        <span className="text-foreground font-semibold tabular-nums">{log.latencyMs} ms</span>
                                    </div>
                                </div>
                                {(requireApiKey || log.apiKeyId) && (
                                    <div className="flex items-center justify-between px-3.5 py-2.5 text-[11px]">
                                        <span className="text-muted-foreground flex items-center gap-1.5">
                                            <KeyRound className="size-3 text-muted-foreground/70" /> Auth Key
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-foreground font-medium">{log.apiKeyName || "Virtual Key"}</span>
                                            <span className="text-[10px] text-muted-foreground">({log.apiKeyId || "bypass"})</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Routing & Cascade Fallback info */}
                            {(log.resolvedModel && log.resolvedModel !== log.model) && (
                                <div className="rounded-xl border border-border/70 bg-secondary/15 p-3 space-y-1">
                                    <div className="flex items-center gap-1.5 font-semibold text-foreground text-[11px]">
                                        <Zap className="size-3 text-muted-foreground" />
                                        Auto-Routing
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                        Requested <span className="text-foreground">{log.model}</span> ↳ routed to <span className="font-semibold text-foreground">{log.resolvedModel}</span>
                                    </p>
                                </div>
                            )}

                            {log.fallbackOccurred && (
                                <div className="rounded-xl border border-border/70 bg-secondary/15 p-3 space-y-1">
                                    <div className="flex items-center gap-1.5 font-semibold text-foreground text-[11px]">
                                        <Network className="size-3 text-muted-foreground" />
                                        Cascade Fallback
                                    </div>
                                    {log.fallbackReason && (
                                        <p className="text-[11px] text-muted-foreground italic">
                                            {log.fallbackReason}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Token & Cost Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Token Breakdown */}
                                <div className="rounded-xl border border-border/70 bg-card/40 p-3.5 space-y-2.5">
                                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                                        <span className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground flex items-center gap-1.5">
                                            <Cpu className="size-3" /> Token Consumption
                                        </span>
                                        <span className="font-semibold text-foreground tabular-nums">
                                            {log.totalTokens.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="space-y-1 text-[11px]">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Prompt Input</span>
                                            <span className="tabular-nums text-foreground">{log.promptTokens.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Completion Output</span>
                                            <span className="tabular-nums text-foreground">{log.completionTokens.toLocaleString()}</span>
                                        </div>
                                        {cachedTokens > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Cache Read</span>
                                                <span className="tabular-nums text-foreground">{cachedTokens.toLocaleString()}</span>
                                            </div>
                                        )}
                                        {cacheCreationTokens > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Cache Write</span>
                                                <span className="tabular-nums text-foreground">{cacheCreationTokens.toLocaleString()}</span>
                                            </div>
                                        )}
                                        {reasoningTokens > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Reasoning (CoT)</span>
                                                <span className="tabular-nums text-foreground">{reasoningTokens.toLocaleString()}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Cost Breakdown */}
                                <div className="rounded-xl border border-border/70 bg-card/40 p-3.5 space-y-2.5">
                                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                                        <span className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground flex items-center gap-1.5">
                                            <Coins className="size-3" /> Cost Accounting
                                        </span>
                                        <span className="font-semibold text-foreground tabular-nums">
                                            ${totalCost.toFixed(5)}
                                        </span>
                                    </div>
                                    <div className="space-y-1 text-[11px]">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Input</span>
                                            <span className="tabular-nums text-foreground">${inputCost.toFixed(5)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Output</span>
                                            <span className="tabular-nums text-foreground">${outputCost.toFixed(5)}</span>
                                        </div>
                                        {cacheReadCost > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Cache Read</span>
                                                <span className="tabular-nums text-foreground">${cacheReadCost.toFixed(5)}</span>
                                            </div>
                                        )}
                                        {cacheCreationCost > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Cache Creation</span>
                                                <span className="tabular-nums text-foreground">${cacheCreationCost.toFixed(5)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Collapsible Developer Payload */}
                            <div className="rounded-xl border border-border/60 bg-card/30 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setShowRawJson(!showRawJson)}
                                    className="w-full flex items-center justify-between px-3.5 py-2.5 text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                                >
                                    <span className="flex items-center gap-1.5">
                                        <Code2 className="size-3" />
                                        Developer Payload
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                void handleCopyPayload();
                                            }}
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border/60 bg-secondary/40 text-[10px] hover:text-foreground transition-colors"
                                        >
                                            {copied ? <Check className="size-2.5" /> : <Copy className="size-2.5" />}
                                            <span>{copied ? "Copied" : "Copy"}</span>
                                        </button>
                                        {showRawJson ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                                    </div>
                                </button>
                                {showRawJson && (
                                    <pre className="p-3 border-t border-border/50 bg-secondary/20 font-mono text-[10.5px] text-muted-foreground overflow-x-auto max-h-48 leading-relaxed">
                                        <code>{JSON.stringify(log, null, 2)}</code>
                                    </pre>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
