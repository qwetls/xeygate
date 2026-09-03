import { useState } from "react";
import {
    AlertCircle,
    Check,
    CheckCircle2,
    Clock,
    Copy,
    Cpu,
    Coins,
    DollarSign,
    Layers,
    KeyRound,
    Network,
    ScrollText,
    Zap
} from "lucide-react";
import type { RequestLogEntry } from "@srouter/types";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface LogDetailSheetProps {
    log: RequestLogEntry | null;
    requireApiKey?: boolean;
    onClose: () => void;
}

export function LogDetailSheet({ log, requireApiKey = false, onClose }: LogDetailSheetProps) {
    const [copied, setCopied] = useState(false);

    const isOk = (log?.statusCode ?? 0) >= 200 && (log?.statusCode ?? 0) < 300;
    const is4xx = (log?.statusCode ?? 0) >= 400 && (log?.statusCode ?? 0) < 500;

    const handleCopyPayload = async () => {
        if (!log) return;
        try {
            await navigator.clipboard.writeText(JSON.stringify(log, null, 2));
            setCopied(true);
            toast.success("Log JSON payload copied");
            setTimeout(() => setCopied(false), 1600);
        } catch {
            toast.error("Failed to copy payload");
        }
    };

    // Calculate itemized cost metrics
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
        <Sheet open={!!log} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="sm:max-w-xl w-full p-6 space-y-6 overflow-y-auto font-mono">
                {log && (
                    <>
                        <SheetHeader className="p-0 border-b border-border/60 pb-4">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 shadow-2xs">
                                        <ScrollText className="size-4" />
                                    </div>
                                    <div>
                                        <SheetTitle className="text-sm font-bold text-foreground">
                                            Request Telemetry & Audit
                                        </SheetTitle>
                                        <SheetDescription className="font-mono text-[11px] text-muted-foreground truncate max-w-[280px]">
                                            ID: {log.id}
                                        </SheetDescription>
                                    </div>
                                </div>
                                <Badge
                                    variant={isOk ? "emerald" : is4xx ? "amber" : "destructive"}
                                    className="font-mono text-xs px-2.5 py-0.5 font-semibold"
                                >
                                    {isOk ? <CheckCircle2 className="size-3" /> : <AlertCircle className="size-3" />}
                                    {log.statusCode} {isOk ? "OK" : "ERROR"}
                                </Badge>
                            </div>
                        </SheetHeader>

                        <div className="space-y-5 text-xs">
                            {/* Primary Telemetry Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 rounded-xl border border-border/70 bg-secondary/20 p-3.5 shadow-2xs">
                                <div className="space-y-1">
                                    <span className="text-muted-foreground/80 block text-[10px] font-semibold uppercase tracking-wider">
                                        Latency
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <Clock className="size-3 text-muted-foreground" />
                                        <span className={`font-mono font-bold text-xs ${
                                            log.latencyMs > 2000 ? "text-rose-400" : log.latencyMs > 1000 ? "text-amber-400" : "text-emerald-400"
                                        }`}>
                                            {log.latencyMs} ms
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-muted-foreground/80 block text-[10px] font-semibold uppercase tracking-wider">
                                        Client IP
                                    </span>
                                    <span className="font-mono font-semibold text-foreground truncate block">
                                        {log.ipAddress || "127.0.0.1"}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-muted-foreground/80 block text-[10px] font-semibold uppercase tracking-wider">
                                        Provider
                                    </span>
                                    <span className="font-mono font-semibold text-foreground truncate block">
                                        {log.providerId}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-muted-foreground/80 block text-[10px] font-semibold uppercase tracking-wider">
                                        Model
                                    </span>
                                    <span className="font-mono font-semibold text-foreground truncate block" title={log.model}>
                                        {log.model}
                                    </span>
                                </div>
                            </div>

                            {/* API Key Attribution (Muncul jika requireApiKey aktif atau ada apiKeyId) */}
                            {(requireApiKey || log.apiKeyId) && (
                                <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                                            <KeyRound className="size-3.5 text-indigo-400" />
                                            Virtual API Key Authentication
                                        </span>
                                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
                                            Enforced
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/40 text-[11px]">
                                        <div>
                                            <span className="text-muted-foreground block text-[10px]">Key Name</span>
                                            <span className="font-semibold text-foreground">
                                                {log.apiKeyName || "Unlabeled Virtual Key"}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block text-[10px]">Key ID</span>
                                            <span className="font-mono text-muted-foreground truncate block" title={log.apiKeyId || "None"}>
                                                {log.apiKeyId || "bypass"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Smart Routing & Fallback Banners */}
                            {log.resolvedModel && log.resolvedModel !== log.model && (
                                <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3.5 space-y-1.5 shadow-2xs">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400">
                                        <Zap className="size-3.5" />
                                        <span>Smart Auto-Routing Resolution</span>
                                    </div>
                                    <div className="text-[11px] font-mono text-foreground grid grid-cols-2 gap-2 pt-1">
                                        <div>
                                            <span className="text-muted-foreground block text-[10px]">Requested Model:</span>
                                            <span className="truncate block font-medium">{log.model}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block text-[10px]">Dispatched Target:</span>
                                            <span className="text-indigo-300 font-bold truncate block">{log.resolvedModel}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {log.fallbackOccurred && (
                                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2 shadow-2xs">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                                        <Network className="size-3.5" />
                                        <span>Cascade Fallback Triggered</span>
                                    </div>
                                    {log.fallbackPath && (
                                        <div className="text-[11px] font-mono text-foreground">
                                            <span className="text-muted-foreground block text-[10px]">Fallback Cascade Path:</span>
                                            <span className="text-amber-200 font-semibold">{log.fallbackPath}</span>
                                        </div>
                                    )}
                                    {log.fallbackReason && (
                                        <div className="text-[11px] text-muted-foreground">
                                            <span className="text-muted-foreground block text-[10px]">Trigger Reason:</span>
                                            <span className="italic">{log.fallbackReason}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Token Usage Breakdown Card */}
                            <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3 shadow-2xs">
                                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                    <div className="flex items-center gap-2">
                                        <Cpu className="size-4 text-muted-foreground" />
                                        <span className="font-bold text-foreground text-xs uppercase tracking-wider">
                                            Token Telemetry Breakdown
                                        </span>
                                    </div>
                                    <span className="font-mono text-xs font-bold text-foreground">
                                        {log.totalTokens.toLocaleString()} total
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                                    <div className="rounded-lg border border-border/50 bg-secondary/15 p-2.5 space-y-1">
                                        <span className="text-[10px] text-muted-foreground uppercase font-semibold">Prompt (Input)</span>
                                        <div className="font-mono text-xs font-bold text-foreground">
                                            {log.promptTokens.toLocaleString()}
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-border/50 bg-secondary/15 p-2.5 space-y-1">
                                        <span className="text-[10px] text-muted-foreground uppercase font-semibold">Completion (Output)</span>
                                        <div className="font-mono text-xs font-bold text-foreground">
                                            {log.completionTokens.toLocaleString()}
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-2.5 space-y-1">
                                        <span className="text-[10px] text-sky-400 uppercase font-semibold">Cache Read</span>
                                        <div className="font-mono text-xs font-bold text-sky-400">
                                            {cachedTokens.toLocaleString()}
                                        </div>
                                    </div>

                                    {cacheCreationTokens > 0 && (
                                        <div className="rounded-lg border border-border/50 bg-secondary/15 p-2.5 space-y-1">
                                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Cache Creation</span>
                                            <div className="font-mono text-xs font-bold text-foreground">
                                                {cacheCreationTokens.toLocaleString()}
                                            </div>
                                        </div>
                                    )}

                                    {reasoningTokens > 0 && (
                                        <div className="rounded-lg border border-border/50 bg-secondary/15 p-2.5 space-y-1">
                                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Reasoning (CoT)</span>
                                            <div className="font-mono text-xs font-bold text-indigo-400">
                                                {reasoningTokens.toLocaleString()}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Itemized Cost Breakdown Card (Wajib Ada: Input, Output, Cache Read) */}
                            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3 shadow-2xs">
                                <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                                    <div className="flex items-center gap-2">
                                        <Coins className="size-4 text-emerald-400" />
                                        <span className="font-bold text-emerald-400 text-xs uppercase tracking-wider">
                                            Itemized Cost Telemetry
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 font-mono text-sm font-bold text-emerald-400">
                                        <span>${totalCost.toFixed(5)}</span>
                                    </div>
                                </div>

                                <div className="space-y-2 text-xs">
                                    {/* 1. Input Cost */}
                                    <div className="flex items-center justify-between py-1 border-b border-border/30">
                                        <span className="text-muted-foreground flex items-center gap-1.5">
                                            <span className="size-1.5 rounded-full bg-emerald-400" />
                                            Input Token Cost:
                                        </span>
                                        <span className="font-mono font-semibold text-foreground">
                                            ${inputCost.toFixed(5)}
                                        </span>
                                    </div>

                                    {/* 2. Output Cost */}
                                    <div className="flex items-center justify-between py-1 border-b border-border/30">
                                        <span className="text-muted-foreground flex items-center gap-1.5">
                                            <span className="size-1.5 rounded-full bg-indigo-400" />
                                            Output Token Cost:
                                        </span>
                                        <span className="font-mono font-semibold text-foreground">
                                            ${outputCost.toFixed(5)}
                                        </span>
                                    </div>

                                    {/* 3. Cache Read Cost */}
                                    <div className="flex items-center justify-between py-1 border-b border-border/30">
                                        <span className="text-muted-foreground flex items-center gap-1.5">
                                            <span className="size-1.5 rounded-full bg-sky-400" />
                                            Cache Read Cost:
                                        </span>
                                        <span className="font-mono font-semibold text-sky-400">
                                            ${cacheReadCost.toFixed(5)}
                                        </span>
                                    </div>

                                    {/* Cache Creation Cost jika ada */}
                                    {cacheCreationCost > 0 && (
                                        <div className="flex items-center justify-between py-1 border-b border-border/30">
                                            <span className="text-muted-foreground flex items-center gap-1.5">
                                                <span className="size-1.5 rounded-full bg-amber-400" />
                                                Cache Creation Cost:
                                            </span>
                                            <span className="font-mono font-semibold text-amber-400">
                                                ${cacheCreationCost.toFixed(5)}
                                            </span>
                                        </div>
                                    )}

                                    {/* Total Net Cost */}
                                    <div className="flex items-center justify-between pt-2 font-bold text-xs">
                                        <span className="text-foreground uppercase tracking-wide">Total Estimated Cost:</span>
                                        <span className="font-mono text-emerald-400 text-sm">
                                            ${totalCost.toFixed(5)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Raw Payload JSON Card */}
                            <div className="rounded-xl border border-border/70 bg-card p-4 space-y-2.5 shadow-2xs">
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                                        <Layers className="size-3.5 text-muted-foreground" />
                                        Audit JSON Payload
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleCopyPayload}
                                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border/60 bg-secondary/30 text-[11px] font-medium text-foreground hover:bg-secondary cursor-pointer transition-colors shadow-2xs"
                                    >
                                        {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3 text-muted-foreground" />}
                                        <span>{copied ? "Copied" : "Copy JSON"}</span>
                                    </button>
                                </div>
                                <pre className="p-3.5 rounded-lg border border-border/50 bg-secondary/30 font-mono text-[11px] text-foreground/90 overflow-x-auto max-h-56 leading-relaxed">
                                    <code>{JSON.stringify(log, null, 2)}</code>
                                </pre>
                            </div>
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}
