import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Boxes, Gauge, KeyRound, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
    component: LandingPage
});

const features = [
    {
        icon: Boxes,
        title: "Multi-Provider Routing",
        desc: "Route requests across OpenAI, Anthropic, Google, and more with automatic failover and load balancing."
    },
    {
        icon: KeyRound,
        title: "API Key Management",
        desc: "Issue, rotate, and scope API keys per consumer. Full audit trail on every request."
    },
    {
        icon: Gauge,
        title: "Quotas & Rate Limits",
        desc: "Per-key and per-model rate limits with sliding-window enforcement and graceful back-pressure."
    },
    {
        icon: Zap,
        title: "Combo Routing",
        desc: "Chain providers into fallback combos — primary, secondary, tertiary — with per-step health checks."
    }
] as const;

function LandingPage() {
    return (
        <div className="min-h-screen bg-background text-foreground font-mono">
            {/* Nav */}
            <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md">
                <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
                    <div className="flex items-center gap-2">
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
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            render={<Link to="/login" />}
                            className="text-xs cursor-pointer"
                        >
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
                <section className="mx-auto max-w-5xl px-4 py-24 sm:py-32">
                    <div className="max-w-2xl space-y-6">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            AI Gateway · Self-hosted
                        </p>
                        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
                            One endpoint.{" "}
                            <span className="text-muted-foreground">Every provider.</span>
                            <br />
                            Full control.
                        </h1>
                        <p className="text-base text-muted-foreground leading-relaxed sm:text-lg">
                            XEYGATE is an open-source AI gateway that sits between your applications and
                            LLM providers. Manage API keys, enforce quotas, route across providers, and
                            observe every request — all from a single self-hosted dashboard.
                        </p>
                        <div className="flex flex-wrap gap-3 pt-2">
                            <Button size="lg" render={<Link to="/register" />} className="cursor-pointer gap-2">
                                Create an account
                                <ArrowRight className="size-4" />
                            </Button>
                            <Button
                                size="lg"
                                variant="outline"
                                render={<Link to="/admin" />}
                                className="cursor-pointer"
                            >
                                Admin panel
                            </Button>
                        </div>
                    </div>
                </section>

                {/* Features */}
                <section className="border-t border-border/60 bg-secondary/20">
                    <div className="mx-auto max-w-5xl px-4 py-20">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-10">
                            Capabilities
                        </h2>
                        <div className="grid gap-6 sm:grid-cols-2">
                            {features.map(({ icon: Icon, title, desc }) => (
                                <div
                                    key={title}
                                    className="rounded-xl border border-border/70 bg-background p-5 space-y-2"
                                >
                                    <div className="flex size-8 items-center justify-center rounded-lg border border-border/60 bg-secondary/60">
                                        <Icon className="size-4 text-muted-foreground" strokeWidth={1.75} />
                                    </div>
                                    <h3 className="text-sm font-semibold">{title}</h3>
                                    <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <section className="border-t border-border/60">
                    <div className="mx-auto max-w-5xl px-4 py-20 text-center space-y-6">
                        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                            Ready to gateway your AI traffic?
                        </h2>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto">
                            Deploy in minutes with a single Docker command. No vendor lock-in, no usage caps.
                        </p>
                        <Button size="lg" render={<Link to="/register" />} className="cursor-pointer gap-2">
                            Get started free
                            <ArrowRight className="size-4" />
                        </Button>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="border-t border-border/60">
                <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6 text-xs text-muted-foreground">
                    <span>© {new Date().getFullYear()} XeyCompany · XEYGATE</span>
                    <Link to="/admin" className="hover:text-foreground transition-colors">
                        Admin
                    </Link>
                </div>
            </footer>
        </div>
    );
}
