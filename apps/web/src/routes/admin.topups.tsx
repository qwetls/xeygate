import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Coins, CreditCard, Loader2, XCircle } from "lucide-react";
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

type TopupStatus = "pending" | "approved" | "rejected" | "cancelled";

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
            return "bg-amber-500/10 text-amber-500 border-amber-500/20";
        case "approved":
            return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
        case "rejected":
            return "bg-destructive/10 text-destructive border-destructive/20";
        default:
            return "bg-muted/50 text-muted-foreground border-border/60";
    }
}

const STATUS_LABEL: Record<TopupStatus, string> = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
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
    const queryClient = useQueryClient();
    const [actingId, setActingId] = useState<string | null>(null);
    const [showAll, setShowAll] = useState(false);

    const { data, isPending, isError, error, refetch } = useQuery({
        queryKey: ["admin-topups", showAll],
        queryFn: () =>
            api.get<{ topups: TopupOrder[] }>(
                `/v1/admin/topups?status=${showAll ? "all" : "pending"}`
            ),
        refetchInterval: 30_000
    });

    const processMut = useMutation({
        mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" }) =>
            api.post<{ topup: TopupOrder }>(`/v1/admin/topups/${id}/process`, { status }),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ["admin-topups"] });
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            toast.success(
                res.topup.status === "approved"
                    ? `Top-up approved — $${res.topup.amount.toFixed(2)} credited`
                    : "Top-up rejected"
            );
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : "Failed to process top-up");
        }
    });

    const topups = data?.topups ?? [];
    const pendingCount = topups.filter((t) => t.status === "pending").length;
    const totalPending = topups
        .filter((t) => t.status === "pending")
        .reduce((sum, t) => sum + t.amount, 0);

    const runProcess = (t: TopupOrder, status: "approved" | "rejected") => {
        setActingId(`${t.id}:${status}`);
        processMut.mutate(
            { id: t.id, status },
            {
                onSettled: () => setActingId(null)
            }
        );
    };

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
                        Review buyer top-up orders. Approve once the payment has been verified
                        off-platform — the amount is credited to the buyer's wallet and recorded
                        in their ledger. Reject to close the order without crediting.
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
                        Pending{pendingCount > 0 ? ` (${pendingCount})` : ""}
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

            {!showAll && (
                <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
                        <div className="flex items-center justify-between text-muted-foreground">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                                Pending Orders
                            </span>
                            <CreditCard className="size-3.5 text-amber-500" strokeWidth={1.75} />
                        </div>
                        <div className="mt-2 text-2xl font-bold text-amber-500">
                            {pendingCount.toLocaleString()}
                        </div>
                    </div>
                    <div className="rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
                        <div className="flex items-center justify-between text-muted-foreground">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                                Total Pending
                            </span>
                            <Coins className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
                        </div>
                        <div className="mt-2 text-2xl font-bold text-foreground">
                            ${totalPending.toFixed(2)}
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
                        Top-up orders created by buyers will appear here for review.
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
                                <TableHead className="text-right">Actions</TableHead>
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
                                    <TableCell>
                                        <div className="flex items-center justify-end gap-1.5">
                                            {t.status === "pending" ? (
                                                <>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={actingId !== null}
                                                        onClick={() => void runProcess(t, "approved")}
                                                        className="h-7 gap-1 px-2 text-[11px] cursor-pointer border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                                                    >
                                                        {actingId === `${t.id}:approved` ? (
                                                            <Loader2 className="size-3 animate-spin" />
                                                        ) : (
                                                            <CheckCircle2 className="size-3" />
                                                        )}
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={actingId !== null}
                                                        onClick={() => void runProcess(t, "rejected")}
                                                        className="h-7 gap-1 px-2 text-[11px] cursor-pointer border-rose-500/30 text-rose-500 hover:bg-rose-500/10"
                                                    >
                                                        {actingId === `${t.id}:rejected` ? (
                                                            <Loader2 className="size-3 animate-spin" />
                                                        ) : (
                                                            <XCircle className="size-3" />
                                                        )}
                                                        Reject
                                                    </Button>
                                                </>
                                            ) : (
                                                <span className="text-[11px] text-muted-foreground">
                                                    {t.note ?? "—"}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
                <Coins className="size-3" />
                Approving credits the buyer's wallet instantly and writes a ledger entry. An order
                can only be processed once — approved, rejected, or buyer-cancelled orders are
                final.
            </p>
        </div>
    );
}
