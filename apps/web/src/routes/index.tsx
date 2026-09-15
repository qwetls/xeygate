import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
    ArrowRight,
    ArrowUpRight,
    BadgeCheck,
    BarChart3,
    Boxes,
    Code2,
    Cpu,
    FileSearch,
    Gauge,
    KeyRound,
    Layers,
    Rocket,
    Search,
    ShieldCheck,
    Sparkles,
    Terminal,
    TrendingUp,
    Workflow,
    Zap
} from "lucide-react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar
} from "recharts";
import { api } from "@/lib/api";
import { Api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type {
    MarketplaceAnalyticsOverview,
    MarketplaceProviderStats,
    MarketplaceLeaderboard,
    MarketplaceStatPoint,
    MarketplaceModelStat,
    MarketplaceProviderStat
} from "@srouter/types";

export const Route = createFileRoute("/")({
    component: LandingPage
});

const GATEWAY_BASE_URL = "https://gate.xeycompany.com/v1";

/* ------------------------------------------------------------------ */
/*  Live catalog stats (public endpoints)                               */
/* ------------------------------------------------------------------ */

type CatalogProvider = {
    providerId: string;
    name: string;
    official: boolean;
    models: unknown[];
};

function useLiveStats() {
    return useQuery<{ providers: number; models: number }>({
        queryKey: ["landing-stats"],
        queryFn: async () => {
            const raw = (await api.get<Record<string, unknown>>("/v1/catalog")) as any;
            const payload = raw?.data ?? raw ?? {};
            const list: CatalogProvider[] = Array.isArray(payload.providers)
                ? payload.providers
                : Array.isArray(payload.data?.providers)
                  ? payload.data.providers
                  : [];
            const models = list.reduce((acc, p) => acc + (Array.isArray(p.models) ? p.models.length : 0), 0);
            return { providers: list.length, models };
        },
        retry: false
    });
}

function useAnalyticsOverview() {
    return useQuery<MarketplaceAnalyticsOverview>({
        queryKey: ["landing-analytics-overview"],
        queryFn: () => Api.getMarketplaceOverview("24h"),
        retry: false,
        refetchInterval: 60_000
    });
}

function useAnalyticsEndpoints() {
    return useQuery<MarketplaceProviderStats>({
        queryKey: ["landing-analytics-endpoints"],
        queryFn: () => Api.getMarketplaceEndpoints("24h"),
        retry: false,
        refetchInterval: 60_000
    });
}

function useAnalyticsLeaderboard() {
    return useQuery<MarketplaceLeaderboard>({
        queryKey: ["landing-analytics-leaderboard"],
        queryFn: () => Api.getMarketplaceModels("7d"),
        retry: false,
        refetchInterval: 60_000
    });
}

/* ------------------------------------------------------------------ */
/*  Format helpers                                                      */
/* ------------------------------------------------------------------ */

function fmtCompact(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
}

function fmtPct(n: number): string {
    return `${(n * 100).toFixed(1)}%`;
}

/* ------------------------------------------------------------------ */
/*  Marquee                                                             */
/* ------------------------------------------------------------------ */

const marqueeItems = [
    "ONE ENDPOINT · EVERY AI PROVIDER",
    "OPENAI + ANTHROPIC COMPATIBLE",
    "VIRTUAL KEYS — sr-live-*",
    "QUOTAS & RATE LIMITS",
    "COMBO ROUTING + FAILOVER",
    "REALTIME LOGS & ANALYTICS",
    "USD BILLING PER MODEL"
];

function Marquee() {
    const row = (ariaHidden: boolean) => (
        <div aria-hidden={ariaHidden} className="flex shrink-0 items-center">
            {marqueeItems.map((item) => (
                <span
                    key={`${item}${ariaHidden ? "-b" : "-a"}`}
                    className="flex items-center gap-6 pr-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                >
                    {item}
                    <Sparkles className="size-3 text-emerald-500" />
                </span>
            ))}
        </div>
    );
    return (
        <div className="overflow-hidden border-b border-border/60 bg-secondary/40 py-2">
            <div className="animate-marquee flex w-max">
                {row(false)}
                {row(true)}
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Code showcase                                                       */
/* ------------------------------------------------------------------ */

type CodeTab = "TypeScript" | "Python" | "cURL";

const samples: Record<CodeTab, string> = {
    TypeScript: `import OpenAI from "openai";

const client = new OpenAI({
    baseURL: "${GATEWAY_BASE_URL}",
    apiKey: "sr-live-xxxx_xxxxxxxxxxxxxxxx"
});

const stream = await client.chat.completions.create({
    model: "antigravity/gemini-3.7-flash-high",
    messages: [{ role: "user", content: "Explain vector embeddings in one sentence." }],
    stream: true
});

for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}`,
    Python: `from openai import OpenAI

client = OpenAI(
    base_url="${GATEWAY_BASE_URL}",
    api_key="sr-live-xxxx_xxxxxxxxxxxxxxxx"
)

stream = client.chat.completions.create(
    model="antigravity/gemini-3.7-flash-high",
    messages=[{"role": "user", "content": "Explain vector embeddings in one sentence."}],
    stream=True
)

for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="", flush=True)`,
    cURL: `curl -N ${GATEWAY_BASE_URL}/chat/completions \\
  -H "Authorization: Bearer sr-live-xxxx_xxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "antigravity/gemini-3.7-flash-high",
    "messages": [{"role": "user", "content": "Explain vector embeddings in one sentence."}],
    "stream": true
  }'`
};

const modelChips = [
    { model: "antigravity/gemini-3.7-flash-high", note: "Google" },
    { model: "anthropic/claude-sonnet-4", note: "Anthropic" },
    { model: "openai_codex/gpt-4o", note: "OpenAI" },
    { model: "zen/nemotron-3-ultra-free", note: "OpenCode Zen" }
];

function CodeShowcase() {
    const [tab, setTab] = useState<CodeTab>("TypeScript");

    return (
        <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
            <div className="grid items-start gap-8 lg:grid-cols-[1fr_1.1fr]">
                <div className="space-y-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">
                        SW1TCH PR0V1D3R — JUST TH3 PR3FIX
                    </p>
                    <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                        Change providers by changing the <span className="text-emerald-500">model prefix</span>.
                        Your code never moves.
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        One OpenAI-compatible base URL for every provider. Swap{" "}
                        <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">antigravity/…</code>{" "}
                        for{" "}
                        <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">anthropic/…</code>{" "}
                        and the request is rerouted instantly — virtual keys, quotas, and logs included.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                        {modelChips.map((c) => (
                            <button
                                key={c.model}
                                onClick={() => setTab("cURL")}
                                className="cursor-pointer rounded-lg border border-border/70 bg-card px-3 py-2 text-left transition-colors hover:border-emerald-500/60"
                            >
                                <span className="block font-mono text-xs font-semibold break-all">{c.model}</span>
                                <span className="block text-[10px] text-muted-foreground">{c.note}</span>
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground/80">
                        {">"} Hunting for a specific model? Check the{" "}
                        <Link to="/catalog" className="text-emerald-500 hover:underline">
                            marketplace →
                        </Link>
                    </p>
                </div>

                <div className="overflow-hidden rounded-xl border border-border/70 bg-[var(--canvas)]">
                    <div className="flex items-center justify-between border-b border-border/60 bg-secondary/30 px-3 py-2">
                        <div className="flex items-center gap-1.5">
                            <span className="size-2.5 rounded-full bg-destructive/60" />
                            <span className="size-2.5 rounded-full bg-yellow-500/60" />
                            <span className="size-2.5 rounded-full bg-emerald-500/60" />
                        </div>
                        <div className="flex items-center gap-1 rounded-md bg-background p-0.5">
                            {(["TypeScript", "Python", "cURL"] as CodeTab[]).map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setTab(t)}
                                    className={`cursor-pointer rounded px-2 py-1 text-[10px] font-semibold transition-colors ${
                                        tab === t ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>
                    <pre className="overflow-x-auto p-4 text-[11px] leading-relaxed text-muted-foreground">
                        <code>{samples[tab]}</code>
                    </pre>
                </div>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Live Analytics Section                                              */
/* ------------------------------------------------------------------ */

function StatBlock({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="space-y-1 px-4 py-3 text-center">
            <p className="text-2xl font-bold tracking-tight text-emerald-500 sm:text-3xl">{value}</p>
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
            {sub && <p className="text-[10px] text-muted-foreground/60">{sub}</p>}
        </div>
    );
}

function TrafficAreaChart({ series }: { series: MarketplaceStatPoint[] }) {
    const data = series.map((p) => ({
        time: new Date(p.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        requests: p.requests,
        tokens: p.tokens
    }));

    return (
        <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data}>
                <defs>
                    <linearGradient id="gradRequests" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                    contentStyle={{
                        backgroundColor: "var(--background)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: "11px",
                        fontFamily: "monospace"
                    }}
                />
                <Area type="monotone" dataKey="requests" stroke="#10b981" fill="url(#gradRequests)" strokeWidth={1.5} name="Requests" />
            </AreaChart>
        </ResponsiveContainer>
    );
}

function LatencyBarChart({ series }: { series: MarketplaceStatPoint[] }) {
    const data = series.map((p) => ({
        time: new Date(p.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        avgMs: Math.round(p.avgLatencyMs)
    }));

    return (
        <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data}>
                <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                    contentStyle={{
                        backgroundColor: "var(--background)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: "11px",
                        fontFamily: "monospace"
                    }}
                />
                <Bar dataKey="avgMs" fill="#10b981" name="Avg ms" radius={[2, 2, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );
}

function TokenAreaChart({ series }: { series: MarketplaceStatPoint[] }) {
    const data = series.map((p) => ({
        time: new Date(p.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        tokens: p.tokens
    }));

    return (
        <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data}>
                <defs>
                    <linearGradient id="gradTokens" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                    contentStyle={{
                        backgroundColor: "var(--background)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: "11px",
                        fontFamily: "monospace"
                    }}
                />
                <Area type="monotone" dataKey="tokens" stroke="#6366f1" fill="url(#gradTokens)" strokeWidth={1.5} name="Tokens" />
            </AreaChart>
        </ResponsiveContainer>
    );
}

function ModelLeaderboard({ models }: { models: MarketplaceModelStat[] }) {
    const top = models.slice(0, 8);
    if (top.length === 0) return null;
    const maxReqs = Math.max(...top.map((m) => m.totalRequests), 1);

    return (
        <div className="space-y-2">
            {top.map((m, i) => (
                <div key={m.model} className="flex items-center gap-3">
                    <span className="w-5 text-right text-[10px] font-bold text-muted-foreground">
                        {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="truncate text-xs font-semibold">{m.model}</span>
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                                {fmtCompact(m.totalRequests)} req · {fmtPct(m.successRate)} ok
                            </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                style={{ width: `${(m.totalRequests / maxReqs) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function ProviderEndpoints({ providers }: { providers: MarketplaceProviderStat[] }) {
    if (providers.length === 0) return null;
    const sorted = [...providers].sort((a, b) => b.totalRequests - a.totalRequests).slice(0, 8);

    return (
        <div className="space-y-2">
            {sorted.map((p) => (
                <div key={p.providerId} className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-secondary/10 px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className={`size-2 rounded-full shrink-0 ${p.official ? "bg-emerald-500" : "bg-amber-500"}`} />
                        <span className="truncate text-xs font-semibold">{p.displayName}</span>
                        {p.official && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/10 px-1 py-0.5 text-[8px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <BadgeCheck className="size-2" />
                                OFFICIAL
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-[10px] text-muted-foreground">
                        <span>{fmtCompact(p.totalRequests)} req</span>
                        <span>{fmtPct(p.successRate)} ok</span>
                        <span>{Math.round(p.avgLatencyMs)}ms</span>
                        <span>{p.models} models</span>
                    </div>
                </div>
            ))}
        </div>
    );
}

function LiveAnalyticsSection() {
    const catalogStats = useLiveStats();
    const overview = useAnalyticsOverview();
    const leaderboard = useAnalyticsLeaderboard();
    const endpoints = useAnalyticsEndpoints();

    const hasTraffic = (overview.data?.totalRequests ?? 0) > 0;

    return (
        <section className="border-y border-border/60 bg-secondary/10">
            {/* Hero stats band */}
            <div className="mx-auto grid max-w-5xl grid-cols-2 gap-px px-4 py-8 sm:grid-cols-4">
                <StatBlock
                    label="MODELS LIVE"
                    value={catalogStats.data ? String(catalogStats.data.models) : "—"}
                    sub="from catalog"
                />
                <StatBlock
                    label="PROVIDERS"
                    value={catalogStats.data ? String(catalogStats.data.providers) : "—"}
                    sub="connected"
                />
                <StatBlock
                    label="REQUESTS 24H"
                    value={overview.data ? fmtCompact(overview.data.totalRequests) : "—"}
                    sub={overview.data ? `${fmtPct(overview.data.successRate)} success` : undefined}
                />
                <StatBlock
                    label="TOKENS 24H"
                    value={overview.data ? fmtCompact(overview.data.totalTokens) : "—"}
                    sub={overview.data ? `${Math.round(overview.data.avgLatencyMs)}ms avg` : undefined}
                />
            </div>

            {/* Charts (only if traffic exists) */}
            {hasTraffic && overview.data && (
                <div className="mx-auto max-w-5xl px-4 pb-10">
                    {/* Big metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                        {[
                            { label: "Requests", value: fmtCompact(overview.data.totalRequests) },
                            { label: "Success Rate", value: fmtPct(overview.data.successRate) },
                            { label: "Avg Latency", value: `${Math.round(overview.data.avgLatencyMs)} ms` },
                            { label: "P95 Latency", value: `${Math.round(overview.data.p95LatencyMs)} ms` }
                        ].map((m) => (
                            <div key={m.label} className="rounded-lg border border-border/40 bg-card p-3 text-center">
                                <p className="text-lg font-bold text-emerald-500">{m.value}</p>
                                <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">{m.label}</p>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                        {/* Traffic chart */}
                        <div className="rounded-xl border border-border/40 bg-card p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <TrendingUp className="size-3.5 text-emerald-500" />
                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                    Traffic (24h)
                                </h3>
                            </div>
                            <TrafficAreaChart series={overview.data.series} />
                        </div>

                        {/* Latency chart */}
                        <div className="rounded-xl border border-border/40 bg-card p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Gauge className="size-3.5 text-amber-500" />
                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                    Latency (24h)
                                </h3>
                            </div>
                            <LatencyBarChart series={overview.data.series} />
                        </div>
                    </div>

                    {/* Token chart full width */}
                    <div className="rounded-xl border border-border/40 bg-card p-4 mb-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Layers className="size-3.5 text-indigo-500" />
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                Token Volume (24h)
                            </h3>
                        </div>
                        <TokenAreaChart series={overview.data.series} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Model leaderboard */}
                        <div className="rounded-xl border border-border/40 bg-card p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <BarChart3 className="size-3.5 text-emerald-500" />
                                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                        Top Models (7d)
                                    </h3>
                                </div>
                                <Link to="/catalog" className="text-[10px] text-emerald-500 hover:underline">
                                    View all →
                                </Link>
                            </div>
                            <ModelLeaderboard models={leaderboard.data?.models ?? []} />
                        </div>

                        {/* Provider endpoints */}
                        <div className="rounded-xl border border-border/40 bg-card p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Boxes className="size-3.5 text-amber-500" />
                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                    Supply Endpoints (24h)
                                </h3>
                            </div>
                            <ProviderEndpoints providers={endpoints.data?.providers ?? []} />
                        </div>
                    </div>
                </div>
            )}

            {/* CTA when no data yet */}
            {!hasTraffic && !overview.isLoading && (
                <p className="pb-6 text-center text-[10px] text-muted-foreground/70">
                    The catalog is warming up — charts will appear once the first requests flow through.
                </p>
            )}
        </section>
    );
}

/* ------------------------------------------------------------------ */
/*  Section shell                                                       */
/* ------------------------------------------------------------------ */

function SectionHead({
    kicker,
    title,
    leet,
    desc
}: {
    kicker: string;
    title: string;
    leet: string;
    desc: string;
}) {
    return (
        <div className="mx-auto max-w-2xl space-y-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-500">{kicker}</p>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {title} <span className="text-muted-foreground/60">{leet}</span>
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
        </div>
    );
}

const useCases = [
    {
        icon: Workflow,
        title: "Chat & Reasoning Agents",
        desc: "Route every conversation to the best model for the job — with automatic failover the moment a provider drops."
    },
    {
        icon: FileSearch,
        title: "OCR & Document Analysis",
        desc: "Push images and PDFs through vision models on the same endpoint. No rewrites, no new SDKs."
    },
    {
        icon: Code2,
        title: "SDK Integration",
        desc: "Drop-in for the OpenAI SDK, the Anthropic SDK, and anything else that speaks OpenAI."
    },
    {
        icon: Rocket,
        title: "AI Product Prototypes",
        desc: "One API key for cross-provider experiments — graduate to production without touching your code."
    },
    {
        icon: Layers,
        title: "Batch Processing",
        desc: "Run heavy jobs through per-key quotas and rate limits that keep every pipeline orderly and measurable."
    },
    {
        icon: BarChart3,
        title: "Usage & Cost Tracking",
        desc: "Realtime per-request logs — model, tokens, cost, status — audit-ready and billing-ready."
    }
];

const features = [
    {
        icon: Boxes,
        title: "Multi-Provider Routing",
        desc: "OpenAI, Anthropic, Google and more behind one gateway — failover and load balancing included."
    },
    {
        icon: KeyRound,
        title: "Virtual API Keys",
        desc: "Issue sr-live-* keys per customer with scopes, rotation, and a full audit trail."
    },
    {
        icon: Gauge,
        title: "Quotas & Rate Limits",
        desc: "Hard caps per key and per model with sliding windows and graceful back-pressure."
    },
    {
        icon: Zap,
        title: "Combo Routing",
        desc: "Chain providers into fallback combos — primary, secondary, tertiary — with live health checks."
    },
    {
        icon: ShieldCheck,
        title: "Official & Creator Listings",
        desc: "XeyCompany runs the official fleet; creators connect their own keys and sell model access."
    },
    {
        icon: Terminal,
        title: "Playground + Realtime Logs",
        desc: "Test prompts right in the dashboard and trace every request to the provider that served it."
    }
];

const officialSteps = [
    {
        icon: Cpu,
        title: "One base URL",
        desc: "A single endpoint serving every model from every provider."
    },
    {
        icon: KeyRound,
        title: "One virtual key",
        desc: "sr-live-* — easy to rotate, scope, and audit."
    },
    {
        icon: BadgeCheck,
        title: "Transparent pricing",
        desc: "Per-1M-token rates governed by the platform, published in the marketplace."
    }
];

/* ------------------------------------------------------------------ */
/*  Main Page                                                           */
/* ------------------------------------------------------------------ */

function LandingPage() {
    return (
        <div className="min-h-screen bg-background text-foreground font-mono">
            <Marquee />

            {/* Nav */}
            <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md">
                <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
                    <Link to="/" className="flex items-center gap-2">
                        <div className="flex size-7 items-center justify-center rounded-lg border border-border/80 bg-secondary">
                            <svg viewBox="0 0 24 24" fill="none" className="size-4">
                                <path
                                    d="M13 2.5L5 13H11.5L9.5 21.5L18.5 10H12L13.5 2.5Z"
                                    fill="currentColor"
                                    fillOpacity="0.92"
                                    stroke="currentColor"
                                    strokeWidth="0.5"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </div>
                        <span className="text-sm font-bold tracking-tight">XEYGATE</span>
                        <span className="rounded-xs border border-border/70 bg-secondary/70 px-1 py-0.5 text-[8px] font-semibold text-muted-foreground/80 uppercase leading-none">
                            Cloud
                        </span>
                    </Link>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" render={<Link to="/catalog" />} className="text-xs cursor-pointer">
                            Marketplace
                        </Button>
                        <Button variant="ghost" size="sm" render={<Link to="/docs" />} className="text-xs cursor-pointer">
                            Docs
                        </Button>
                        <Button variant="ghost" size="sm" render={<Link to="/login" />} className="text-xs cursor-pointer">
                            Sign in
                        </Button>
                        <Button size="sm" render={<Link to="/register" />} className="text-xs cursor-pointer">
                            Get started
                        </Button>
                    </div>
                </div>
            </header>

            {/* Hero */}
            <main>
                <section className="relative overflow-hidden">
                    <div className="pointer-events-none absolute inset-0 bg-grid-pattern" />
                    <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
                    <div className="relative mx-auto max-w-5xl px-4 py-24 sm:py-28">
                        <div className="mx-auto max-w-3xl space-y-6 text-center">
                            <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-500">
                                <Sparkles className="size-3" />
                                AI Gateway · Marketplace · Multi-Provider
                            </p>
                            <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
                                ONE ENDPOINT.
                                <br />
                                <span className="animate-shimmer-text">EVERY AI MODEL.</span>
                                <br />
                                <span className="text-muted-foreground">FULL CONTROL.</span>
                            </h1>
                            <p className="mx-auto max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                                XEYGATE is the cloud AI gateway that routes your requests to OpenAI,
                                Anthropic, Google and more with a single API key — quotas enforced, every
                                request traced, and a live model marketplace where you buy the best price
                                or sell your own supply. All from one dashboard.
                            </p>
                            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                                <Button size="lg" render={<Link to="/register" />} className="cursor-pointer gap-2">
                                    START FOR FREE
                                    <ArrowRight className="size-4" />
                                </Button>
                                <Button size="lg" variant="outline" render={<Link to="/catalog" />} className="cursor-pointer">
                                    VIEW MARKETPLACE
                                </Button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Live Analytics — stats + charts */}
                <LiveAnalyticsSection />

                {/* Code showcase */}
                <section className="border-b border-border/60">
                    <CodeShowcase />
                </section>

                {/* Use cases */}
                <section className="border-b border-border/60 bg-secondary/10 py-16 sm:py-20">
                    <div className="mx-auto max-w-5xl px-4">
                        <SectionHead
                            kicker="USE C4S3S"
                            title="Built for"
                            leet="[A1 APPS, AG3NTS, PR0DUCT T34MS]"
                            desc="From chatbots to batch pipelines — if it touches many AI models, XEYGATE sits in the middle."
                        />
                        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {useCases.map(({ icon: Icon, title, desc }) => (
                                <div
                                    key={title}
                                    className="group space-y-3 rounded-xl border border-border/70 bg-card p-5 transition-colors hover:border-emerald-500/50"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex size-8 items-center justify-center rounded-lg border border-border/60 bg-secondary/60">
                                            <Icon className="size-4 text-emerald-500" strokeWidth={1.75} />
                                        </div>
                                        <ArrowUpRight className="size-4 text-muted-foreground/0 transition-colors group-hover:text-emerald-500" />
                                    </div>
                                    <h3 className="text-sm font-semibold">{title}</h3>
                                    <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Features */}
                <section className="border-b border-border/60 py-16 sm:py-20">
                    <div className="mx-auto max-w-5xl px-4">
                        <SectionHead
                            kicker="F3ATUR3S"
                            title="The gateway"
                            leet="[PR0DUCT10N TRU5TS]"
                            desc="Everything that keeps one key safe to share across customers — and makes every token dollar accountable."
                        />
                        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {features.map(({ icon: Icon, title, desc }) => (
                                <div key={title} className="space-y-3 rounded-xl border border-border/70 bg-secondary/10 p-5">
                                    <div className="flex size-8 items-center justify-center rounded-lg border border-border/60 bg-card">
                                        <Icon className="size-4 text-muted-foreground" strokeWidth={1.75} />
                                    </div>
                                    <h3 className="text-sm font-semibold">{title}</h3>
                                    <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Marketplace / Official strip */}
                <section className="border-b border-border/60 bg-secondary/20 py-16 sm:py-20">
                    <div className="mx-auto max-w-5xl px-4">
                        <div className="grid items-center gap-10 lg:grid-cols-2">
                            <div className="space-y-5">
                                <p className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-500">
                                    <BadgeCheck className="size-3" />
                                    XEYGATE MARKETPLACE
                                </p>
                                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                                    Sell your models. Ship on <span className="text-emerald-500">Official</span>{" "}
                                    supply.
                                </h2>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    A two-sided marketplace: XeyCompany publishes official provider fleets,
                                    badged{" "}
                                    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                        <BadgeCheck className="size-2.5" />
                                        Official
                                    </span>
                                    , while creators connect their own API keys and sell curated model
                                    subsets — every price set in the open, every listing governed by the
                                    platform.
                                </p>
                                <Button render={<Link to="/catalog" />} className="cursor-pointer gap-2">
                                    Browse marketplace
                                    <ArrowRight className="size-4" />
                                </Button>
                            </div>
                            <div className="space-y-3">
                                {officialSteps.map(({ icon: Icon, title, desc }, i) => (
                                    <div
                                        key={title}
                                        className="flex items-start gap-4 rounded-xl border border-border/70 bg-card p-4"
                                    >
                                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                                            <Icon className="size-4 text-emerald-500" strokeWidth={1.75} />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-semibold">
                                                <span className="mr-1.5 text-muted-foreground">0{i + 1}</span>
                                                {title}
                                            </p>
                                            <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Final CTA */}
                <section className="relative overflow-hidden py-20 sm:py-24">
                    <div className="pointer-events-none absolute inset-0 bg-grid-pattern" />
                    <div className="pointer-events-none absolute bottom-0 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
                    <div className="relative mx-auto max-w-2xl space-y-6 px-4 text-center">
                        <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">
                            BUILD W1TH <span className="animate-shimmer-text">XEYGATE</span>
                        </h2>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            One account, one key, every AI model. Free to start right now — no credit card,
                            no sales call, five minutes to your first request.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                            <Button size="lg" render={<Link to="/register" />} className="cursor-pointer gap-2">
                                START FOR FREE
                                <ArrowRight className="size-4" />
                            </Button>
                            <Button size="lg" variant="outline" render={<Link to="/catalog" />} className="cursor-pointer">
                                <Search className="size-4" />
                                Browse models
                            </Button>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="border-t border-border/60 bg-secondary/20">
                <div className="mx-auto max-w-6xl px-4 py-10">
                    <div className="grid gap-8 sm:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="flex size-6 items-center justify-center rounded-md border border-border/80 bg-secondary">
                                    <svg viewBox="0 0 24 24" fill="none" className="size-3.5">
                                        <path
                                            d="M13 2.5L5 13H11.5L9.5 21.5L18.5 10H12L13.5 2.5Z"
                                            fill="currentColor"
                                            fillOpacity="0.92"
                                        />
                                    </svg>
                                </div>
                                <span className="text-sm font-bold tracking-tight">XEYGATE</span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                The cloud AI gateway &amp; model marketplace by XeyCompany.
                            </p>
                        </div>
                        <div className="space-y-2 text-xs">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                                Product
                            </p>
                            <Link to="/catalog" className="block text-muted-foreground transition-colors hover:text-foreground">
                                Marketplace
                            </Link>
                            <Link to="/register" className="block text-muted-foreground transition-colors hover:text-foreground">
                                Get started
                            </Link>
                            <Link to="/login" className="block text-muted-foreground transition-colors hover:text-foreground">
                                Dashboard
                            </Link>
                        </div>
                        <div className="space-y-2 text-xs">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                                Docs
                            </p>
                            <Link to="/docs" className="block text-muted-foreground transition-colors hover:text-foreground">
                                Documentation
                            </Link>
                            <Link to="/docs/api-reference" className="block text-muted-foreground transition-colors hover:text-foreground">
                                API Reference
                            </Link>
                        </div>
                        <div className="space-y-2 text-xs">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                                Legal
                            </p>
                            <Link to="/terms" className="block text-muted-foreground transition-colors hover:text-foreground">
                                Terms of Service
                            </Link>
                            <Link to="/privacy" className="block text-muted-foreground transition-colors hover:text-foreground">
                                Privacy Policy
                            </Link>
                            <Link to="/acceptable-use" className="block text-muted-foreground transition-colors hover:text-foreground">
                                Acceptable Use
                            </Link>
                            <Link to="/refund" className="block text-muted-foreground transition-colors hover:text-foreground">
                                Refund Policy
                            </Link>
                        </div>
                        <div className="space-y-2 text-xs">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                                Status
                            </p>
                            <span className="block text-muted-foreground">
                                <span className="mr-1.5 inline-block size-1.5 rounded-full bg-emerald-500" />
                                All systems operational
                            </span>
                        </div>
                    </div>
                    <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-5 text-[11px] text-muted-foreground">
                        <span>© {new Date().getFullYear()} XeyCompany · XEYGATE</span>
                        <span className="flex items-center gap-1">
                            <Gauge className="size-3" />
                            {GATEWAY_BASE_URL} · one endpoint to rule them all
                        </span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
