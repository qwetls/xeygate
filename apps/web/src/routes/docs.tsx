import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
    BookOpen,
    Code2,
    Gauge,
    KeyRound,
    Layers,
    Boxes,
    ShieldCheck,
    Terminal,
    Zap,
    ExternalLink,
    ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/docs")({
    component: DocsLayout
});

const sidebarSections = [
    {
        title: "Getting Started",
        items: [
            { label: "Introduction", to: "/docs" as const, icon: BookOpen },
            { label: "Quick Start", to: "/docs" as const, icon: Zap },
            { label: "Authentication", to: "/docs" as const, icon: KeyRound }
        ]
    },
    {
        title: "Core Concepts",
        items: [
            { label: "Providers", to: "/docs" as const, icon: Boxes },
            { label: "Virtual API Keys", to: "/docs" as const, icon: KeyRound },
            { label: "Routing & Failover", to: "/docs" as const, icon: Layers },
            { label: "Quotas & Rate Limits", to: "/docs" as const, icon: Gauge }
        ]
    },
    {
        title: "Marketplace",
        items: [
            { label: "Storefront", to: "/docs" as const, icon: ShieldCheck },
            { label: "Creator Listings", to: "/docs" as const, icon: ShieldCheck },
            { label: "Namespaces", to: "/docs" as const, icon: Layers }
        ]
    },
    {
        title: "Reference",
        items: [
            { label: "API Reference", to: "/docs/api-reference" as const, icon: Code2 },
            { label: "CLI Reference", to: "/docs" as const, icon: Terminal }
        ]
    }
];

function DocsSidebar() {
    return (
        <aside className="hidden lg:block w-56 shrink-0 border-r border-border/60 pr-4">
            <nav className="sticky top-20 space-y-6 text-xs">
                {sidebarSections.map((section) => (
                    <div key={section.title} className="space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70">
                            {section.title}
                        </p>
                        {section.items.map((item) => (
                            <Link
                                key={item.label}
                                to={item.to}
                                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
                                activeProps={{ className: "text-emerald-500 bg-emerald-500/5" }}
                            >
                                <item.icon className="size-3 shrink-0" />
                                {item.label}
                            </Link>
                        ))}
                    </div>
                ))}
            </nav>
        </aside>
    );
}

function DocsLayout() {
    const matches = useRouterState({ select: (s) => s.matches });
    const isRootDocs = matches.length > 0 && matches[matches.length - 1]?.fullPath === "/docs";

    return (
        <div className="min-h-screen bg-background text-foreground font-mono">
            {/* Nav */}
            <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md">
                <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
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
                            Docs
                        </span>
                    </Link>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" render={<Link to="/catalog" />} className="text-xs cursor-pointer">
                            Marketplace
                        </Button>
                        <Button variant="ghost" size="sm" render={<Link to="/login" />} className="text-xs cursor-pointer">
                            Dashboard
                        </Button>
                    </div>
                </div>
            </header>

            <div className="mx-auto flex max-w-6xl gap-8 px-4 py-8">
                <DocsSidebar />
                <main className="flex-1 min-w-0">
                    <Outlet />
                    {isRootDocs && <DocsHome />}
                </main>
            </div>
        </div>
    );
}

function DocsHome() {
    return (
        <div className="space-y-10">
            <div className="space-y-4">
                <h1 className="text-3xl font-bold tracking-tight">Documentation</h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    XEYGATE is a cloud-first AI gateway that routes requests to OpenAI, Anthropic,
                    Google, and custom providers through one stable API key. This documentation covers
                    setup, configuration, API reference, and marketplace usage.
                </p>
            </div>

            {/* Quick links */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                    {
                        icon: Zap,
                        title: "Quick Start",
                        desc: "Get XEYGATE running with Docker or Node.js in under a minute.",
                        to: "/" as const
                    },
                    {
                        icon: Code2,
                        title: "API Reference",
                        desc: "Complete endpoint documentation with request/response examples.",
                        to: "/docs/api-reference" as const
                    },
                    {
                        icon: Boxes,
                        title: "Providers",
                        desc: "Connect OpenAI, Anthropic, Google, and custom endpoints.",
                        to: "/catalog" as const
                    }
                ].map(({ icon: Icon, title, desc, to }) => (
                    <Link
                        key={title}
                        to={to}
                        className="group space-y-2 rounded-xl border border-border/70 bg-secondary/10 p-5 transition-colors hover:border-emerald-500/50"
                    >
                        <div className="flex items-center justify-between">
                            <Icon className="size-4 text-emerald-500" />
                            <ArrowRight className="size-3.5 text-muted-foreground/0 group-hover:text-emerald-500 transition-colors" />
                        </div>
                        <h3 className="text-sm font-semibold">{title}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                    </Link>
                ))}
            </div>

            {/* Base URL */}
            <div className="rounded-xl border border-border/60 bg-secondary/10 p-5 space-y-3">
                <h2 className="text-sm font-bold">Base URL</h2>
                <div className="rounded-lg border border-border/40 bg-[var(--canvas)] px-4 py-3 font-mono text-xs">
                    <span className="text-muted-foreground">Production:</span>{" "}
                    <span className="text-emerald-500">https://gate.xeycompany.com/v1</span>
                    <br />
                    <span className="text-muted-foreground">Local:</span>{" "}
                    <span className="text-emerald-500">http://localhost:3000/v1</span>
                </div>
                <p className="text-xs text-muted-foreground">
                    All endpoints accept <code className="rounded bg-secondary px-1 py-0.5 text-[10px]">Authorization: Bearer sr-live-your_key</code>.
                    The gateway is fully OpenAI and Anthropic SDK compatible.
                </p>
            </div>

            {/* SDK Examples */}
            <div className="space-y-4">
                <h2 className="text-sm font-bold">Quick Example</h2>
                <div className="rounded-xl border border-border/60 bg-secondary/10 p-5 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">TypeScript</span>
                    </div>
                    <pre className="overflow-x-auto rounded-lg bg-[var(--canvas)] border border-border/40 p-4 text-[11px] leading-relaxed text-muted-foreground">
                        <code>{`import OpenAI from "openai";

const client = new OpenAI({
    baseURL: "https://gate.xeycompany.com/v1",
    apiKey: "sr-live-your_virtual_key"
});

const response = await client.chat.completions.create({
    model: "antigravity/gemini-3.7-flash-high",
    messages: [{ role: "user", content: "Hello!" }]
});

console.log(response.choices[0].message.content);`}</code>
                    </pre>
                </div>
            </div>

            {/* GitHub link */}
            <div className="rounded-xl border border-border/60 bg-secondary/10 p-5 flex items-center justify-between">
                <div>
                    <p className="text-sm font-semibold">Open Source</p>
                    <p className="text-xs text-muted-foreground">XEYGATE is MIT licensed. Source code on GitHub.</p>
                </div>
                <a
                    href="https://github.com/qwetls/xeygate"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md bg-[var(--ink)] text-[var(--canvas)] px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                    <ExternalLink className="size-3" />
                    GitHub
                </a>
            </div>
        </div>
    );
}
