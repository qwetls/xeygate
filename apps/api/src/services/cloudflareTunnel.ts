import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { getSettingDB, setSettingDB } from "@srouter/db";

const SETTING_TUNNEL_TOKEN = "cloudflare_tunnel_token";
const SETTING_TUNNEL_DOMAIN = "cloudflare_tunnel_domain";
const SETTING_CLOUDFLARED_PATH = "cloudflared_path";

const DEFAULT_INSTALL_DIR = path.join(os.homedir(), ".local", "bin");

// Pub/sub so the SSE endpoint can push live tunnel/install state to clients.
const tunnelEmitter = new EventEmitter();
tunnelEmitter.setMaxListeners(100);

let lastEmitAt = 0;
function emitTunnelUpdate(force = false): void {
    const now = Date.now();
    if (!force && now - lastEmitAt < 300) return;
    lastEmitAt = now;
    tunnelEmitter.emit("update", getTunnelStatus());
}

export function onTunnelUpdate(
    handler: (status: ReturnType<typeof getTunnelStatus>) => void
): () => void {
    tunnelEmitter.on("update", handler);
    return () => tunnelEmitter.off("update", handler);
}

interface InstallState {
    inProgress: boolean;
    done: boolean;
    error?: string;
    platform?: string;
    arch?: string;
    target?: string;
    downloadedBytes?: number;
    totalBytes?: number;
}

let tunnelProcess: ChildProcess | null = null;
let lastStatus: {
    running: boolean;
    startedAt?: number;
    error?: string;
    domain?: string;
} = { running: false };

let installState: InstallState = { inProgress: false, done: false };

// Auto-restart / autostart state so the tunnel stays up across crashes and reboots.
const SETTING_TUNNEL_AUTOSTART = "cloudflare_tunnel_autostart";
const MAX_RESTART_ATTEMPTS = 5;
let tunnelDesired = false;
let tunnelStopping = false;
let restartAttempts = 0;
let restartTimer: ReturnType<typeof setTimeout> | null = null;
let lastTunnelPort = 3000;

function clearRestartTimer(): void {
    if (restartTimer) {
        clearTimeout(restartTimer);
        restartTimer = null;
    }
}

function scheduleTunnelRestart(): void {
    if (!tunnelDesired || tunnelStopping) return;
    if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
        tunnelDesired = false;
        lastStatus = {
            ...lastStatus,
            running: false,
            error: "Tunnel stopped after multiple restart attempts."
        };
        setSettingDB(SETTING_TUNNEL_AUTOSTART, "false");
        emitTunnelUpdate(true);
        return;
    }
    restartAttempts += 1;
    const delay = Math.min(1000 * 2 ** (restartAttempts - 1), 30_000);
    restartTimer = setTimeout(() => {
        if (!tunnelDesired || tunnelStopping) return;
        const result = startTunnel({
            port: lastTunnelPort,
            token: getTunnelToken() || undefined,
            domain: getTunnelDomain() || undefined
        });
        if (!result.success) {
            // e.g. binary missing — stop retrying rather than loop forever.
            tunnelDesired = false;
            setSettingDB(SETTING_TUNNEL_AUTOSTART, "false");
            emitTunnelUpdate(true);
        }
    }, delay);
}

/**
 * Resolve the cloudflared binary. Checks PATH first, then common install
 * locations and any previously installed/saved path.
 */
