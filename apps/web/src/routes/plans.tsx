import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Check,
    Zap,
    Shield,
    Rocket,
    CreditCard,
    ArrowRight
} from "lucide-react";

export const Route = createFileRoute("/plans")({
    component: PlansPage,
    staticData: { title: "Plans" }
});

type PlanTier = {
    id: string;
    name: string;
    badge: string;
    price: string;
    period: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    features: string[];
    cta: string;
    highlighted?: boolean;
};

const PLANS: PlanTier[] = [
    {
        id: "starter",
        name: "Starter",
        badge: "FREE",
        price: "$0",
        period: "/mo",
        description: "Try the gateway with a handful of models. No credit card required.",
        icon: Zap,
        features: [
            "Access to curated free-tier models",
            "10,000 tokens/day limit",
            "10 requests/minute",
            "Community support",
            "Basic usage dashboard"
        ],
        cta: "Get started free"
    },
    {
        id: "pro",
        name: "Pro",
        badge: "POPULAR",
        price: "$29",
        period: "/mo",
        description: "For teams and developers who need more models and higher throughput.",
        icon: Shield,
        features: [
            "All Starter models + premium supply",
            "500,000 tokens/day limit",
            "60 requests/minute",
            "Email support",
            "Advanced usage analytics",
            "Model filtering by provider"
        ],
        cta: "Subscribe to Pro",
        highlighted: true
    },
    {
        id: "pro-max",
        name: "Pro Max",
        badge: "UNLIMITED",
        price: "$99",
        period: "/mo",
        description: "Full access to every model on the platform with no artificial limits.",
        icon: Rocket,
        features: [
            "All Pro models + exclusive supply",
            "Unlimited tokens",
            "500 requests/minute",
            "Priority routing",
            "Priority support",
            "Custom model allowlists",
            "SLA guarantee"
        ],
        cta: "Subscribe to Pro Max"
    },
    {
        id: "payg",
        name: "Pay-as-you-go",
        badge: "FLEXIBLE",
        price: "No fee",
        period: "",
        description: "Top up credit and pay only for what you use. No monthly commitment.",
        icon: CreditCard,
        features: [
            "Access to all available models",
            "No monthly commitment",
            "Pay per token at listed rates",
            "Credit never expires",
            "Top up anytime via dashboard",
            "Usage capped at credit balance"
        ],
        cta: "Top up credit"
    }
];

