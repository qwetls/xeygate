import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Ban,
    CheckCircle2,
    KeyRound,
    ShieldAlert,
    ShieldCheck,
    Store,
    UserCheck,
    UserX,
    Users as UsersIcon,
    XCircle
} from "lucide-react";
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
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { formatCompactNumber } from "@/lib/utils";

export const Route = createFileRoute("/admin/users")({
    staticData: { title: "Users" },
    component: AdminUsersPage
});

type UserStatus = "active" | "pending" | "banned";
type CreatorStatus = "none" | "pending" | "approved" | "rejected";

interface AdminUser {
    id: string;
    email: string;
    name: string;
    credits: number;
    role: "buyer" | "creator";
    status: UserStatus;
    creatorStatus: CreatorStatus;
    createdAt: number;
    updatedAt: number;
}

function statusStyles(status: UserStatus) {
    switch (status) {
        case "active":
            return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
        case "pending":
            return "bg-amber-500/10 text-amber-500 border-amber-500/20";
        case "banned":
            return "bg-destructive/10 text-destructive border-destructive/20";
    }
}

function creatorStyles(status: CreatorStatus) {
    switch (status) {
        case "approved":
            return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
        case "pending":
            return "bg-amber-500/10 text-amber-500 border-amber-500/20";
        case "rejected":
            return "bg-rose-500/10 text-rose-500 border-rose-500/20";
        default:
            return "bg-muted/50 text-muted-foreground border-border/60";
    }
}

const STATUS_LABEL: Record<UserStatus, string> = {
    active: "Active",
    pending: "Pending",
    banned: "Banned"
};

const CREATOR_LABEL: Record<CreatorStatus, string> = {
    none: "—",
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected"
};

function UserStatusBadge({ status }: { status: UserStatus }) {
    return (
        <span
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusStyles(status)}`}
        >
            {STATUS_LABEL[status]}
        </span>
    );
}

function CreatorBadge({ status }: { status: CreatorStatus }) {
    return (
        <span
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${creatorStyles(status)}`}
        >
            {CREATOR_LABEL[status]}
        </span>
    );
}

