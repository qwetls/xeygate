/**
 * Detects known coding agents and developer tools from User-Agent string.
 */
export interface AgentClientInfo {
    name: string;
    raw: string;
    isKnownAgent: boolean;
}

export function parseUserAgent(ua?: string | null): AgentClientInfo {
    if (!ua || !ua.trim()) {
        return { name: "Direct API Client", raw: "", isKnownAgent: false };
    }

    const lower = ua.toLowerCase();

    // Specific agent detections
    if (lower.includes("opencode")) {
        return { name: "OpenCode", raw: ua, isKnownAgent: true };
    }
    if (lower.includes("agy") || lower.includes("antigravity")) {
        return { name: "AGY / Antigravity", raw: ua, isKnownAgent: true };
    }
    if (lower.includes("hermes")) {
        return { name: "Hermes Agent", raw: ua, isKnownAgent: true };
    }
    if (lower.includes("openclaw")) {
        return { name: "OpenClaw", raw: ua, isKnownAgent: true };
    }
    if (lower.includes("claude-code") || lower.includes("claudecode") || lower.includes("claude")) {
        return { name: "Claude Code", raw: ua, isKnownAgent: true };
    }
    if (lower.includes("cursor")) {
        return { name: "Cursor", raw: ua, isKnownAgent: true };
    }
    if (lower.includes("cline")) {
        return { name: "Cline", raw: ua, isKnownAgent: true };
    }
    if (lower.includes("roo") || lower.includes("roo-cline") || lower.includes("roocode")) {
        return { name: "Roo Code", raw: ua, isKnownAgent: true };
    }
    if (lower.includes("codex")) {
        return { name: "Codex CLI", raw: ua, isKnownAgent: true };
    }
    if (lower.includes("aider")) {
        return { name: "Aider", raw: ua, isKnownAgent: true };
    }
    if (lower.includes("continue")) {
        return { name: "Continue.dev", raw: ua, isKnownAgent: true };
    }
    if (lower.includes("windsurf") || lower.includes("codeium")) {
        return { name: "Windsurf", raw: ua, isKnownAgent: true };
    }
    if (lower.includes("githubcopilot") || lower.includes("copilot")) {
        return { name: "GitHub Copilot", raw: ua, isKnownAgent: true };
    }
    if (lower.includes("curl")) {
        return { name: "cURL", raw: ua, isKnownAgent: false };
    }
    if (lower.includes("openai/python")) {
        return { name: "OpenAI Python SDK", raw: ua, isKnownAgent: false };
    }
    if (lower.includes("openai/node") || lower.includes("openai-node")) {
        return { name: "OpenAI Node SDK", raw: ua, isKnownAgent: false };
    }

    // Default: extract first word or chunk of the UA
    const firstChunk = ua.split("/")[0]?.split(" ")[0]?.trim() || ua;
    return {
        name: firstChunk.length > 24 ? `${firstChunk.slice(0, 24)}…` : firstChunk,
        raw: ua,
        isKnownAgent: false
    };
}
