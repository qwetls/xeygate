import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Banknote, CheckCircle2, Loader2, Wallet, XCircle } from "lucide-react";
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

export const Route = createFileRoute("/admin/payouts")({
    staticData: { title: "Payouts" },
    component: AdminPayoutsPage
});

type PayoutStatus = "pending" | "paid" | "failed" | "cancelled";

interface Payout {
    id: string;
    userId: string;
    userEmail?: string;
    userName?: string;
    amount: number;
    currency: string;
    status: PayoutStatus;
    requestedAt: number;
    processedAt?: number;
    note?: string;
}

function statusStyles(status: PayoutStatus) {
    switch (status) {
        case "pending":
            return "bg-amber-500/10 text-amber-500 border-amber-500/20";
        case "paid":
            return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
        case "failed":
            return "bg-destructive/10 text-destructive border-destructive/20";
        default:
            return "bg-muted/50 text-muted-foreground border-border/60";
    }
}

const STATUS_LABEL: Record<PayoutStatus, string> = {
    pending: "Pending",
    paid: "Paid",
    failed: "Failed",
    cancelled: "Cancelled"
};

function StatusBadge({ status }: { status: PayoutStatus }) {
    return (
        <span
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusStyles(status)}`}
        >
            {STATUS_LABEL[status]}
        </span>
    );
}

function AdminPayoutsPage() {
    const queryClient = useQueryClient();
    const [actingId, setActingId] = useState<string | null>(null);

    const { data, isPending, isError, error, refetch } = useQuery({
        queryKey: ["admin-payouts"],
        queryFn: () => api.get<{ payouts: Payout[] }>("/v1/admin/payouts"),
        refetchInterval: 30_000
    });

    const processMut = useMutation({
        mutationFn: ({ id, status, note }: { id: string; status: "paid" | "failed"; note?: string }) =>
            api.post<{ payout: Payout }>(`/v1/admin/payouts/${id}/process`, { status, note }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-payouts"] });
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            toast.success("Payout processed");
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : "Failed to process payout");
        }
    });

    const payouts = data?.payouts ?? [];
    const pendingCount = payouts.filter((p) => p.status === "pending").length;
    const totalPending = payouts
        .filter((p) => p.status === "pending")
        .reduce((sum, p) => sum + p.amount, 0);

    const runProcess = (p: Payout, status: "paid" | "failed") => {
        setActingId(`${p.id}:${status}`);
        processMut.mutate(
            { id: p.id, status },
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
                        Creator Payments
                    </p>
                    <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">
                        Payout Requests
                    </h1>
                    <p className="mt-1 max-w-2xl text-xs text-muted-foreground leading-relaxed">
                        Review creator payout requests. Mark a payout as paid once you have
                        transferred the funds off-platform, or as failed to unlock the balance
                        back to the creator.
                    </p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void refetch()}
                    className="h-8 text-xs cursor-pointer shrink-0"
                >
                    Refresh
                </Button>
            </header>

            <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div className="rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                            Pending Requests
                        </span>
                        <Banknote className="size-3.5 text-amber-500" strokeWidth={1.75} />
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
                        <Wallet className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
                    </div>
                    <div className="mt-2 text-2xl font-bold text-foreground">
                        ${totalPending.toFixed(2)}
                    </div>
                </div>
            </section>

            {isPending && !data ? (
                <div className="rounded-xl border border-border/80 bg-card/50 p-12 text-center text-sm text-muted-foreground">
                    Loading payouts…
                </div>
            ) : isError ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                    Failed to load payouts: {error instanceof Error ? error.message : "Unknown error"}
                </div>
            ) : payouts.length === 0 ? (
                <div className="rounded-xl border border-border/80 bg-card/40 p-12 text-center">
                    <Banknote
                        className="size-8 mx-auto text-muted-foreground/40 mb-3"
                        strokeWidth={1.5}
                    />
                    <h2 className="text-sm font-semibold text-foreground">No pending payouts</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Payout requests submitted by creators will appear here.
                    </p>
                </div>
            ) : (
                <div className="rounded-xl border border-border/80 bg-card/40 overflow-hidden shadow-2xs">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Creator</TableHead>
                                <TableHead>Requested</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Processed</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {payouts.map((p) => (
                                <TableRow key={p.id}>
                                    <TableCell>
                                        <div className="min-w-0">
                                            <div className="text-xs font-semibold text-foreground truncate">
                                                {p.userName || "Creator"}
                                            </div>
                                            <div className="text-[11px] text-muted-foreground truncate">
                                                {p.userEmail}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="tabular-nums text-muted-foreground">
                                        {new Date(p.requestedAt).toLocaleDateString()}{" "}
                                        {new Date(p.requestedAt).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit"
                                        })}
                                    </TableCell>
                                    <TableCell className="font-semibold text-foreground">
                                        ${p.amount.toFixed(2)}
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge status={p.status} />
                                    </TableCell>
                                    <TableCell className="tabular-nums text-muted-foreground">
                                        {p.processedAt
                                            ? new Date(p.processedAt).toLocaleDateString()
                                            : "—"}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center justify-end gap-1.5">
                                            {p.status === "pending" ? (
                                                <>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={actingId !== null}
                                                        onClick={() => void runProcess(p, "paid")}
                                                        className="h-7 gap-1 px-2 text-[11px] cursor-pointer border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                                                    >
                                                        {actingId === `${p.id}:paid` ? (
                                                            <Loader2 className="size-3 animate-spin" />
                                                        ) : (
                                                            <CheckCircle2 className="size-3" />
                                                        )}
                                                        Mark Paid
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={actingId !== null}
                                                        onClick={() => void runProcess(p, "failed")}
                                                        className="h-7 gap-1 px-2 text-[11px] cursor-pointer border-rose-500/30 text-rose-500 hover:bg-rose-500/10"
                                                    >
                                                        {actingId === `${p.id}:failed` ? (
                                                            <Loader2 className="size-3 animate-spin" />
                                                        ) : (
                                                            <XCircle className="size-3" />
                                                        )}
                                                        Fail
                                                    </Button>
                                                </>
                                            ) : (
                                                <span className="text-[11px] text-muted-foreground">
                                                    {p.note ?? "—"}
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
                <Wallet className="size-3" />
                "Mark Paid" settles the creator's earnings ledger FIFO; "Fail" refunds the amount
                back to the creator's available balance. A payout can only be processed once.
            </p>
        </div>
    );
}
