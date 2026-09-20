import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    BadgeCheck,
    ArrowRight,
    ArrowLeft,
    Rocket,
    ShieldCheck,
    BarChart3,
    Store
} from "lucide-react";

export const Route = createFileRoute("/apply-creator")({
    component: ApplyCreatorPage,
    staticData: { title: "Apply as Creator" }
});

const STEPS = [
    {
        icon: Store,
        title: "Connect your provider",
        desc: "Add your own LLM provider API keys — OpenAI, Anthropic, or any OpenAI-compatible endpoint."
    },
    {
        icon: BadgeCheck,
        title: "Get verified",
        desc: "An admin reviews your application to ensure quality and compliance with marketplace policies."
    },
    {
        icon: BarChart3,
        title: "Set your prices",
        desc: "Choose per-token pricing for each model. You control the rates — the marketplace displays them to buyers."
    },
    {
        icon: Rocket,
        title: "Start selling",
        desc: "Once approved, your models appear on the marketplace. Buyers discover and route through your supply."
    }
];

const REQUIREMENTS = [
    "A valid use case — sell curated LLM access to buyers on the marketplace",
    "Your own provider API keys (at least one) to proxy through XEYGATE",
    "Accurate brand / display name (max 80 characters)",
    "A description of what you plan to offer (max 2000 characters)"
];

