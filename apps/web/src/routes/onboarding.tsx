import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Store, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
    component: OnboardingPage
});

type Role = "buyer" | "creator";

function OnboardingPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [selected, setSelected] = useState<Role | null>(null);

    const roleMutation = useMutation({
        mutationFn: (role: Role) => api.put("/v1/users/role", { role }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["user-auth-status"] });
            navigate({ to: "/dashboard" });
        }
    });

    function handleContinue() {
        if (selected) roleMutation.mutate(selected);
    }

    return (
        <main className="flex min-h-svh items-center justify-center bg-background px-4 py-8 font-mono">
            <div className="w-full max-w-2xl space-y-8">
                <div className="text-center space-y-2">
                    <h1 className="text-2xl font-bold tracking-tight">Welcome to XEYGATE</h1>
                    <p className="text-sm text-muted-foreground">
                        How do you want to use the gateway? You can change this later.
                    </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <RoleCard
                        icon={ShoppingCart}
                        title="Buy APIs"
                        subtitle="Consumer"
                        desc="Get your own API keys and call LLM providers through the gateway. Pay per token, track usage, manage quotas."
                        selected={selected === "buyer"}
                        onSelect={() => setSelected("buyer")}
                    />
                    <RoleCard
                        icon={Store}
                        title="Sell APIs"
                        subtitle="Creator"
                        desc="Connect your own provider accounts and sell API access to other developers. Earn revenue on every request."
                        selected={selected === "creator"}
                        onSelect={() => setSelected("creator")}
                    />
                </div>

                <div className="flex justify-center">
                    <Button
                        size="lg"
                        className="cursor-pointer gap-2"
                        disabled={!selected || roleMutation.isPending}
                        onClick={handleContinue}
                    >
                        {roleMutation.isPending ? "Setting up..." : "Continue"}
                        <ArrowRight className="size-4" />
                    </Button>
                </div>

                {roleMutation.isError && (
                    <p className="text-center text-xs text-destructive">
                        {roleMutation.error instanceof Error ? roleMutation.error.message : "Failed to set role"}
                    </p>
                )}
            </div>
        </main>
    );
}

function RoleCard({
    icon: Icon,
    title,
    subtitle,
    desc,
    selected,
    onSelect
}: {
    icon: typeof ShoppingCart;
    title: string;
    subtitle: string;
    desc: string;
    selected: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={`flex flex-col items-start gap-3 rounded-xl border p-5 text-left transition-all cursor-pointer ${
                selected
                    ? "border-foreground bg-secondary/60 shadow-sm"
                    : "border-border/70 bg-background hover:border-border hover:bg-secondary/30"
            }`}
        >
            <div className="flex size-10 items-center justify-center rounded-lg border border-border/60 bg-secondary/50">
                <Icon className="size-5 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{title}</span>
                    <span className="rounded-xs border border-border/70 bg-secondary/70 px-1 py-0.5 text-[8px] font-semibold text-muted-foreground/80 uppercase leading-none">
                        {subtitle}
                    </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
        </button>
    );
}