function AdminUsersPage() {
    const queryClient = useQueryClient();
    const [actingId, setActingId] = useState<string | null>(null);

    const { data, isPending, isError, error, refetch } = useQuery({
        queryKey: ["admin-users"],
        queryFn: () => api.get<{ users: AdminUser[] }>("/v1/admin/users"),
        refetchInterval: 30_000
    });

    const runAction = async (userId: string, action: string) => {
        setActingId(`${userId}:${action}`);
        try {
            const res = await api.post<{ user?: AdminUser; revoked?: number }>(
                `/v1/admin/users/${userId}/${action}`
            );
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            if (action === "revoke-api-access") {
                toast.success(
                    `Revoked ${res.revoked ?? 0} API key(s) from user`
                );
            } else {
                toast.success("User updated successfully");
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Action failed";
            toast.error(msg);
        } finally {
            setActingId(null);
        }
    };

    const users = data?.users ?? [];
    const pendingRegistrations = users.filter((u) => u.status === "pending");
    const pendingCreators = users.filter((u) => u.creatorStatus === "pending");
    const bannedCount = users.filter((u) => u.status === "banned").length;
    const activeCount = users.filter((u) => u.status === "active").length;

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 font-mono">
            <header className="flex flex-col justify-between gap-3 border-b border-border/80 pb-5 sm:flex-row sm:items-end">
                <div className="min-w-0">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Access Control
                    </p>
                    <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">
                        User Management
                    </h1>
                    <p className="mt-1 max-w-2xl text-xs text-muted-foreground leading-relaxed">
                        Approve registrations and creator requests, revoke API access, and ban
                        accounts.
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

            {/* Summary metrics */}
            <section className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
                <div className="rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                            Total Users
                        </span>
                        <UsersIcon className="size-3.5" strokeWidth={1.75} />
                    </div>
                    <div className="mt-2 text-2xl font-bold text-foreground">
                        {users.length.toLocaleString()}
                    </div>
                </div>
                <div className="rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                            Pending Registrations
                        </span>
                        <UserCheck className="size-3.5 text-amber-500" strokeWidth={1.75} />
                    </div>
                    <div className="mt-2 text-2xl font-bold text-amber-500">
                        {pendingRegistrations.length.toLocaleString()}
                    </div>
                </div>
                <div className="rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                            Pending Creators
                        </span>
                        <Store className="size-3.5 text-amber-500" strokeWidth={1.75} />
                    </div>
                    <div className="mt-2 text-2xl font-bold text-amber-500">
                        {pendingCreators.length.toLocaleString()}
                    </div>
                </div>
                <div className="rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                            Active / Banned
                        </span>
                        <ShieldAlert className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
                    </div>
                    <div className="mt-2 text-2xl font-bold text-foreground">
                        {activeCount.toLocaleString()}
                        <span className="text-sm font-medium text-muted-foreground">
                            {" "}
                            / {bannedCount.toLocaleString()}
                        </span>
                    </div>
                </div>
            </section>

            {isPending && !data ? (
                <div className="rounded-xl border border-border/80 bg-card/50 p-12 text-center text-sm text-muted-foreground">
                    Loading users…
                </div>
            ) : isError ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                    Failed to load users: {error instanceof Error ? error.message : "Unknown error"}
                </div>
            ) : users.length === 0 ? (
                <Empty className="p-12">
                    <EmptyTitle>No users yet.</EmptyTitle>
                    <EmptyDescription>
                        Registered accounts will appear here once users sign up.
                    </EmptyDescription>
                </Empty>
            ) : (
                <div className="rounded-xl border border-border/80 bg-card/40 overflow-hidden shadow-2xs">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Creator</TableHead>
                                <TableHead>Credits</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((user) => {
                                const isBanned = user.status === "banned";
                                const isPendingReg = user.status === "pending";
                                const isPendingCreator = user.creatorStatus === "pending";
                                const busy = actingId !== null;
                                return (
                                    <TableRow key={user.id}>
                                        <TableCell>
                                            <div className="min-w-0">
                                                <div className="text-xs font-semibold text-foreground truncate">
                                                    {user.name || "Unnamed"}
                                                    {user.role === "creator" && (
                                                        <Store className="ml-1.5 inline size-3 text-muted-foreground" strokeWidth={1.75} />
                                                    )}
                                                </div>
                                                <div className="text-[11px] text-muted-foreground truncate">
                                                    {user.email}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <UserStatusBadge status={user.status} />
                                        </TableCell>
                                        <TableCell>
                                            <CreatorBadge status={user.creatorStatus} />
                                        </TableCell>
                                        <TableCell className="tabular-nums text-muted-foreground">
                                            {formatCompactNumber(user.credits)}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center justify-end gap-1.5">
                                                {isPendingReg && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={busy}
                                                        onClick={() => void runAction(user.id, "approve")}
                                                        className="h-7 gap-1 px-2 text-[11px] cursor-pointer"
                                                    >
                                                        <CheckCircle2 className="size-3" />
                                                        Approve
                                                    </Button>
                                                )}
                                                {isPendingCreator && (
                                                    <>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            disabled={busy}
                                                            onClick={() =>
                                                                void runAction(user.id, "approve-creator")
                                                            }
                                                            className="h-7 gap-1 px-2 text-[11px] cursor-pointer border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                                                        >
                                                            <ShieldCheck className="size-3" />
                                                            Approve Creator
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            disabled={busy}
                                                            onClick={() =>
                                                                void runAction(user.id, "reject-creator")
                                                            }
                                                            className="h-7 gap-1 px-2 text-[11px] cursor-pointer border-rose-500/30 text-rose-500 hover:bg-rose-500/10"
                                                        >
                                                            <XCircle className="size-3" />
                                                            Reject
                                                        </Button>
                                                    </>
                                                )}
                                                {!isBanned && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={busy}
                                                        onClick={() => void runAction(user.id, "ban")}
                                                        className="h-7 gap-1 px-2 text-[11px] cursor-pointer text-destructive hover:bg-destructive/10"
                                                    >
                                                        <Ban className="size-3" />
                                                        Ban
                                                    </Button>
                                                )}
                                                {isBanned && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={busy}
                                                        onClick={() => void runAction(user.id, "unban")}
                                                        className="h-7 gap-1 px-2 text-[11px] cursor-pointer"
                                                    >
                                                        <UserCheck className="size-3" />
                                                        Unban
                                                    </Button>
                                                )}
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={busy}
                                                    onClick={() =>
                                                        void runAction(user.id, "revoke-api-access")
                                                    }
                                                    className="h-7 gap-1 px-2 text-[11px] cursor-pointer"
                                                    title="Delete all API keys for this user"
                                                >
                                                    <KeyRound className="size-3" />
                                                    Revoke Keys
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}

            <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
                <UserX className="size-3" />
                Banning an account blocks sign-in and all of its API keys. Revoking keys deletes
                the user's API keys without blocking the account.
            </p>
        </div>
    );
}
