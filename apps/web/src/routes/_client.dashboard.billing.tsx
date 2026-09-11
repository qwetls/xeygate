import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Coins, CreditCard, Loader2, Receipt, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_client/dashboard/billing")({
    staticData: { title: "Billing" },
    component: BillingPage
});

const TOPUP_MIN = 5;
const TOPUP_MAX = 10000;
const TOPUP_PRESETS = [10, 25, 50, 100];
const LEDGER_PAGE = 25;

type TopupStatus = "pending" | "approved" | "rejected" | "cancelled";

interface TopupOrder {
    id: string;
    amount: number;
    currency: string;
    status: TopupStatus;
    reference?: string;
    note?: string;
    requestedAt: number;
    processedAt?: number;
}

type TransactionType = "debit" | "credit" | "refund";

interface LedgerEntry {
    id: string;
    type: TransactionType;
    amount: number;
    description: string;
    model?: string;
    createdAt: number;
}

const TOPUP_STATUS_STYLES: Record<TopupStatus, string> = {
    pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    approved: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    rejected: "bg-destructive/10 text-destructive border-destructive/20",
    cancelled: "bg-muted/50 text-muted-foreground border-border/60"
};

const TOPUP_STATUS_LABEL: Record<TopupStatus, string> = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    cancelled: "Cancelled"
};

const TXN_TYPE_STYLES: Record<TransactionType, string> = {
    credit: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    debit: "bg-destructive/10 text-destructive border-destructive/20",
    refund: "bg-sky-500/10 text-sky-500 border-sky-500/20"
};