function PlansPage() {
    const { data: user } = useQuery({
        queryKey: ["user-auth-status"],
        queryFn: () => api.get<{ role?: string }>("/v1/users/me"),
        retry: false
    });

    return (
        <div className="min-h-screen bg-background text-foreground font-mono">
            <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md">
                <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
                    <Link to="/" className="flex items-center gap-2">
                        <span className="text-sm font-bold tracking-tight">XEYGATE</span>
                    </Link>
                    <div className="flex items-center gap-2">
                        {user ? (
                            <Button size="sm" render={<Link to="/dashboard" />} className="text-xs cursor-pointer">Dashboard</Button>
                        ) : (
                            <>
                                <Button variant="ghost" size="sm" render={<Link to="/login" />} className="text-xs cursor-pointer">Sign in</Button>
                                <Button size="sm" render={<Link to="/register" />} className="text-xs cursor-pointer">Get started</Button>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <main>
                {/* Hero */}
                <section className="relative overflow-hidden border-b border-border/60">
                    <div className="pointer-events-none absolute inset-0 bg-grid-pattern" />
                    <div className="relative mx-auto max-w-3xl space-y-5 px-4 py-16 text-center sm:py-20">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">
                            Pricing
                        </p>
                        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                            One gateway. Every model. Your choice of plan.
                        </h1>
                        <p className="mx-auto max-w-xl text-sm text-muted-foreground leading-relaxed">
                            XEYGATE routes requests to official provider supply — OpenAI, Anthropic, Google,
                            and more. Pick a plan that matches your usage, or top up credit and pay as you go.
                        </p>
                    </div>
                </section>

                {/* Plans grid */}
                <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {PLANS.map((plan) => (
                            <PlanCard key={plan.id} plan={plan} user={user} />
                        ))}
                    </div>
                </section>

                {/* Comparison */}
                <section className="border-t border-border/60 bg-secondary/10 py-16 sm:py-20">
                    <div className="mx-auto max-w-5xl px-4">
                        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
                            What&apos;s included in every plan
                        </h2>
                        <p className="mt-2 text-center text-sm text-muted-foreground">
                            All plans share the same gateway infrastructure — only limits and model access differ.
                        </p>
                        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {[
                                { title: "OpenAI-compatible API", desc: "Use any OpenAI SDK or tool. Just change the base URL." },
                                { title: "Per-key quotas", desc: "Set token budgets and rate limits on each API key." },
                                { title: "Full request logging", desc: "Every request is logged with model, latency, tokens, and cost." },
                                { title: "Model prefix routing", desc: "Swap providers by changing the model prefix — your code never moves." },
                                { title: "Official supply", desc: "Admin-curated provider fleet with uptime guarantees." },
                                { title: "No vendor lock-in", desc: "Standard OpenAI format. Switch to direct API anytime." }
                            ].map(({ title, desc }) => (
                                <div key={title} className="flex items-start gap-3 rounded-xl border border-border/70 bg-card p-4">
                                    <Check className="size-4 shrink-0 mt-0.5 text-emerald-500" />
                                    <div>
                                        <p className="text-sm font-semibold">{title}</p>
                                        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* FAQ */}
                <section className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
                    <h2 className="text-center text-2xl font-bold tracking-tight">
                        Frequently asked questions
                    </h2>
                    <div className="mt-8 space-y-4">
                        {[
                            {
                                q: "Can I switch plans later?",
                                a: "Yes. Upgrade or downgrade anytime from your dashboard. Changes take effect immediately and billing is prorated."
                            },
                            {
                                q: "What happens when I hit my token limit?",
                                a: "Requests are throttled until the next day (monthly plans) or until you top up credit (pay-as-you-go)."
                            },
                            {
                                q: "Do plans include marketplace models?",
                                a: "Plans cover official admin-supplied models. Marketplace models from creators are billed separately at their listed rates."
                            },
                            {
                                q: "Is there a free trial for Pro or Pro Max?",
                                a: "The Starter plan is free forever. For Pro/Pro Max, contact us for a trial."
                            }
                        ].map(({ q, a }) => (
                            <div key={q} className="rounded-xl border border-border/70 bg-card p-4">
                                <p className="text-sm font-semibold">{q}</p>
                                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{a}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* CTA */}
                <section className="relative overflow-hidden border-t border-border/60 py-16 sm:py-20">
                    <div className="pointer-events-none absolute inset-0 bg-grid-pattern" />
                    <div className="relative mx-auto max-w-2xl space-y-5 px-4 text-center">
                        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                            Ready to start?
                        </h2>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Create an account, pick a plan, and send your first request in minutes.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                            <Button size="lg" render={<Link to="/register" />} className="cursor-pointer gap-2">
                                Get started
                                <ArrowRight className="size-4" />
                            </Button>
                            <Button size="lg" variant="outline" render={<Link to="/catalog" />} className="cursor-pointer">
                                Browse models
                            </Button>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="border-t border-border/60 bg-secondary/20">
                <div className="mx-auto max-w-6xl px-4 py-8">
                    <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold tracking-tight">XEYGATE</span>
                            <span className="text-xs text-muted-foreground">by XeyCompany</span>
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                            <Link to="/terms" className="hover:text-foreground">Terms</Link>
                            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
                            <Link to="/" className="hover:text-foreground">Home</Link>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}

function PlanCard({ plan, user }: { plan: PlanTier; user: { role?: string } | undefined }) {
    const [showApply, setShowApply] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [submitted, setSubmitted] = useState(false);

    const Icon = plan.icon;

    if (submitted) {
        return (
            <Card className="flex flex-col">
                <CardContent className="flex flex-1 flex-col items-center justify-center py-10 text-center">
                    <Check className="size-8 text-emerald-500 mb-3" />
                    <p className="text-sm font-semibold">Request received</p>
                    <p className="mt-1 text-xs text-muted-foreground">We&apos;ll reach out to set up your {plan.name} plan.</p>
                </CardContent>
            </Card>
        );
    }

    if (showApply) {
        return (
            <Card className={plan.highlighted ? "border-emerald-500/50" : ""}>
                <CardContent className="pt-5">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">
                        {plan.name} — subscribe
                    </p>
                    <form
                        onSubmit={(e) => { e.preventDefault(); if (name.trim() && email.trim()) setSubmitted(true); }}
                        className="space-y-2.5"
                    >
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your name"
                            autoFocus
                            className="h-8 text-xs"
                        />
                        <Input
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Email address"
                            type="email"
                            className="h-8 text-xs"
                        />
                        <div className="flex gap-2">
                            <Button type="submit" size="sm" disabled={!name.trim() || !email.trim()} className="h-7 text-[10px] flex-1 cursor-pointer">
                                Submit request
                            </Button>
                            <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] cursor-pointer" onClick={() => setShowApply(false)}>
                                Cancel
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={`flex flex-col ${plan.highlighted ? "border-emerald-500/50 ring-1 ring-emerald-500/20" : ""}`}>
            <CardContent className="flex flex-1 flex-col pt-5">
                <div className="flex items-center gap-2 mb-3">
                    <div className="flex size-7 items-center justify-center rounded-md bg-secondary">
                        <Icon className="size-3.5 text-muted-foreground" />
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                        {plan.badge}
                    </span>
                </div>
                <h3 className="text-lg font-bold">{plan.name}</h3>
                <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-2xl font-bold">{plan.price}</span>
                    {plan.period && <span className="text-xs text-muted-foreground">{plan.period}</span>}
                </div>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    {plan.description}
                </p>
                <ul className="mt-4 space-y-1.5 flex-1">
                    {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-[11px] text-muted-foreground leading-relaxed">
                            <Check className="size-3 shrink-0 mt-0.5 text-emerald-500" />
                            {f}
                        </li>
                    ))}
                </ul>
                <Button
                    size="sm"
                    variant={plan.highlighted ? "default" : "outline"}
                    className={`mt-4 w-full text-xs cursor-pointer ${plan.highlighted ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                    onClick={() => {
                        if (plan.id === "payg" || plan.id === "starter") {
                            if (user) {
                                window.location.href = "/dashboard/billing";
                            } else {
                                window.location.href = "/register";
                            }
                        } else {
                            setShowApply(true);
                        }
                    }}
                >
                    {plan.cta}
                </Button>
            </CardContent>
        </Card>
    );
}
