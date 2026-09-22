import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { formatCompactNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Activity,
    ArrowRight,
    BookOpen,
    Check,
    Clock,
    Coins,
    Copy,
    KeyRound,
    Shield,
    Store,
    Users,
    Zap
} from "lucide-react";

export const Route = createFileRoute("/_client/dashboard/")({
    staticData: { title: "Dashboard" },
    component: ClientDashboard
});

interface UserInfo {
    id: string;
    email: string;
    name: string;
    credits: number;
    role: "buyer" | "creator";
    status: "active" | "pending" | "banned";
    creatorStatus: "none" | "pending" | "approved" | "rejected";
}

interface PublicPlatformStats {
    users: number;
    creators: number;
    models: number;
    totalRequests: number;
    totalTokens: number;
}

function ClientDashboard() {
    const queryClient = useQueryClient();
    const { data: user } = useQuery({
        queryKey: ["user-auth-status"],
        queryFn: () => api.get<UserInfo>("/v1/users/me")
    });

    const { data: usage } = useQuery({
        queryKey: ["user-usage"],
        queryFn: () => api.get<{ totalRequests: number; totalTokens: number; totalCost: number }>("/v1/users/usage")
    });

    const { data: keysData } = useQuery({
        queryKey: ["user-keys"],
        queryFn: () => api.get<{ keys: Array<{ id: string; name: string; key: string }> }>("/v1/users/keys")
    });

    const { data: logsData } = useQuery({
        queryKey: ["user-logs"],
        queryFn: () => api.get<{ logs: Array<{ id: string; model: string; statusCode: number; totalTokens: number; latencyMs: number; estimatedCost: number; createdAt: number }> }>("/v1/users/logs?limit=5"),
        enabled: (keysData?.keys.length ?? 0) > 0
    });

    const { data: platform } = useQuery({
        queryKey: ["user-platform-stats"],
        queryFn: () => api.get<PublicPlatformStats>("/v1/users/platform-stats"),
        refetchInterval: 60_000,
        refetchIntervalInBackground: false
    });

    const gatewayUrl = typeof window !== "undefined" ? `${window.location.origin}/v1` : "http://localhost:4000/v1";

    const isCreator = user?.role === "creator";
    const creatorPending = user?.creatorStatus === "pending";
    const creatorRejected = user?.creatorStatus === "rejected";

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 font-mono">
            <header className="border-b border-border/80 pb-5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Welcome{user?.name ? `, ${user.name}` : ""}
                </h1>
                <p className="mt-1 text-xs text-muted-foreground">
                    Manage your API keys and monitor your usage on the XEYGATE gateway.
                </p>
            </header>

            {creatorPending && (
                <section className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10">
                        <Clock className="size-4 text-amber-500" strokeWidth={1.75} />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-foreground">Creator request pending</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                            An admin is reviewing your request to become a creator. You&apos;ll be
                            able to add providers and sell APIs once it&apos;s approved.
                        </p>
                    </div>
                </section>
            )}

            {!isCreator && !creatorPending && (
                <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border/80 bg-secondary/20 p-5">
                    <div className="flex items-start gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-secondary/50">
                            <Store className="size-5 text-muted-foreground" strokeWidth={1.75} />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-foreground">Become a Creator</h2>
                            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed max-w-xl">
                                {creatorRejected
                                    ? "Your previous creator request was rejected. You can submit a new application."
                                    : "Connect your own LLM provider accounts and sell API access on the marketplace. Applications are reviewed by admins."}
                            </p>
                        </div>
                    </div>
                    <Button
                        size="sm"
                        className="h-8 text-xs cursor-pointer gap-1.5 shrink-0 self-start sm:self-auto"
                        render={<Link to="/apply-creator" />}
                    >
                        {creatorRejected ? "Apply again" : "Apply now"}
                        <ArrowRight className="size-3.5" />
                    </Button>
                </section>
            )}

            {isCreator && user?.creatorStatus === "approved" && (
                <p className="text-xs text-emerald-600">
                    You&apos;re a Creator! Use the &quot;My APIs&quot; section in the sidebar to add your first provider.
                </p>
            )}

            <section className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <article className="rounded-xl border border-border/80 bg-card/60 p-4">
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">Credits</span>
                        <Coins className="size-4" strokeWidth={1.75} />
                    </div>
                    <div className="mt-2 text-2xl font-bold">${(user?.credits ?? 0).toFixed(4)}</div>
                </article>
                <article className="rounded-xl border border-border/80 bg-card/60 p-4">
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">API Keys</span>
                        <KeyRound className="size-4" strokeWidth={1.75} />
                    </div>
                    <div className="mt-2 text-2xl font-bold">{keysData?.keys.length ?? 0}</div>
                </article>
                <article className="rounded-xl border border-border/80 bg-card/60 p-4">
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">Total Requests</span>
                        <Activity className="size-4" strokeWidth={1.75} />
                    </div>
                    <div className="mt-2 text-2xl font-bold">{(usage?.totalRequests ?? 0).toLocaleString()}</div>
                </article>
            </section>

            {platform && (
                <section
                    aria-label="Platform summary"
                    className="rounded-xl border border-border/80 bg-card/40 p-4 sm:p-5 shadow-2xs"
                >
                    <div className="mb-4 flex items-center gap-2">
                        <Users className="size-4 text-muted-foreground" strokeWidth={1.75} />
                        <div>
                            <h2 className="text-sm font-bold tracking-tight text-foreground">
                                Platform Overview
                            </h2>
                            <p className="text-[11px] text-muted-foreground">
                                Live XEYGATE marketplace activity.
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                        <div className="rounded-lg border border-border/70 bg-card/60 p-3.5">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                Active Users
                            </div>
                            <div className="mt-1.5 text-xl font-bold text-foreground">
                                {platform.users.toLocaleString()}
                            </div>
                        </div>
                        <div className="rounded-lg border border-border/70 bg-card/60 p-3.5">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                Creators
                            </div>
                            <div className="mt-1.5 text-xl font-bold text-foreground">
                                {platform.creators.toLocaleString()}
                            </div>
                        </div>
                        <div className="rounded-lg border border-border/70 bg-card/60 p-3.5">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                Models
                            </div>
                            <div className="mt-1.5 text-xl font-bold text-foreground">
                                {platform.models.toLocaleString()}
                            </div>
                        </div>
                        <div className="rounded-lg border border-border/70 bg-card/60 p-3.5">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                Requests
                            </div>
                            <div className="mt-1.5 text-xl font-bold text-foreground">
                                {formatCompactNumber(platform.totalRequests)}
                            </div>
                        </div>
                        <div className="rounded-lg border border-border/70 bg-card/60 p-3.5">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                Tokens
                            </div>
                            <div className="mt-1.5 text-xl font-bold text-foreground">
                                {formatCompactNumber(platform.totalTokens)}
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {(keysData?.keys.length ?? 0) === 0 ? (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <BookOpen className="size-4 text-muted-foreground" />
                            <CardTitle className="text-sm">Quick Start</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-xs text-muted-foreground">
                            Create an API key above, then use it with any OpenAI-compatible SDK.
                        </p>
                        <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-foreground">Gateway Base URL</h4>
                            <CopyableCode text={gatewayUrl} />
                        </div>
                        <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-foreground">cURL</h4>
                            <CopyableCode text={`curl ${gatewayUrl}/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hello!"}]}'`} />
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 cursor-pointer" render={<Link to="/docs" />}>
                            Full documentation <ArrowRight className="size-3" />
                        </Button>
                    </CardContent>
                </Card>
            ) : (logsData?.logs ?? []).length > 0 ? (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Activity className="size-4 text-muted-foreground" />
                            <CardTitle className="text-sm">Recent Activity</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {logsData!.logs.map((log) => (
                                <div key={log.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/20 px-3 py-2">
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <Zap className={`size-3.5 shrink-0 ${log.statusCode < 400 ? "text-emerald-500" : "text-destructive"}`} />
                                        <span className="text-xs font-mono text-foreground truncate">{log.model}</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-[10px] text-muted-foreground shrink-0 ml-3">
                                        <span>{log.totalTokens.toLocaleString()} tok</span>
                                        <span>{log.latencyMs}ms</span>
                                        <span>{new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 mt-3 cursor-pointer" render={<Link to="/docs" />}>
                            API documentation <ArrowRight className="size-3" />
                        </Button>
                    </CardContent>
                </Card>
            ) : null}
        </div>
    );
}

function CopyableCode({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    function handleCopy() {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
    return (
        <div className="relative group">
            <pre className="rounded-lg border border-border/80 bg-secondary/30 p-3 text-[11px] text-foreground/90 overflow-x-auto whitespace-pre-wrap break-all">{text}</pre>
            <button type="button" onClick={handleCopy} className="absolute top-2 right-2 p-1.5 rounded-md border border-border/80 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-secondary">
                {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3 text-muted-foreground" />}
            </button>
        </div>
    );
}

