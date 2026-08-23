import { Hono } from "hono";
import { err, ok } from "@/utils/response.js";
import {
    getInstallStatus,
    getTunnelDomain,
    getTunnelStatus,
    getTunnelToken,
    installCloudflared,
    onTunnelUpdate,
    setTunnelDomain,
    setTunnelToken,
    startTunnel,
    stopTunnel
} from "@/services/cloudflareTunnel.js";

export const tunnelRoute = new Hono();

// GET /v1/tunnel/status - current tunnel state (never exposes the token)
tunnelRoute.get("/tunnel/status", (c) => {
    const status = getTunnelStatus();
    return ok(c, { ...status, tokenConfigured: Boolean(getTunnelToken()) });
});

// GET /v1/tunnel/events - Server-Sent Events stream of live tunnel/install state.
tunnelRoute.get("/tunnel/events", (c) => {
    const encoder = new TextEncoder();
    let unsubscribe: (() => void) | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            const send = (data: unknown) => {
                try {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                } catch {
                    // Controller already closed.
                }
            };
            // Initial snapshot so clients render instantly.
            send({ ...getTunnelStatus(), tokenConfigured: Boolean(getTunnelToken()) });

            unsubscribe = onTunnelUpdate((status) => {
                send({ ...status, tokenConfigured: Boolean(getTunnelToken()) });
            });

            // Keep the connection alive so proxies don't drop it.
            heartbeat = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(`: ping\n\n`));
                } catch {
                    // ignore
                }
            }, 25_000);
        },
        cancel() {
            if (heartbeat) clearInterval(heartbeat);
            if (unsubscribe) unsubscribe();
            unsubscribe = null;
            heartbeat = null;
        }
    });

    return c.body(stream, 200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no"
    });
});

// POST /v1/tunnel/start - start the tunnel with the stored token
// Body: { token?: string; domain?: string }  (token/domain are saved when provided)
tunnelRoute.post("/tunnel/start", async (c) => {
    let body: { token?: string; domain?: string } = {};
    try {
        body = (await c.req.json()) ?? {};
    } catch {
        // Empty body is fine — use stored settings
    }

    if (body.token) setTunnelToken(body.token);
    if (body.domain) setTunnelDomain(body.domain);

    const result = startTunnel();
    return result.success ? ok(c, result) : err(c, result.message, 400);
});

// POST /v1/tunnel/stop - stop the running tunnel
tunnelRoute.post("/tunnel/stop", (c) => {
    const result = stopTunnel();
    return result.success ? ok(c, result) : err(c, result.message, 400);
});

// PUT /v1/tunnel/config - update token and/or custom domain without starting
tunnelRoute.put("/tunnel/config", async (c) => {
    const body = await c.req.json<{ token?: string; domain?: string }>().catch(() => null);
    if (!body || (!body.token && !body.domain)) {
        return err(c, "Provide 'token' and/or 'domain'", 400);
    }
    if (body.token) setTunnelToken(body.token);
    if (body.domain) setTunnelDomain(body.domain);

    return ok(c, {
        message: "Tunnel configuration updated",
        domain: getTunnelDomain() || undefined
    });
});

// POST /v1/tunnel/install - download & install the cloudflared binary for this machine
tunnelRoute.post("/tunnel/install", (c) => {
    const result = installCloudflared();
    return result.success ? ok(c, result) : err(c, result.message, 400);
});

// GET /v1/tunnel/install - installation progress/state
tunnelRoute.get("/tunnel/install", (c) => {
    return ok(c, getInstallStatus());
});
