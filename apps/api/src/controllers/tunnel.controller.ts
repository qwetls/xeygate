import type { Context } from "hono";
import { Err, Ok } from "@/utils/response.js";
import { TunnelConfigSchema } from "@srouter/types";
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

/** Cap concurrent SSE tunnel-event streams so one session cannot exhaust workers. */
const MAX_EVENT_STREAMS = 8;
let ActiveEventStreams = 0;

export class TunnelController {
    public static async GetStatus(c: Context): Promise<Response> {
        const Status = await getTunnelStatus();
        return Ok(c, { ...Status, tokenConfigured: Boolean(await getTunnelToken()) });
    }

    public static async GetEvents(c: Context): Promise<Response> {
        if (ActiveEventStreams >= MAX_EVENT_STREAMS) {
            return Err(c, "Too many concurrent tunnel event streams", 429, {
                code: "too_many_streams"
            });
        }
        ActiveEventStreams += 1;

        const Encoder = new TextEncoder();
        let Unsubscribe: (() => void) | null = null;
        let Heartbeat: ReturnType<typeof setInterval> | null = null;

        const Release = () => {
            if (Heartbeat) clearInterval(Heartbeat);
            if (Unsubscribe) Unsubscribe();
            Unsubscribe = null;
            Heartbeat = null;
            ActiveEventStreams -= 1;
        };

        const Stream = new ReadableStream<Uint8Array>({
            start(controller) {
                const Send = (data: unknown) => {
                    try {
                        controller.enqueue(Encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                    } catch {}
                };

                void (async () => {
                    try {
                        const Status = await getTunnelStatus();
                        Send({ ...Status, tokenConfigured: Boolean(await getTunnelToken()) });

                        Unsubscribe = onTunnelUpdate((Status) => {
                            Send({ ...Status, tokenConfigured: Boolean(getTunnelToken()) });
                        });

                        Heartbeat = setInterval(() => {
                            try {
                                controller.enqueue(Encoder.encode(`: ping\n\n`));
                            } catch {}
                        }, 25_000);
                    } catch (SetupError) {
                        Release();
                        throw SetupError;
                    }
                })();
            },
            cancel() {
                Release();
            }
        });

        return c.body(Stream, 200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no"
        });
    }

    public static async StartTunnel(c: Context): Promise<Response> {
        const RawBody = await c.req.json().catch(() => ({}));
        const Parsed = TunnelConfigSchema.safeParse(RawBody);
        const Data = Parsed.success ? Parsed.data : {};

        if (Data.token) await setTunnelToken(Data.token);
        if (Data.domain) await setTunnelDomain(Data.domain);

        const Result = await startTunnel();
        return Result.success ? Ok(c, Result) : Err(c, Result.message, 400);
    }

    public static async StopTunnel(c: Context): Promise<Response> {
        const Result = await stopTunnel();
        return Result.success ? Ok(c, Result) : Err(c, Result.message, 400);
    }

    public static async UpdateConfig(c: Context): Promise<Response> {
        const RawBody = await c.req.json().catch(() => null);
        const Parsed = TunnelConfigSchema.safeParse(RawBody);
        if (!Parsed.success || (!Parsed.data.token && !Parsed.data.domain)) {
            return Err(c, "Provide 'token' and/or 'domain'", 400);
        }

        if (Parsed.data.token) await setTunnelToken(Parsed.data.token);
        if (Parsed.data.domain) await setTunnelDomain(Parsed.data.domain);

        return Ok(c, {
            message: "Tunnel configuration updated",
            domain: (await getTunnelDomain()) || undefined
        });
    }

    public static Install(c: Context): Response {
        const Result = installCloudflared();
        return Result.success ? Ok(c, Result) : Err(c, Result.message, 400);
    }

    public static async GetInstallStatus(c: Context): Promise<Response> {
        return Ok(c, await getInstallStatus());
    }
}
