import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/docs/api-reference")({
    component: ApiReferencePage
});

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={() => {
                navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }}
            className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
            title="Copy"
        >
            {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
        </button>
    );
}

function MethodBadge({ method }: { method: string }) {
    const colors: Record<string, string> = {
        GET: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
        POST: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
        PATCH: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
        PUT: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
        DELETE: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
    };
    return (
        <span className={`inline-flex items-center rounded-[4px] border px-1.5 py-0.5 text-[9px] font-bold uppercase ${colors[method] ?? "bg-secondary text-muted-foreground"}`}>
            {method}
        </span>
    );
}

function EndpointRow({ method, path, desc, auth }: { method: string; path: string; desc: string; auth?: string }) {
    return (
        <div className="flex items-start gap-3 rounded-lg border border-border/40 bg-secondary/10 px-4 py-3">
            <MethodBadge method={method} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <code className="text-xs font-semibold break-all">{path}</code>
                    <CopyButton text={path} />
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{desc}</p>
            </div>
            {auth && (
                <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                    {auth}
                </span>
            )}
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground/80 border-b border-border/40 pb-2">
                {title}
            </h3>
            <div className="space-y-2">{children}</div>
        </div>
    );
}

function ApiReferencePage() {
    return (
        <div className="space-y-8">
            <div className="space-y-3">
                <Link to="/docs" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="size-3" />
                    Back to docs
                </Link>
                <h1 className="text-2xl font-bold tracking-tight">API Reference</h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    All endpoints are prefixed with the gateway base URL. Authentication is via
                    <code className="mx-1 rounded bg-secondary px-1 py-0.5 text-[10px]">Authorization: Bearer sr-live-your_key</code>
                    unless marked as public.
                </p>
            </div>

            <div className="rounded-lg border border-border/40 bg-secondary/10 px-4 py-3 font-mono text-xs">
                <span className="text-muted-foreground">Base URL:</span>{" "}
                <span className="text-emerald-500">https://gate.xeycompany.com/v1</span>
            </div>

            {/* Chat Completions */}
            <Section title="Chat Completions">
                <EndpointRow method="POST" path="/v1/chat/completions" desc="OpenAI-compatible chat completions. Supports streaming (SSE), all connected models." auth="API Key" />
                <EndpointRow method="POST" path="/v1/messages" desc="Anthropic-compatible messages endpoint. Automatic format translation." auth="API Key" />
            </Section>

            {/* Models */}
            <Section title="Models">
                <EndpointRow method="GET" path="/v1/models" desc="List all available models. Optional ?provider= filter. Disabled and unlisted models are excluded." auth="API Key" />
                <EndpointRow method="GET" path="/v1/models/:model" desc="Retrieve a specific model object by id." auth="API Key" />
            </Section>

            {/* Catalog / Marketplace */}
            <Section title="Marketplace Catalog">
                <EndpointRow method="GET" path="/v1/catalog" desc="Public marketplace catalog — all listed models grouped by provider with pricing." auth="Public" />
                <EndpointRow method="GET" path="/v1/catalog/models" desc="Flat list of all marketplace model entries with aliases and offers." auth="Public" />
                <EndpointRow method="GET" path="/v1/catalog/models/:model" desc="Detail for one marketplace model — pricing table, stats, providers." auth="Public" />
            </Section>

            {/* Namespaced marketplace */}
            <Section title="Marketplace Namespaces">
                <EndpointRow method="GET" path="/official/v1/models" desc="Official listings only (admin-owned base-id connections)." auth="API Key" />
                <EndpointRow method="GET" path="/user/v1/models" desc="Creator listings only (user-owned connection-scoped)." auth="API Key" />
            </Section>

            {/* Analytics */}
            <Section title="Public Analytics">
                <EndpointRow method="GET" path="/v1/analytics/overview" desc="Aggregate marketplace traffic snapshot (24h/7d/30d). ?window= parameter." auth="Public" />
                <EndpointRow method="GET" path="/v1/analytics/models" desc="Token-volume model leaderboard. ?window=&limit= parameters." auth="Public" />
                <EndpointRow method="GET" path="/v1/analytics/models/:model" desc="Per-model traffic stats — latency, tokens, success rate, endpoints." auth="Public" />
                <EndpointRow method="GET" path="/v1/analytics/endpoints" desc="Supply endpoint performance breakdown." auth="Public" />
            </Section>

            {/* User Auth */}
            <Section title="Authentication">
                <EndpointRow method="POST" path="/v1/users/register" desc="Create a new account. Body: {email, password, name?, accepted_terms}." auth="Public" />
                <EndpointRow method="POST" path="/v1/users/login" desc="Sign in and receive session cookie. Body: {email, password}." auth="Public" />
                <EndpointRow method="POST" path="/v1/users/logout" desc="Sign out current session." auth="Session" />
                <EndpointRow method="POST" path="/v1/users/logout-all" desc="Revoke all sessions for the current user." auth="Session" />
                <EndpointRow method="POST" path="/v1/users/change-password" desc="Change password. Invalidates all other sessions." auth="Session" />
                <EndpointRow method="GET" path="/v1/users/oauth/github/status" desc="Check if GitHub sign-in is configured." auth="Public" />
                <EndpointRow method="GET" path="/v1/users/oauth/github/start" desc="Begin GitHub OAuth flow. ?consent=1 required." auth="Public" />
            </Section>

            {/* User Profile */}
            <Section title="User Profile & Billing">
                <EndpointRow method="GET" path="/v1/users/me" desc="Current user profile — balance, streak, admin flag, terms consent." auth="Session" />
                <EndpointRow method="PATCH" path="/v1/users/me" desc="Update display name. Body: {name}." auth="Session" />
                <EndpointRow method="GET" path="/v1/users/transactions" desc="Wallet transaction ledger with pagination." auth="Session" />
                <EndpointRow method="POST" path="/v1/users/topups" desc="Create a top-up order. Body: {amount, currency?, reference?}." auth="Session" />
                <EndpointRow method="POST" path="/v1/users/topups/:id/cancel" desc="Cancel a pending top-up order." auth="Session" />
                <EndpointRow method="GET" path="/v1/users/creator-application" desc="Read own creator application." auth="Session" />
                <EndpointRow method="PUT" path="/v1/users/role" desc="Request creator upgrade. Body: {display_name, reason, link?}." auth="Session" />
            </Section>

            {/* Creator */}
            <Section title="Creator APIs">
                <EndpointRow method="GET" path="/v1/users/my-providers" desc="List provider connections owned by the current user with model counts." auth="Session" />
                <EndpointRow method="GET" path="/v1/users/payouts" desc="Creator payout history." auth="Session" />
                <EndpointRow method="POST" path="/v1/users/payouts" desc="Request a payout. Body: {amount, currency?}." auth="Session" />
            </Section>

            {/* API Keys */}
            <Section title="Virtual API Keys">
                <EndpointRow method="GET" path="/v1/keys" desc="List all virtual API keys for the current user." auth="Session" />
                <EndpointRow method="POST" path="/v1/keys" desc="Create a new virtual key. Body: {name, quota_limit?, credit_limit?, allowed_models?}." auth="Session" />
                <EndpointRow method="DELETE" path="/v1/keys/:id" desc="Revoke a virtual key." auth="Session" />
            </Section>

            {/* Logs */}
            <Section title="Request Logs">
                <EndpointRow method="GET" path="/v1/logs" desc="List recent request logs for the current user's keys." auth="Session" />
                <EndpointRow method="GET" path="/v1/logs/stats" desc="Aggregated usage statistics (admin: all keys; user: own keys)." auth="Session" />
                <EndpointRow method="GET" path="/v1/logs/:id" desc="Detail for one request log entry including served_provider_id." auth="Session" />
            </Section>

            {/* Quota */}
            <Section title="Quota & Limits">
                <EndpointRow method="GET" path="/v1/quota" desc="Live quota and usage for all connected providers." auth="Admin" />
            </Section>

            {/* Admin */}
            <Section title="Admin">
                <EndpointRow method="GET" path="/v1/admin/status" desc="Bootstrap check — {setupRequired: boolean}." auth="Public" />
                <EndpointRow method="POST" path="/v1/admin/bootstrap" desc="Claim admin account on first run. Body: {email, password, name?}." auth="Public" />
                <EndpointRow method="GET" path="/v1/admin/users" desc="List all users with status, role, creator info." auth="Admin" />
                <EndpointRow method="POST" path="/v1/admin/users/:id/approve" desc="Approve a pending user registration." auth="Admin" />
                <EndpointRow method="POST" path="/v1/admin/users/:id/ban" desc="Ban a user account." auth="Admin" />
                <EndpointRow method="POST" path="/v1/admin/users/:id/promote" desc="Promote user to admin." auth="Admin" />
                <EndpointRow method="POST" path="/v1/admin/users/:id/demote" desc="Demote admin to regular user." auth="Admin" />
                <EndpointRow method="GET" path="/v1/admin/providers" desc="List all configured providers." auth="Admin" />
                <EndpointRow method="GET" path="/v1/admin/providers/:id" desc="Provider detail with models, keys, quota." auth="Admin" />
                <EndpointRow method="POST" path="/v1/admin/topups/:id/process" desc="Approve or reject a top-up order. Body: {action: approve|reject, note?}." auth="Admin" />
                <EndpointRow method="GET" path="/v1/admin/platform-analytics" desc="Platform-wide metrics — users, creators, models, tokens, top users." auth="Admin" />
                <EndpointRow method="GET" path="/v1/admin/settings" desc="Read system settings." auth="Admin" />
                <EndpointRow method="PATCH" path="/v1/admin/settings" desc="Update system settings. Body: partial settings object." auth="Admin" />
            </Section>

            {/* Error format */}
            <div className="rounded-xl border border-border/60 bg-secondary/10 p-5 space-y-3">
                <h3 className="text-sm font-bold">Error Format</h3>
                <p className="text-xs text-muted-foreground">All errors follow a consistent JSON envelope:</p>
                <pre className="overflow-x-auto rounded-lg bg-[var(--canvas)] border border-border/40 p-4 text-[11px] leading-relaxed text-muted-foreground">
                    <code>{`{
    "ok": false,
    "error": "Human-readable error message",
    "code": "machine_readable_code"
}`}</code>
                </pre>
            </div>
        </div>
    );
}
