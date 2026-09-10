import { useState } from "react";
import { Activity, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useVersion } from "@/hooks/useVersion";
import { SettingsSection } from "./settings.ui";

interface SystemSettingsProps {
    apiBase: string;
}

export function SystemSettings({ apiBase }: SystemSettingsProps) {
    const [pingLatency, setPingLatency] = useState<number | null>(null);
    const [isPinging, setIsPinging] = useState(false);
    const [lastPingTime, setLastPingTime] = useState<string | null>(null);
    const { currentVersion } = useVersion();

    const handlePing = async () => {
        setIsPinging(true);
        const start = performance.now();
        try {
            await api.get("/v1/settings");
            setPingLatency(Math.round(performance.now() - start));
            setLastPingTime(new Date().toLocaleTimeString());
        } catch {
            setPingLatency(-1);
            setLastPingTime(new Date().toLocaleTimeString());
        } finally {
            setIsPinging(false);
        }
    };

    return (
        <SettingsSection
            id="system"
            icon={Activity}
            tag="Runtime"
            title="System & Diagnostics"
            description="Mesh node status and real-time gateway latency probes."
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 py-2">
                <div className="rounded-md border border-border/70 bg-muted/20 p-3 space-y-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                        Version
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold font-mono text-xs text-foreground">
                            {currentVersion}
                        </span>
                    </div>
                </div>
                <div className="rounded-md border border-border/70 bg-muted/20 p-3 space-y-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                        Stack
                    </span>
                    <div className="text-xs font-bold text-foreground">
                        SQLite WAL · Hono · Node.js
                    </div>
                </div>
            </div>

            <div className="rounded-md border border-border/70 bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Activity className="size-3.5 text-emerald-500" />
                        <span className="text-xs font-semibold text-foreground">
                            Gateway Latency
                        </span>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isPinging}
                        onClick={handlePing}
                        className="cursor-pointer"
                    >
                        {isPinging ? (
                            <Loader2 className="size-3 animate-spin" />
                        ) : (
                            <RefreshCw className="size-3" />
                        )}
                        {isPinging ? "pinging..." : "ping"}
                    </Button>
                </div>
                {pingLatency !== null && (
                    <div className="flex items-center justify-between text-[11px] font-mono">
                        {pingLatency >= 0 ? (
                            <span className="text-emerald-500 font-semibold">{pingLatency}ms</span>
                        ) : (
                            <span className="text-destructive font-semibold">offline</span>
                        )}
                        {lastPingTime && (
                            <span className="text-muted-foreground">at {lastPingTime}</span>
                        )}
                    </div>
                )}
            </div>
        </SettingsSection>
    );
}
