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
    Terminal,
    Workflow,
    Zap
} from "lucide-react";
import { api } from "@/lib/api";
import { Api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type {
    MarketplaceAnalyticsOverview
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
                        Switch providers by prefix
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
                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Quickstart
                        </span>
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
/*  Live Catalog Stats Panel                                          */
/* ------------------------------------------------------------------ */

function LiveStatsPanel() {
    const catalogStats = useLiveStats();
    const overview = useAnalyticsOverview();

    const stats = [
        {
            label: "Models live",
            value: catalogStats.data ? String(catalogStats.data.models) : "—",
            sub: "in catalog"
        },
        {
            label: "Providers",
            value: catalogStats.data ? String(catalogStats.data.providers) : "—",
            sub: "connected"
        },
        {
            label: "Requests 24h",
            value: overview.data ? fmtCompact(overview.data.totalRequests) : "—",
            sub: overview.data ? `${fmtPct(overview.data.successRate)} success` : undefined
        },
        {
            label: "Avg latency",
            value: overview.data ? `${Math.round(overview.data.avgLatencyMs)}ms` : "—",
            sub: "last 24h"
        }
    ];

    return (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Live
                </span>
            </div>
            <div className="grid grid-cols-2 gap-px bg-border/40">
                {stats.map((s) => (
                    <div key={s.label} className="space-y-1 bg-card p-4">
                        <p className="text-xl font-bold tracking-tight text-emerald-500 sm:text-2xl">{s.value}</p>
                        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            {s.label}
                        </p>
                        {s.sub && <p className="text-[10px] text-muted-foreground/60">{s.sub}</p>}
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Section shell                                                       */
/* ------------------------------------------------------------------ */

function SectionHead({ kicker, title, desc }: { kicker: string; title: string; desc: string }) {
    return (
        <div className="border-t border-border/60 pt-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-500">{kicker}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 sm:items-end sm:gap-10">
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
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
                <section className="relative overflow-hidden border-b border-border/60">
                    <div className="pointer-events-none absolute inset-0 bg-grid-pattern" />
                    <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:py-24 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
                        <div className="space-y-6">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-500">
                                AI Gateway &amp; Model Marketplace
                            </p>
                            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
                                Every model behind one key.
                            </h1>
                            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                                XEYGATE sits in front of OpenAI, Anthropic, Google, and the creators
                                selling supply on its marketplace. One key reaches all of them. Quotas
                                are enforced per key, and every request is logged with the exact
                                connection that served it.
                            </p>
                            <div className="flex flex-wrap items-center gap-3 pt-2">
                                <Button size="lg" render={<Link to="/register" />} className="cursor-pointer gap-2">
                                    Get started
                                    <ArrowRight className="size-4" />
                                </Button>
                                <Button size="lg" variant="outline" render={<Link to="/catalog" />} className="cursor-pointer">
                                    View marketplace
                                </Button>
                            </div>
                        </div>
                        <LiveStatsPanel />
                    </div>
                </section>

                {/* Code showcase */}
                <section className="border-b border-border/60">
                    <CodeShowcase />
                </section>

                {/* Use cases */}
                <section className="border-b border-border/60 bg-secondary/10 py-16 sm:py-20">
                    <div className="mx-auto max-w-5xl px-4">
                        <SectionHead
                            kicker="USE CASES"
                            title="What gets routed through it"
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
                            kicker="FEATURES"
                            title="What one key gets you"
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
                    <div className="relative mx-auto max-w-2xl space-y-6 px-4 text-center">
                        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                            Create your first key
                        </h2>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Create an account, issue a key, and send your first request. No card required.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                            <Button size="lg" render={<Link to="/register" />} className="cursor-pointer gap-2">
                                Get started
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
                            <Link to="/cookies" className="block text-muted-foreground transition-colors hover:text-foreground">
                                Cookie Policy
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
                            {GATEWAY_BASE_URL}
                        </span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
