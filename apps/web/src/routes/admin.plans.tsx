import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Crown, CreditCard, Gauge, Gem, Loader2, Rocket, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/plans")({
    staticData: { title: "Plans" },
    component: AdminPlansPage
});

interface PlanConfig {
    id: string;
    label: string;
    priceCentsUsd: number;
    dailyTokens: number;
    rpm: number;
    minTier: string;
    updatedAt: number;
}

const PLAN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    starter: Zap,
    pro: Rocket,
    pro_max: Gem,
    payg: CreditCard
};

const TIERS = [
    { value: "starter", label: "Free-tier models only" },
    { value: "pro", label: "Free-tier + Pro models" },
    { value: "pro_max", label: "Every model" }
];

function formatLimit(n: number): string {
    return n === 0 ? "Unlimited" : n.toLocaleString();
}

function priceLabel(cfg: PlanConfig): string {
    if (cfg.id === "payg") return "No monthly fee";
    if (cfg.priceCentsUsd === 0) return "Free";
    return `$${(cfg.priceCentsUsd / 100).toFixed(2)}/mo`;
}

function PlanCard({ plan }: { plan: PlanConfig }) {
    const queryClient = useQueryClient();
    const Icon = PLAN_ICONS[plan.id] ?? Crown;

    const [label, setLabel] = useState(plan.label);
    const [price, setPrice] = useState((plan.priceCentsUsd / 100).toFixed(2));
    const [rpm, setRpm] = useState(String(plan.rpm));
    const [daily, setDaily] = useState(String(plan.dailyTokens));
    const [minTier, setMinTier] = useState(plan.minTier);

    const dirty =
        label !== plan.label ||
        price !== (plan.priceCentsUsd / 100).toFixed(2) ||
        rpm !== String(plan.rpm) ||
        daily !== String(plan.dailyTokens) ||
        minTier !== plan.minTier;

    const saveMut = useMutation({
        mutationFn: () => {
            const priceCents = Math.round(Number(price) * 100);
            return api.put<{ plan: PlanConfig }>(`/v1/admin/plans/${plan.id}`, {
                label: label.trim(),
                priceCentsUsd: priceCents,
                rpm: Number(rpm),
                dailyTokens: Number(daily),
                minTier
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin_plans"] });
            toast.success(`${plan.label} plan updated — live on the next request`);
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : "Failed to update plan");
        }
    });

    const inputCls =
        "h-8 w-full rounded-md border border-border/80 bg-background px-2.5 text-xs text-foreground outline-none focus:border-foreground/40";

    return (
        <div className="flex flex-col rounded-xl border border-border/80 bg-card p-4 shadow-2xs">
            <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-md bg-secondary">
                    <Icon className="size-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                    <div className="text-sm font-bold tracking-tight text-foreground">
                        {plan.label}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                        {priceLabel(plan)} · {formatLimit(plan.rpm)} req/min ·{" "}
                        {formatLimit(plan.dailyTokens)} tokens/day
                    </div>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
                <label className="col-span-2 flex flex-col gap-1">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Name
                    </span>
                    <input
                        className={inputCls}
                        value={label}
                        maxLength={40}
                        onChange={(e) => setLabel(e.target.value)}
                    />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Price (USD/mo)
                    </span>
                    <input
                        className={inputCls}
                        type="number"
                        min={0}
                        step="0.01"
                        value={price}
                        disabled={plan.id === "payg"}
                        onChange={(e) => setPrice(e.target.value)}
                    />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Requests / minute
                    </span>
                    <input
                        className={inputCls}
                        type="number"
                        min={0}
                        step="1"
                        value={rpm}
                        onChange={(e) => setRpm(e.target.value)}
                    />
                </label>
                <label className="col-span-2 flex flex-col gap-1">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Daily token limit (0 = unlimited)
                    </span>
                    <input
                        className={inputCls}
                        type="number"
                        min={0}
                        step="1000"
                        value={daily}
                        onChange={(e) => setDaily(e.target.value)}
                    />
                </label>
                <label className="col-span-2 flex flex-col gap-1">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Model access
                    </span>
                    <select
                        className={inputCls}
                        value={minTier}
                        onChange={(e) => setMinTier(e.target.value)}
                    >
                        {TIERS.map((t) => (
                            <option key={t.value} value={t.value}>
                                {t.label}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted-foreground">
                    {plan.updatedAt > 0
                        ? `Updated ${new Date(plan.updatedAt).toLocaleString()}`
                        : "Code defaults — never edited"}
                </span>
                <Button
                    size="sm"
                    className="h-7 cursor-pointer gap-1.5 text-[11px]"
                    disabled={!dirty || saveMut.isPending}
                    onClick={() => saveMut.mutate()}
                >
                    {saveMut.isPending ? (
                        <Loader2 className="size-3 animate-spin" />
                    ) : (
                        <Check className="size-3" />
                    )}
                    Save
                </Button>
            </div>
        </div>
    );
}

function AdminPlansPage() {
    const plansQuery = useQuery({
        queryKey: ["admin_plans"],
        queryFn: () => api.get<{ plans: PlanConfig[] }>("/v1/admin/plans")
    });

    const plans = plansQuery.data?.plans ?? [];

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 font-mono">
            <header className="border-b border-border/80 pb-5">
                <div className="flex items-center gap-2">
                    <Gauge className="size-5 text-muted-foreground" strokeWidth={1.75} />
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Plans</h1>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                    Configure the limits enforced on every request — daily token budget,
                    requests-per-minute, and which model tiers each plan can access. Changes
                    apply immediately without a redeploy and drive the public /plans page.
                </p>
            </header>

            {plansQuery.isPending && !plansQuery.data ? (
                <p className="py-10 text-center text-xs text-muted-foreground">
                    Loading plan configuration…
                </p>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                    {plans.map((plan) => (
                        <PlanCard key={plan.id} plan={plan} />
                    ))}
                </div>
            )}

            <section className="rounded-xl border border-border/70 bg-secondary/10 p-4 text-[11px] leading-relaxed text-muted-foreground">
                <p>
                    Enforcement reads this configuration on every <code>/chat/completions</code>{" "}
                    request. The daily token budget resets at midnight UTC and is tracked
                    per-user in process; the per-minute window starts at each user&apos;s first
                    request. A plan assigned with 0 keeps its fields as unlimited — use
                    Requests/minute limits to keep abuse in check without capping volume.
                </p>
            </section>
        </div>
    );
}
