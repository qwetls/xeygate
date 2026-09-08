import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Banknote, Clock, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_client/dashboard/payouts")({
    staticData: { title: "Payouts" },
    component: PayoutsPage
});

type PayoutStatus = "pending" | "paid" | "failed" | "cancelled";

interface Payout {
    id: string;
    amount: number;
    currency: string;
    status: PayoutStatus;
    requestedAt: number;
    processedAt?: number;
    note?: string;
}

const STATUS_STYLES: Record<PayoutStatus, string> = {
    pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    paid: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    failed: "bg-destructive/10 text-destructive border-destructive/20",
    cancelled: "bg-muted/50 text-muted-foreground border-border/60"
};

const STATUS_LABEL: Record<PayoutStatus, string> = {
    pending: "Pending",
    paid: "Paid",
    failed: "Failed",
    cancelled: "Cancelled"
};

function PayoutsPage() {
    const queryClient = useQueryClient();
    const [amount, setAmount] = useState("");

    const { data, isPending, error, refetch } = useQuery({
        queryKey: ["my-payouts"],
        queryFn: () =>
            api.get<{ payouts: Payout[]; available: number }>("/v1/providers/mine/payouts")
    });

    const requestMut = useMutation({
        mutationFn: () =>
            api.post<{ payout: Payout; available: number }>("/v1/providers/mine/payouts/request", {
                amount: Number(amount)
            }),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ["my-payouts"] });
            toast.success(`Payout request submitted: $${res.payout.amount.toFixed(2)}`);
            setAmount("");
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : "Payout request failed");
        }
    });

    const available = data?.available ?? 0;
    const payouts = data?.payouts ?? [];
    const hasPending = payouts.some((p) => p.status === "pending");

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 font-mono">
            <header className="border-b border-border/80 pb-5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Payouts</h1>
                <p className="mt-1 text-xs text-muted-foreground">
                    Withdraw your creator earnings. Funds are paid out by the platform admin.
                </p>
            </header>

            {isPending && !data && (
                <div className="rounded-xl border border-border/80 bg-card/40 p-8 text-center text-xs text-muted-foreground">
                    Loading payouts…
                </div>
            )}
            {error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center text-xs text-destructive">
                    Unable to load payouts:{" "}
                    {error instanceof Error ? error.message : "Unknown error"}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="ml-3 h-7 text-[11px] cursor-pointer"
                        onClick={() => void refetch()}
                    >
                        Retry
                    </Button>
                </div>
            )}

            {data && (
                <>
                    <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                        <article className="rounded-xl border border-border/80 bg-card/60 p-5 shadow-2xs">
                            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                <Wallet className="size-3.5" strokeWidth={1.75} />
                                Available Balance
                            </div>
                            <div className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                                ${available.toFixed(2)}
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                                Accrued net earnings ready to withdraw
                            </p>
                        </article>
                        <article className="rounded-xl border border-border/80 bg-card/60 p-5 shadow-2xs">
                            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                <Clock className="size-3.5" strokeWidth={1.75} />
                                Minimum Withdrawal
                            </div>
                            <div className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                                $10.00
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                                One payout request at a time
                            </p>
                        </article>
                    </section>

                    <section className="rounded-xl border border-border/80 bg-card/40 p-5 shadow-2xs">
                        <h2 className="text-sm font-bold tracking-tight text-foreground">
                            Request a Payout
                        </h2>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Your creator revenue share is paid out by the platform admin.
                        </p>
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                            <div className="flex flex-col gap-1.5">
                                <label
                                    htmlFor="payout-amount"
                                    className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                                >
                                    Amount (USD)
                                </label>
                                <input
                                    id="payout-amount"
                                    type="number"
                                    min={10}
                                    step="0.01"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="10.00"
                                    className="h-9 w-full sm:w-56 rounded-md border border-border/80 bg-background px-3 text-sm text-foreground outline-none focus:border-foreground/40"
                                />
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                className="h-9 cursor-pointer gap-1.5"
                                disabled={
                                    !amount ||
                                    Number(amount) < 10 ||
                                    Number(amount) > available ||
                                    hasPending ||
                                    requestMut.isPending
                                }
                                onClick={() => requestMut.mutate()}
                            >
                                {requestMut.isPending ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                    <Banknote className="size-3.5" />
                                )}
                                {hasPending ? "Request Pending" : "Request Payout"}
                            </Button>
                        </div>
                        {hasPending && (
                            <p className="mt-2 text-[11px] text-amber-500">
                                You already have a payout pending admin review.
                            </p>
                        )}
                        {Number(amount) > available && Number(amount) > 0 && (
                            <p className="mt-2 text-[11px] text-destructive">
                                Amount exceeds your available balance.
                            </p>
                        )}
                    </section>

                    <section className="rounded-xl border border-border/80 bg-card/40 shadow-2xs">
                        <div className="border-b border-border/80 px-5 py-4">
                            <h2 className="text-sm font-bold tracking-tight text-foreground">
                                Payout History
                            </h2>
                        </div>
                        {payouts.length === 0 ? (
                            <p className="px-5 py-8 text-center text-xs text-muted-foreground">
                                No payout requests yet.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-border/60 text-muted-foreground">
                                            <th className="px-5 py-2.5 font-medium">Requested</th>
                                            <th className="px-5 py-2.5 font-medium">Amount</th>
                                            <th className="px-5 py-2.5 font-medium">Status</th>
                                            <th className="px-5 py-2.5 font-medium">Processed</th>
                                            <th className="px-5 py-2.5 font-medium">Note</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40">
                                        {payouts.map((p) => (
                                            <tr key={p.id}>
                                                <td className="px-5 py-3 tabular-nums text-muted-foreground">
                                                    {new Date(p.requestedAt).toLocaleDateString()}{" "}
                                                    {new Date(p.requestedAt).toLocaleTimeString([], {
                                                        hour: "2-digit",
                                                        minute: "2-digit"
                                                    })}
                                                </td>
                                                <td className="px-5 py-3 font-semibold text-foreground">
                                                    ${p.amount.toFixed(2)}
                                                </td>
                                                <td className="px-5 py-3">
                                                    <span
                                                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_STYLES[p.status]}`}
                                                    >
                                                        {STATUS_LABEL[p.status]}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 tabular-nums text-muted-foreground">
                                                    {p.processedAt
                                                        ? new Date(p.processedAt).toLocaleDateString()
                                                        : "—"}
                                                </td>
                                                <td className="px-5 py-3 text-muted-foreground">
                                                    {p.note ?? "—"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}