function formatDateTime(ms: number): string {
    const d = new Date(ms);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function BillingPage() {
    const queryClient = useQueryClient();
    const [amount, setAmount] = useState("");
    const [reference, setReference] = useState("");
    const [ledgerLimit, setLedgerLimit] = useState(LEDGER_PAGE);

    const balanceQuery = useQuery({
        queryKey: ["user-auth-status"],
        queryFn: () => api.get<{ credits: number }>("/v1/users/me"),
        retry: false,
        staleTime: 0
    });

    const topupsQuery = useQuery({
        queryKey: ["my-topups"],
        queryFn: () =>
            api.get<{ topups: TopupOrder[]; total: number; pending: TopupOrder | null }>(
                "/v1/users/topups"
            )
    });

    const ledgerQuery = useQuery({
        queryKey: ["billing-transactions", ledgerLimit],
        queryFn: () =>
            api.get<{ transactions: LedgerEntry[]; total: number }>(
                `/v1/users/transactions?limit=${ledgerLimit}`
            )
    });

    const invalidateWallet = () => {
        queryClient.invalidateQueries({ queryKey: ["my-topups"] });
        queryClient.invalidateQueries({ queryKey: ["billing-transactions"] });
        queryClient.invalidateQueries({ queryKey: ["user-auth-status"] });
    };

    const createMut = useMutation({
        mutationFn: () =>
            api.post<{ topup: TopupOrder }>("/v1/users/topups", {
                amount: Number(amount),
                reference: reference.trim() ? reference.trim() : undefined
            }),
        onSuccess: (res) => {
            invalidateWallet();
            toast.success(
                `Top-up order created: $${res.topup.amount.toFixed(2)} — awaiting payment verification`
            );
            setAmount("");
            setReference("");
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : "Top-up request failed");
        }
    });

    const cancelMut = useMutation({
        mutationFn: (id: string) =>
            api.post<{ topup: TopupOrder }>(`/v1/users/topups/${id}/cancel`, {}),
        onSuccess: () => {
            invalidateWallet();
            toast.success("Top-up order cancelled");
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : "Cancel failed");
        }
    });

    const credits = balanceQuery.data?.credits ?? 0;
    const topups = topupsQuery.data?.topups ?? [];
    const pending = topupsQuery.data?.pending ?? null;
    const ledger = ledgerQuery.data?.transactions ?? [];
    const ledgerTotal = ledgerQuery.data?.total ?? 0;

    const amountNum = Number(amount);
    const amountValid =
        amount.trim() !== "" &&
        Number.isFinite(amountNum) &&
        amountNum >= TOPUP_MIN &&
        amountNum <= TOPUP_MAX;

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 font-mono">
            <header className="border-b border-border/80 pb-5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Billing</h1>
                <p className="mt-1 text-xs text-muted-foreground">
                    Manage your wallet — top up credits and review every transaction.
                </p>
            </header>

            <section className="rounded-xl border border-border/80 bg-card/60 p-5 shadow-2xs">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            <Coins className="size-3.5" strokeWidth={1.75} />
                            Wallet Balance
                        </div>
                        <div className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                            ${credits.toFixed(4)}
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                            Credits are deducted automatically per request. Daily login rewards
                            land here too.
                        </p>
                    </div>
                    <Button
                        size="sm"
                        className="hidden h-8 shrink-0 cursor-pointer gap-1.5 text-xs sm:inline-flex"
                        onClick={() =>
                            document
                                .getElementById("topup-form")
                                ?.scrollIntoView({ behavior: "smooth", block: "center" })
                        }
                    >
                        <CreditCard className="size-3.5" />
                        Top up
                    </Button>
                </div>
            </section>

            {pending && (
                <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 shadow-2xs">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <span
                                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${TOPUP_STATUS_STYLES.pending}`}
                                >
                                    {TOPUP_STATUS_LABEL.pending}
                                </span>
                                <span className="text-sm font-bold text-foreground">
                                    ${pending.amount.toFixed(2)} top-up in review
                                </span>
                            </div>
                            <p className="mt-1.5 text-[11px] text-muted-foreground">
                                Created {formatDateTime(pending.requestedAt)} · order {pending.id}
                                {pending.reference ? ` · ref ${pending.reference}` : ""}
                            </p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                                Credits are added to your wallet once the admin verifies your
                                payment.
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 cursor-pointer gap-1.5 text-xs"
                            disabled={cancelMut.isPending}
                            onClick={() => cancelMut.mutate(pending.id)}
                        >
                            {cancelMut.isPending ? (
                                <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                                <XCircle className="size-3.5" />
                            )}
                            Cancel order
                        </Button>
                    </div>
                </section>
            )}

            <section
                id="topup-form"
                className="rounded-xl border border-border/80 bg-card/40 p-5 shadow-2xs"
            >
                <h2 className="text-sm font-bold tracking-tight text-foreground">Top up wallet</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Create an order, pay out-of-band, and mention your payment reference — the
                    admin approves it and credits land in your wallet.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                    {TOPUP_PRESETS.map((preset) => (
                        <button
                            key={preset}
                            type="button"
                            disabled={!!pending}
                            onClick={() => setAmount(String(preset))}
                            className={`h-8 cursor-pointer rounded-md border px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                amount === String(preset)
                                    ? "border-foreground/50 bg-foreground text-background"
                                    : "border-border/80 bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                            }`}
                        >
                            ${preset}
                        </button>
                    ))}
                </div>

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="topup-amount"
                            className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                        >
                            Amount (USD) · min ${TOPUP_MIN}
                        </label>
                        <input
                            id="topup-amount"
                            type="number"
                            min={TOPUP_MIN}
                            max={TOPUP_MAX}
                            step="0.01"
                            value={amount}
                            disabled={!!pending}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="25.00"
                            className="h-9 w-full sm:w-44 rounded-md border border-border/80 bg-background px-3 text-sm text-foreground outline-none focus:border-foreground/40 disabled:opacity-50"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="topup-reference"
                            className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                        >
                            Payment reference (optional)
                        </label>
                        <input
                            id="topup-reference"
                            type="text"
                            maxLength={100}
                            value={reference}
                            disabled={!!pending}
                            onChange={(e) => setReference(e.target.value)}
                            placeholder="Transfer proof / last 4 digits"
                            className="h-9 w-full sm:w-72 rounded-md border border-border/80 bg-background px-3 text-sm text-foreground outline-none focus:border-foreground/40 disabled:opacity-50"
                        />
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        className="h-9 cursor-pointer gap-1.5 shrink-0"
                        disabled={!amountValid || !!pending || createMut.isPending}
                        onClick={() => createMut.mutate()}
                    >
                        {createMut.isPending ? (
                            <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                            <CreditCard className="size-3.5" />
                        )}
                        Create order
                    </Button>
                </div>
                {amount.trim() !== "" && !amountValid && (
                    <p className="mt-2 text-[11px] text-destructive">
                        Amount must be between ${TOPUP_MIN} and ${TOPUP_MAX}.
                    </p>
                )}
                {pending && (
                    <p className="mt-2 text-[11px] text-amber-500">
                        Resolve your pending top-up order first to create a new one.
                    </p>
                )}
            </section>

            <section className="rounded-xl border border-border/80 bg-card/40 shadow-2xs">
                <div className="border-b border-border/80 px-5 py-4">
                    <h2 className="text-sm font-bold tracking-tight text-foreground">
                        Top-up Orders
                    </h2>
                </div>
                {topupsQuery.isPending && !topupsQuery.data ? (
                    <p className="px-5 py-8 text-center text-xs text-muted-foreground">
                        Loading orders…
                    </p>
                ) : topups.length === 0 ? (
                    <p className="px-5 py-8 text-center text-xs text-muted-foreground">
                        No top-up orders yet.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="border-b border-border/60 text-muted-foreground">
                                    <th className="px-5 py-2.5 font-medium">Created</th>
                                    <th className="px-5 py-2.5 font-medium">Amount</th>
                                    <th className="px-5 py-2.5 font-medium">Status</th>
                                    <th className="px-5 py-2.5 font-medium">Reference</th>
                                    <th className="px-5 py-2.5 font-medium">Processed</th>
                                    <th className="px-5 py-2.5 font-medium">Note</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                                {topups.map((t) => (
                                    <tr key={t.id}>
                                        <td className="px-5 py-3 tabular-nums text-muted-foreground">
                                            {formatDateTime(t.requestedAt)}
                                        </td>
                                        <td className="px-5 py-3 font-semibold text-foreground">
                                            ${t.amount.toFixed(2)}
                                        </td>
                                        <td className="px-5 py-3">
                                            <span
                                                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${TOPUP_STATUS_STYLES[t.status]}`}
                                            >
                                                {TOPUP_STATUS_LABEL[t.status]}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-muted-foreground">
                                            {t.reference ?? "—"}
                                        </td>
                                        <td className="px-5 py-3 tabular-nums text-muted-foreground">
                                            {t.processedAt ? formatDateTime(t.processedAt) : "—"}
                                        </td>
                                        <td className="px-5 py-3 text-muted-foreground">
                                            {t.note ?? "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section className="rounded-xl border border-border/80 bg-card/40 shadow-2xs">
                <div className="flex items-center justify-between border-b border-border/80 px-5 py-4">
                    <div className="flex items-center gap-2">
                        <Receipt className="size-4 text-muted-foreground" strokeWidth={1.75} />
                        <h2 className="text-sm font-bold tracking-tight text-foreground">
                            Transactions
                        </h2>
                    </div>
                    {ledgerTotal > 0 && (
                        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            {ledger.length} of {ledgerTotal}
                        </span>
                    )}
                </div>
                {ledgerQuery.isPending && !ledgerQuery.data ? (
                    <p className="px-5 py-8 text-center text-xs text-muted-foreground">
                        Loading ledger…
                    </p>
                ) : ledger.length === 0 ? (
                    <p className="px-5 py-8 text-center text-xs text-muted-foreground">
                        No transactions yet — they appear as soon as you make requests or receive
                        credits.
                    </p>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-border/60 text-muted-foreground">
                                        <th className="px-5 py-2.5 font-medium">Date</th>
                                        <th className="px-5 py-2.5 font-medium">Description</th>
                                        <th className="px-5 py-2.5 font-medium">Type</th>
                                        <th className="px-5 py-2.5 text-right font-medium">
                                            Amount
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40">
                                    {ledger.map((t) => (
                                        <tr key={t.id}>
                                            <td className="px-5 py-3 tabular-nums text-muted-foreground">
                                                {formatDateTime(t.createdAt)}
                                            </td>
                                            <td className="px-5 py-3 text-foreground">
                                                {t.description}
                                            </td>
                                            <td className="px-5 py-3">
                                                <span
                                                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${TXN_TYPE_STYLES[t.type]}`}
                                                >
                                                    {t.type}
                                                </span>
                                            </td>
                                            <td
                                                className={`px-5 py-3 text-right font-semibold tabular-nums ${
                                                    t.type === "debit"
                                                        ? "text-destructive"
                                                        : "text-emerald-500"
                                                }`}
                                            >
                                                {t.type === "debit" ? "-" : "+"}${t.amount.toFixed(4)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {ledger.length < ledgerTotal && (
                            <div className="border-t border-border/80 px-5 py-3 text-center">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 cursor-pointer text-[11px]"
                                    onClick={() => setLedgerLimit((n) => n + LEDGER_PAGE)}
                                >
                                    Load more
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </section>
        </div>
    );
}