function ApplyCreatorPage() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { data: user } = useQuery({
        queryKey: ["user-auth-status"],
        queryFn: () => api.get<{ role?: string; creatorStatus?: string }>("/v1/users/me"),
        retry: false
    });

    const [displayName, setDisplayName] = useState("");
    const [reason, setReason] = useState("");
    const [link, setLink] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);

    const isCreator = user?.role === "creator";
    const creatorPending = user?.creatorStatus === "pending";

    const upgradeMutation = useMutation({
        mutationFn: () =>
            api.put("/v1/users/role", {
                role: "creator",
                displayName,
                reason,
                link
            }),
        onSuccess: () => {
            setError(null);
            setSubmitted(true);
            queryClient.invalidateQueries({ queryKey: ["user-auth-status"] });
        },
        onError: (err: unknown) => {
            const message = err instanceof Error ? err.message : "";
            if (message.includes("creator_applications_closed") || message.toLowerCase().includes("applications are closed")) {
                setError("Creator applications are closed right now. Check back later.");
            } else if (message.includes("creator_form_incomplete") || message.toLowerCase().includes("displayname and reason")) {
                setError("Please fill in your brand name and describe how you plan to use the marketplace.");
            } else if (message.includes("creator_form_too_long") || message.toLowerCase().includes("length limits")) {
                setError("One of the fields is too long. Keep the description under 2000 characters.");
            } else {
                setError(message || "Failed to submit application. Please try again.");
            }
        }
    });

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        upgradeMutation.mutate();
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-background text-foreground font-mono">
                <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md">
                    <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
                        <Link to="/" className="flex items-center gap-2">
                            <span className="text-sm font-bold tracking-tight">XEYGATE</span>
                        </Link>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" render={<Link to="/login" />} className="text-xs cursor-pointer">Sign in</Button>
                            <Button size="sm" render={<Link to="/register" />} className="text-xs cursor-pointer">Get started</Button>
                        </div>
                    </div>
                </header>
                <main className="mx-auto max-w-3xl px-4 py-16 text-center">
                    <p className="text-sm text-muted-foreground">
                        Please <Link to="/login" className="text-emerald-500 hover:underline">sign in</Link> to apply as a creator.
                    </p>
                </main>
            </div>
        );
    }

    if (isCreator || creatorPending || submitted) {
        return (
            <div className="min-h-screen bg-background text-foreground font-mono">
                <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md">
                    <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
                        <Link to="/" className="flex items-center gap-2">
                            <span className="text-sm font-bold tracking-tight">XEYGATE</span>
                        </Link>
                        <Button size="sm" render={<Link to="/dashboard" />} className="text-xs cursor-pointer">Dashboard</Button>
                    </div>
                </header>
                <main className="mx-auto max-w-3xl px-4 py-16">
                    <Card>
                        <CardContent className="py-12 text-center">
                            {isCreator ? (
                                <>
                                    <BadgeCheck className="mx-auto size-10 text-emerald-500 mb-3" />
                                    <h2 className="text-lg font-bold">You&apos;re already a Creator</h2>
                                    <p className="mt-1 text-xs text-muted-foreground">Head to your dashboard to manage providers and listings.</p>
                                    <Button size="sm" className="mt-4 cursor-pointer" render={<Link to="/dashboard" />}>Go to Dashboard</Button>
                                </>
                            ) : (
                                <>
                                    <Store className="mx-auto size-10 text-amber-500 mb-3" />
                                    <h2 className="text-lg font-bold">
                                        {submitted ? "Application submitted" : "Application pending"}
                                    </h2>
                                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
                                        {submitted
                                            ? "Thanks! Your creator application has been submitted. An admin will review it shortly."
                                            : "An admin is reviewing your creator request. You&apos;ll be able to add providers and sell APIs once it&apos;s approved."}
                                    </p>
                                    <Button size="sm" className="mt-4 cursor-pointer" render={<Link to="/dashboard" />}>Back to Dashboard</Button>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground font-mono">
            <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md">
                <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
                    <Link to="/" className="flex items-center gap-2">
                        <span className="text-sm font-bold tracking-tight">XEYGATE</span>
                        <span className="rounded-xs border border-border/70 bg-secondary/70 px-1 py-0.5 text-[8px] font-semibold text-muted-foreground/80 uppercase leading-none">Creator</span>
                    </Link>
                    <Button variant="ghost" size="sm" render={<Link to="/dashboard" />} className="text-xs cursor-pointer gap-1.5">
                        <ArrowLeft className="size-3" />
                        Dashboard
                    </Button>
                </div>
            </header>

            <main className="mx-auto max-w-3xl px-4 py-12">
                {/* Hero */}
                <div className="mb-10">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">
                        Become a Creator
                    </p>
                    <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                        Sell your models on the marketplace.
                    </h1>
                    <p className="mt-3 max-w-xl text-sm text-muted-foreground leading-relaxed">
                        Connect your own LLM provider accounts and sell API access through XEYGATE.
                        You set the prices, you control the supply. Every request is logged, every
                        token is metered.
                    </p>
                </div>

                {/* How it works */}
                <section className="mb-10">
                    <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-4">How it works</h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {STEPS.map(({ icon: Icon, title, desc }, i) => (
                            <div key={title} className="flex items-start gap-3 rounded-xl border border-border/70 bg-secondary/20 p-4">
                                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                                    <span className="text-xs font-bold text-emerald-500">{i + 1}</span>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold">{title}</p>
                                    <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Requirements */}
                <section className="mb-10">
                    <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-4">Requirements</h2>
                    <div className="rounded-xl border border-border/70 bg-card p-4">
                        <ul className="space-y-2">
                            {REQUIREMENTS.map((req) => (
                                <li key={req} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                                    <ShieldCheck className="size-3.5 shrink-0 mt-0.5 text-emerald-500" />
                                    {req}
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                {/* Application form */}
                <section>
                    <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-4">Your application</h2>
                    <Card>
                        <CardContent className="pt-6">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid gap-2.5">
                                    <label className="grid gap-1">
                                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                            Brand / display name <span className="text-destructive">*</span>
                                        </span>
                                        <Input
                                            value={displayName}
                                            maxLength={80}
                                            autoFocus
                                            placeholder="e.g. Acme AI"
                                            onChange={(e) => setDisplayName(e.target.value)}
                                        />
                                    </label>
                                    <label className="grid gap-1">
                                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                            What will you offer? <span className="text-destructive">*</span>
                                        </span>
                                        <textarea
                                            value={reason}
                                            maxLength={2000}
                                            rows={4}
                                            placeholder="Describe the providers or models you plan to connect and who you expect to serve..."
                                            className="flex min-h-16 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                                            onChange={(e) => setReason(e.target.value)}
                                        />
                                        <span className="text-[10px] text-muted-foreground/60">
                                            {reason.length}/2000
                                        </span>
                                    </label>
                                    <label className="grid gap-1">
                                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                            Link (site, portfolio, or repo) — optional
                                        </span>
                                        <Input
                                            value={link}
                                            maxLength={300}
                                            type="url"
                                            placeholder="https://..."
                                            onChange={(e) => setLink(e.target.value)}
                                        />
                                    </label>
                                </div>

                                {error && (
                                    <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                                        {error}
                                    </p>
                                )}

                                <div className="flex items-center gap-2 pt-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-xs cursor-pointer"
                                        onClick={() => navigate({ to: "/dashboard" })}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        size="sm"
                                        className="h-8 text-xs font-semibold cursor-pointer gap-1.5"
                                        disabled={upgradeMutation.isPending || !displayName.trim() || !reason.trim()}
                                    >
                                        {upgradeMutation.isPending ? "Submitting..." : "Submit application"}
                                        <ArrowRight className="size-3.5" />
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </section>
            </main>
        </div>
    );
}
