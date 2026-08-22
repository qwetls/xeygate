import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

export interface TunnelStatus {
    running: boolean;
    pid?: number;
    startedAt?: number;
    error?: string;
    domain?: string;
    cloudflaredAvailable: boolean;
    tokenConfigured?: boolean;
}

export function useTunnelStatus(pollMs = 10000) {
    const [status, setStatus] = useState<TunnelStatus | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchStatus = useCallback(async () => {
        try {
            const json = await api.get<TunnelStatus & { ok: boolean }>("/v1/tunnel/status");
            setStatus(json);
        } catch (err) {
            console.error("Failed to fetch tunnel status:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchStatus();
        if (!pollMs) return;
        const id = setInterval(() => void fetchStatus(), pollMs);
        return () => clearInterval(id);
    }, [fetchStatus, pollMs]);

    return { status, loading, fetchStatus };
}

export function useTunnelActions() {
    const startTunnel = useCallback(
        async (payload: { token?: string; domain?: string }) => {
            try {
                await api.post("/v1/tunnel/start", payload);
                toast.success("Cloudflare Tunnel started", {
                    description: payload.domain
                        ? `Custom domain: ${payload.domain}`
                        : "Gateway is now reachable through the tunnel."
                });
                return true;
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Failed to start tunnel";
                toast.error(msg);
                return false;
            }
        },
        []
    );

    const stopTunnel = useCallback(async () => {
        try {
            await api.post("/v1/tunnel/stop");
            toast.success("Cloudflare Tunnel stopped");
            return true;
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to stop tunnel";
            toast.error(msg);
            return false;
        }
    }, []);

    return { startTunnel, stopTunnel };
}
