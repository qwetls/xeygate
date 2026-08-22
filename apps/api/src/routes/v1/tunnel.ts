import { Hono } from "hono";
import { err, ok } from "@/utils/response.js";
import {
    getTunnelDomain,
    getTunnelToken,
    getTunnelStatus,
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
