import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getSettingDB, setSettingDB } from "@srouter/db";

const SETTING_TUNNEL_TOKEN = "cloudflare_tunnel_token";
const SETTING_TUNNEL_DOMAIN = "cloudflare_tunnel_domain";

let tunnelProcess: ChildProcess | null = null;
let lastStatus: {
    running: boolean;
    startedAt?: number;
    error?: string;
    domain?: string;
} = { running: false };

/**
 * Resolve the cloudflared binary. Checks PATH first, then common install locations.
 */
function resolveCloudflared(): string | null {
    const candidates = [
        process.env.CLOUDFLARED_PATH,
        "/usr/local/bin/cloudflared",
        "/usr/bin/cloudflared",
        path.join(os.homedir(), ".local/bin/cloudflared")
    ].filter((p): p is string => Boolean(p));

    for (const candidate of candidates) {
        try {
            fs.accessSync(candidate, fs.constants.X_OK);
            return candidate;
        } catch {
            continue;
        }
    }
    return null;
}

export function getTunnelToken(): string {
    return getSettingDB(SETTING_TUNNEL_TOKEN);
}

export function setTunnelToken(token: string): void {
    setSettingDB(SETTING_TUNNEL_TOKEN, token.trim());
}

export function getTunnelDomain(): string {
    return getSettingDB(SETTING_TUNNEL_DOMAIN);
}

export function setTunnelDomain(domain: string): void {
    setSettingDB(
        SETTING_TUNNEL_DOMAIN,
        domain
            .trim()
            .replace(/^https?:\/\//, "")
            .replace(/\/+$/, "")
    );
}

export function getTunnelStatus() {
    return {
        running: tunnelProcess !== null && tunnelProcess.exitCode === null,
        pid: tunnelProcess?.pid,
        startedAt: lastStatus.startedAt,
        error: lastStatus.error,
        domain: getTunnelDomain() || undefined,
        cloudflaredAvailable: resolveCloudflared() !== null
    };
}

/**
 * Start a Cloudflare Tunnel using a Tunnel Token (no `cloudflared login` required).
 *
 * With token-based tunnels the ingress (custom hostname → http://localhost:PORT)
 * is configured remotely in the Cloudflare Zero Trust dashboard, so custom domains
 * work without writing a local config.yml or cert.pem.
 */
export function startTunnel(options: { port?: number; token?: string; domain?: string } = {}): {
    success: boolean;
    message: string;
    domain?: string;
} {
    if (tunnelProcess && tunnelProcess.exitCode === null) {
        return { success: false, message: "Tunnel is already running" };
    }

    const token = (options.token ?? getTunnelToken()).trim();
    if (!token) {
        return {
            success: false,
            message:
                "No Cloudflare Tunnel Token configured. Set it via POST /v1/tunnel/token or the 'cloudflare_tunnel_token' setting."
        };
    }

    if (options.domain) setTunnelDomain(options.domain);

    const cloudflared = resolveCloudflared();
    if (!cloudflared) {
        return {
            success: false,
            message:
                "cloudflared binary not found. Install it (e.g. 'brew install cloudflared' / apt / deb package) or set CLOUDFLARED_PATH."
        };
    }

    const child = spawn(cloudflared, ["tunnel", "run", "--token", token], {
        stdio: ["ignore", "pipe", "pipe"]
    });

    tunnelProcess = child;
    lastStatus = { running: true, startedAt: Date.now(), domain: getTunnelDomain() || undefined };

    const handleOutput = (chunk: Buffer) => {
        const text = chunk.toString();
        // Surface connection errors but keep logs out of memory-heavy paths
        if (/failed|error/i.test(text)) {
            lastStatus.error = text.split("\n").slice(-3).join(" ").slice(0, 300);
        }
    };
    child.stdout?.on("data", handleOutput);
    child.stderr?.on("data", handleOutput);

    child.on("exit", (code) => {
        lastStatus = {
            ...lastStatus,
            running: false,
            error:
                code !== null && code !== 0
                    ? lastStatus.error || `cloudflared exited with code ${code}`
                    : undefined
        };
        tunnelProcess = null;
    });
    child.on("error", (err) => {
        lastStatus = { ...lastStatus, running: false, error: err.message };
        tunnelProcess = null;
    });

    return {
        success: true,
        message: `Cloudflare Tunnel started (pid ${child.pid})`,
        domain: getTunnelDomain() || undefined
    };
}

export function stopTunnel(): { success: boolean; message: string } {
    if (!tunnelProcess || tunnelProcess.exitCode !== null) {
        return { success: false, message: "Tunnel is not running" };
    }
    tunnelProcess.kill("SIGTERM");
    tunnelProcess = null;
    lastStatus = { running: false };
    return { success: true, message: "Cloudflare Tunnel stopped" };
}
