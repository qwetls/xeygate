import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Coins, CreditCard } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";

export const Route = createFileRoute("/admin/topups")({
    staticData: { title: "Top-ups" },
    component: AdminTopupsPage
});

type TopupStatus =
    | "pending"
    | "pending_payment"
    | "approved"
    | "paid"
    | "rejected"
    | "cancelled";

interface TopupOrder {
    id: string;
    userId: string;
    userEmail?: string;
    userName?: string;
    amount: number;
    currency: string;
    status: TopupStatus;
    reference?: string;
    note?: string;
    requestedAt: number;
    processedAt?: number;
}

function statusStyles(status: TopupStatus) {
    switch (status) {
        case "pending":
        case "pending_payment":
            return "bg-amber-500/10 text-amber-500 border-amber-500/20";
        case "approved":
        case "paid":
            return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
        case "rejected":
            return "bg-destructive/10 text-destructive border-destructive/20";
        default:
            return "bg-muted/50 text-muted-foreground border-border/60";
    }
}

const STATUS_LABEL: Record<TopupStatus, string> = {
    pending: "Legacy review",
    pending_payment: "Awaiting payment",
    approved: "Paid",
    paid: "Paid",
    rejected: "Declined",
    cancelled: "Cancelled"
};

function StatusBadge({ status }: { status: TopupStatus }) {
    return (
        <span
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusStyles(status)}`}
        >
            {STATUS_LABEL[status]}
        </span>
    );
}

function AdminTopupsPage() {
    const [showAll, setShowAll] = useState(true);

    const { data, isPending, isError, error, refetch } = useQuery({
        queryKey: ["admin-topups", showAll],
        queryFn: () =>
            api.get<{ topups: TopupOrder[] }>(
                `/v1/admin/topups?status=${showAll ? "all" : "pending"}`
            ),
        refetchInterval: 30_000
    });

    const topups = data?.topups ?? [];
    const openOrders = topups.filter(
        (t) => t.status === "pending" || t.status === "pending_payment"
    );
    const totalUnpaid = openOrders.reduce((sum, t) => sum + t.amount, 0);

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 font-mono">
            <header className="flex flex-col justify-between gap-3 border-b border-border/80 pb-5 sm:flex-row sm:items-end">
                <div className="min-w-0">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Wallet Payments
                    </p>
                    <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">
                        Top-up Orders
                    </h1>
                    <p className="mt-1 max-w-2xl text-xs text-muted-foreground leading-relaxed">
                        Payment log — top-ups settle automatically through the gateway
                        (currently sandbox) and credit the buyer&apos;s wallet on payment. No
                        admin approval is needed; use this view to audit orders.
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Button
                        type="button"
                        variant={showAll ? "outline" : "default"}
                        size="sm"
                        onClick={() => setShowAll(false)}
                        className="h-8 text-xs cursor-pointer"
                    >
                        Open{openOrders.length > 0 ? ` (${openOrders.length})` : ""}
                    </Button>
                    <Button
                        type="button"
                        variant={showAll ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShowAll(true)}
                        className="h-8 text-xs cursor-pointer"
                    >
                        All
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void refetch()}
                        className="h-8 text-xs cursor-pointer"
                    >
                        Refresh
                    </Button>
                </div>
            </header>

            {showAll && (
                <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
                        <div className="flex items-center justify-between text-muted-foreground">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                                Open Orders
                            </span>
                            <CreditCard className="size-3.5 text-amber-500" strokeWidth={1.75} />
                        </div>
                        <div className="mt-2 text-2xl font-bold text-amber-500">
                            {openOrders.length.toLocaleString()}
                        </div>
                    </div>
                    <div className="rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
                        <div className="flex items-center justify-between text-muted-foreground">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                                Unpaid Total
                            </span>
                            <Coins className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
                        </div>
                        <div className="mt-2 text-2xl font-bold text-foreground">
                            ${totalUnpaid.toFixed(2)}
                        </div>
                    </div>
                </section>
            )}

            {isPending && !data ? (
                <div className="rounded-xl border border-border/80 bg-card/50 p-12 text-center text-sm text-muted-foreground">
                    Loading top-up orders…
                </div>
            ) : isError ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                    Failed to load top-ups:{" "}
                    {error instanceof Error ? error.message : "Unknown error"}
                </div>
            ) : topups.length === 0 ? (
                <div className="rounded-xl border border-border/80 bg-card/40 p-12 text-center">
                    <CreditCard
                        className="size-8 mx-auto text-muted-foreground/40 mb-3"
                        strokeWidth={1.5}
                    />
                    <h2 className="text-sm font-semibold text-foreground">
                        {showAll ? "No top-up orders yet" : "No pending top-ups"}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Top-up orders created by buyers will appear here as they are paid.
                    </p>
                </div>
            ) : (
                <div className="rounded-xl border border-border/80 bg-card/40 overflow-hidden shadow-2xs">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Buyer</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Reference</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Processed</TableHead>
                                <TableHead className="text-right">Note</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {topups.map((t) => (
                                <TableRow key={t.id}>
                                    <TableCell>
                                        <div className="min-w-0">
                                            <div className="text-xs font-semibold text-foreground truncate">
                                                {t.userName || "Buyer"}
                                            </div>
                                            <div className="text-[11px] text-muted-foreground truncate">
                                                {t.userEmail}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="tabular-nums text-muted-foreground">
                                        {new Date(t.requestedAt).toLocaleDateString()}{" "}
                                        {new Date(t.requestedAt).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit"
                                        })}
                                    </TableCell>
                                    <TableCell className="font-semibold text-foreground">
                                        ${t.amount.toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {t.reference ?? "—"}
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge status={t.status} />
                                    </TableCell>
                                    <TableCell className="tabular-nums text-muted-foreground">
                                        {t.processedAt
                                            ? new Date(t.processedAt).toLocaleDateString()
                                            : "—"}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {t.note ?? "—"}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
                <Coins className="size-3" />
                Orders settle automatically when the buyer completes the gateway payment — the
                wallet is credited and a ledger entry is written in the same step. Paid, declined,
                and cancelled orders are final.
            </p>
        </div>
    );
}