function resolveCloudflared(): string | null {
    const saved = getSettingDB(SETTING_CLOUDFLARED_PATH);
    const candidates = [
        process.env.CLOUDFLARED_PATH,
        saved,
        path.join(DEFAULT_INSTALL_DIR, "cloudflared"),
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

/**
 * Map the current Node platform/arch to the official cloudflared release asset name.
 * Returns null when the platform is unsupported (install must be done manually).
 */
function resolveTargetAsset(): {
    asset: string;
    binary: string;
    platform: string;
    arch: string;
} | null {
    const platform = process.platform;
    const arch = process.arch;

    if (platform === "linux" && arch === "x64") {
        return {
            asset: "cloudflared-linux-amd64",
            binary: "cloudflared",
            platform: "linux",
            arch: "amd64"
        };
    }
    if (platform === "linux" && arch === "arm64") {
        return {
            asset: "cloudflared-linux-arm64",
            binary: "cloudflared",
            platform: "linux",
            arch: "arm64"
        };
    }
    if (platform === "darwin" && arch === "x64") {
        return {
            asset: "cloudflared-darwin-amd64",
            binary: "cloudflared",
            platform: "darwin",
            arch: "amd64"
        };
    }
    if (platform === "darwin" && arch === "arm64") {
        return {
            asset: "cloudflared-darwin-arm64",
            binary: "cloudflared",
            platform: "darwin",
            arch: "arm64"
        };
    }
    if (platform === "win32" && arch === "x64") {
        return {
            asset: "cloudflared-windows-amd64.exe",
            binary: "cloudflared.exe",
            platform: "win32",
            arch: "amd64"
        };
    }
    if (platform === "win32" && arch === "arm64") {
        return {
            asset: "cloudflared-windows-arm64.exe",
            binary: "cloudflared.exe",
            platform: "win32",
            arch: "arm64"
        };
    }
    return null;
}

/**
 * Stream-download a file from an HTTPS URL, reporting progress via the callback.
 * Follows up to 5 redirects (GitHub's latest/download URLs 302 to the CDN).
 */
function httpsDownloadFile(
    url: string,
    dest: string,
    onProgress?: (downloaded: number, total: number) => void,
    redirects = 0
): Promise<void> {
    return new Promise((resolve, reject) => {
        const req = https.get(
            url,
            { headers: { "User-Agent": "srouter-cloudflared-installer" } },
            (res) => {
                const status = res.statusCode ?? 0;
                if (status >= 300 && status < 400 && res.headers.location && redirects < 5) {
                    res.resume();
                    const next = new URL(res.headers.location, url).toString();
                    resolve(httpsDownloadFile(next, dest, onProgress, redirects + 1));
                    return;
                }
                if (status < 200 || status >= 300) {
                    res.resume();
                    reject(new Error(`Download failed with HTTP ${status}`));
                    return;
                }
                const total = Number(res.headers["content-length"] ?? 0);
                let downloaded = 0;
                const file = fs.createWriteStream(dest);
                res.on("data", (c: Buffer) => {
                    downloaded += c.length;
                    onProgress?.(downloaded, total);
                });
                res.pipe(file);
                file.on("finish", () => file.close(() => resolve()));
                file.on("error", (err) => {
                    fs.rm(dest, { force: true }, () => reject(err));
                });
            }
        );
        req.on("error", (err) => {
            fs.rm(dest, { force: true }, () => reject(err));
        });
    });
}

/**
 * Lightweight sanity check that the downloaded file is a real executable and not
 * an HTML error page. Checks for ELF (Linux), Mach-O (macOS) or PE (Windows) magic.
 */
function isExecutableMagic(buf: Buffer): boolean {
    if (buf.length < 4) return false;
    // ELF
    if (buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) return true;
    // Mach-O (64-bit / fat)
    if (buf[0] === 0xcf && buf[1] === 0xfa && buf[2] === 0xed && buf[3] === 0xfe) return true;
    if (buf[0] === 0xfe && buf[1] === 0xed && buf[2] === 0xfa && buf[3] === 0xcf) return true;
    if (buf[0] === 0xca && buf[1] === 0xfe && buf[2] === 0xba && buf[3] === 0xbe) return true;
    // PE (MZ header)
    if (buf[0] === 0x4d && buf[1] === 0x5a) return true;
    return false;
}

export interface InstallResult {
    success: boolean;
    message: string;
    path?: string;
    platform?: string;
    arch?: string;
}

/**
 * Download and install the official cloudflared binary for this machine.
 * Runs asynchronously; progress/state is observable via getInstallStatus().
 */
export function installCloudflared(): InstallResult {
    if (installState.inProgress) {
        return { success: false, message: "Installation already in progress" };
    }
    const target = resolveTargetAsset();
    if (!target) {
        return {
            success: false,
            message: `Unsupported platform (${process.platform}/${process.arch}). Install cloudflared manually from https://github.com/cloudflare/cloudflared/releases.`,
            platform: process.platform,
            arch: process.arch
        };
    }

    installState = {
        inProgress: true,
        done: false,
        platform: target.platform,
        arch: target.arch
    };

    const url = `https://github.com/cloudflare/cloudflared/releases/latest/download/${target.asset}`;
    const destDir = DEFAULT_INSTALL_DIR;
    const dest = path.join(destDir, target.binary);

    (async () => {
        try {
            fs.mkdirSync(destDir, { recursive: true });
            const tmp = `${dest}.part`;
            await httpsDownloadFile(url, tmp, (downloaded, total) => {
                installState.downloadedBytes = downloaded;
                installState.totalBytes = total || undefined;
                emitTunnelUpdate();
            });

            const head = Buffer.alloc(4);
            const fd = fs.openSync(tmp, "r");
            try {
                fs.readSync(fd, head, 0, 4, 0);
            } finally {
                fs.closeSync(fd);
            }
            if (!isExecutableMagic(head)) {
                fs.rmSync(tmp, { force: true });
                throw new Error(
                    "Downloaded file is not a valid cloudflared binary (got an error page?)"
                );
            }

            fs.renameSync(tmp, dest);
            if (process.platform !== "win32") {
                fs.chmodSync(dest, 0o755);
            }
            setSettingDB(SETTING_CLOUDFLARED_PATH, dest);
            installState = { ...installState, inProgress: false, done: true, target: dest };
            emitTunnelUpdate(true);
        } catch (err) {
            installState = {
                ...installState,
                inProgress: false,
                done: true,
                error: err instanceof Error ? err.message : String(err)
            };
            emitTunnelUpdate(true);
        }
    })();

    return {
        success: true,
        message: `Downloading cloudflared for ${target.platform}/${target.arch}…`,
        platform: target.platform,
        arch: target.arch
    };
}

export function getInstallStatus() {
    return {
        inProgress: installState.inProgress,
        done: installState.done,
        error: installState.error,
        platform: installState.platform,
        arch: installState.arch,
        target: installState.target,
        downloadedBytes: installState.downloadedBytes,
        totalBytes: installState.totalBytes,
        cloudflaredAvailable: resolveCloudflared() !== null
    };
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
        domain: lastStatus.domain || getTunnelDomain() || undefined,
        cloudflaredAvailable: resolveCloudflared() !== null,
        install: getInstallStatus()
    };
}

/**
 * Start a Cloudflare Tunnel.
 *
 * Two modes:
 *  - Quick tunnel (no token): `cloudflared tunnel --url http://localhost:PORT`
 *    gives a random *.trycloudflare.com URL. No token or Cloudflare account needed.
 *  - Named tunnel (token + optional custom domain): `cloudflared tunnel run --token …`
 *    uses a Tunnel Token created in Cloudflare Zero Trust; the ingress
 *    (custom hostname → http://localhost:PORT) is configured remotely there.
 *
 * The token and custom domain are ONLY required for the named-tunnel / custom-domain
 * mode. A quick tunnel works with zero configuration.
 */
export function startTunnel(options: { port?: number; token?: string; domain?: string } = {}): {
    success: boolean;
    message: string;
    domain?: string;
    mode: "quick" | "named";
} {
    if (tunnelProcess && tunnelProcess.exitCode === null) {
        return { success: false, message: "Tunnel is already running", mode: "named" };
    }

    const token = (options.token ?? getTunnelToken()).trim();
    const port = options.port ?? 3000;

    const cloudflared = resolveCloudflared();
    if (!cloudflared) {
        return {
            success: false,
            message:
                "cloudflared binary not found. Install it (e.g. 'brew install cloudflared' / apt / deb package) or set CLOUDFLARED_PATH.",
            mode: "named"
        };
    }

    const quick = !token;
    if (!quick && options.domain) setTunnelDomain(options.domain);

    // Mark the tunnel as desired so it auto-restarts on crash and survives reboots.
    tunnelDesired = true;
    tunnelStopping = false;
    restartAttempts = 0;
    lastTunnelPort = port;
    clearRestartTimer();
    setSettingDB(SETTING_TUNNEL_AUTOSTART, "true");

    const args = quick
        ? ["tunnel", "--url", `http://localhost:${port}`]
        : ["tunnel", "run", "--token", token];

    const child = spawn(cloudflared, args, {
        stdio: ["ignore", "pipe", "pipe"]
    });

    tunnelProcess = child;
    lastStatus = {
        running: true,
        startedAt: Date.now(),
        domain: quick ? undefined : getTunnelDomain() || undefined
    };

    // Rolling tail of combined output so URLs split across chunks still match.
    let outputTail = "";

    const handleOutput = (chunk: Buffer) => {
        const text = chunk.toString();
        outputTail = `${outputTail}${text}`.slice(-8000);
        // Quick tunnels print the assigned URL — capture it for display.
        if (quick && !lastStatus.domain) {
            const match = outputTail.match(
                /https:\/\/[a-z0-9][^\s"'<>|]*\.(?:trycloudflare\.com|cfargotunnel\.com)/i
            );
            if (match) {
                const url = match[0].replace(/[.",]$/, "");
                if (url !== lastStatus.domain) {
                    lastStatus.domain = url;
                    emitTunnelUpdate(true);
                }
            }
        }
        // Surface connection errors but keep logs out of memory-heavy paths.
        if (/failed|error/i.test(text)) {
            lastStatus.error = text.split("\n").slice(-3).join(" ").slice(0, 300);
            emitTunnelUpdate();
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
        emitTunnelUpdate(true);
        // Auto-restart unless this was an intentional stop.
        if (tunnelDesired && !tunnelStopping) scheduleTunnelRestart();
    });
    child.on("error", (err) => {
        lastStatus = { ...lastStatus, running: false, error: err.message };
        tunnelProcess = null;
        emitTunnelUpdate(true);
        if (tunnelDesired && !tunnelStopping) scheduleTunnelRestart();
    });

    emitTunnelUpdate(true);

    return {
        success: true,
        message: quick
            ? `Cloudflare quick Tunnel started (pid ${child.pid})`
            : `Cloudflare Tunnel started (pid ${child.pid})`,
        domain: lastStatus.domain,
        mode: quick ? "quick" : "named"
    };
}

export function stopTunnel(): { success: boolean; message: string } {
    if (!tunnelProcess || tunnelProcess.exitCode !== null) {
        return { success: false, message: "Tunnel is not running" };
    }
    // Intentional stop: don't auto-restart.
    tunnelDesired = false;
    tunnelStopping = true;
    clearRestartTimer();
    setSettingDB(SETTING_TUNNEL_AUTOSTART, "false");
    tunnelProcess.kill("SIGTERM");
    tunnelProcess = null;
    lastStatus = { running: false };
    emitTunnelUpdate(true);
    return { success: true, message: "Cloudflare Tunnel stopped" };
}

/**
 * Auto-start the tunnel on server boot if it was left running previously.
 * Reads the persisted autostart flag; uses the stored token/domain (quick tunnel
 * if no token is configured). No-op if cloudflared isn't installed yet.
 */
export function autostartTunnelIfEnabled(): void {
    if (getSettingDB(SETTING_TUNNEL_AUTOSTART) !== "true") return;
    if (tunnelProcess && tunnelProcess.exitCode === null) return;
    startTunnel({
        port: lastTunnelPort,
        token: getTunnelToken() || undefined,
        domain: getTunnelDomain() || undefined
    });
}
