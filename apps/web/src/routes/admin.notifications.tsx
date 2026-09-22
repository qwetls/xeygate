import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Bell,
    Send,
    Trash2,
    Info,
    AlertTriangle,
    Megaphone,
    Wrench,
    PowerOff,
    RefreshCw,
    Shield,
    User,
    Users,
    ShieldCheck
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { ComposeNotificationDialog } from "@/components/notifications";

export const Route = createFileRoute("/admin/notifications")({
    staticData: { title: "Notifications" },
    component: AdminNotificationsPage
});

// ── Types ──────────────────────────────────────────────────

interface Notification {
    id: string;
    title: string;
    message: string;
    type: string;
    target: string;
    createdBy: string;
    createdAt: number;
}

// ── Helpers ────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Bell; color: string }> = {
    announcement: { label: "Announcement", icon: Megaphone, color: "text-blue-500 bg-blue-500/10" },
    maintenance: { label: "Maintenance", icon: Wrench, color: "text-amber-500 bg-amber-500/10" },
    model_disable: { label: "Model Disable", icon: PowerOff, color: "text-red-500 bg-red-500/10" },
    update: { label: "Update", icon: RefreshCw, color: "text-emerald-500 bg-emerald-500/10" },
    alert: { label: "Alert", icon: AlertTriangle, color: "text-orange-500 bg-orange-500/10" },
    info: { label: "Info", icon: Info, color: "text-gray-500 bg-gray-500/10" }
};

const TARGET_CONFIG: Record<string, { label: string; icon: typeof Users }> = {
    all: { label: "All Users", icon: Users },
    admin: { label: "Admins", icon: Shield },
    creator: { label: "Creators", icon: ShieldCheck },
    buyer: { label: "Buyers", icon: User }
};

function getTypeConfig(type: string) {
    return TYPE_CONFIG[type] ?? TYPE_CONFIG.info;
}

function getTargetConfig(target: string) {
    return TARGET_CONFIG[target] ?? TARGET_CONFIG.all;
}

function formatTimeAgo(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

// ── Page ───────────────────────────────────────────────────

function AdminNotificationsPage() {
    const queryClient = useQueryClient();
    const [composeOpen, setComposeOpen] = useState(false);

    const { data, isPending, error, refetch } = useQuery({
        queryKey: ["admin-notifications"],
        queryFn: () =>
            api.get<{ notifications: Notification[]; total: number }>(
                "/v1/notifications?limit=100"
            ),
        refetchInterval: 30_000
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/v1/notifications/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
            toast.success("Notification deleted");
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : "Failed to delete notification");
        }
    });

    const notifications = data?.notifications ?? [];
    const total = data?.total ?? 0;

    return (
        <div className="mx-auto w-full max-w-5xl font-mono pb-16 space-y-6">
            {/* Header */}
            <header className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-2xs">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5">
                            <div className="flex size-7.5 items-center justify-center rounded-xl border border-border/80 bg-secondary/70 text-foreground shadow-2xs">
                                <Bell className="size-4" />
                            </div>
                            <h1 className="text-base font-bold tracking-tight text-foreground">
                                Notifications
                            </h1>
                            {total > 0 && (
                                <span className="rounded-md border border-border/70 bg-secondary/50 px-2 py-0.5 text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">
                                    {total} sent
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                            Send announcements, maintenance notices, and model updates to your users.
                        </p>
                    </div>

                    <Button
                        onClick={() => setComposeOpen(true)}
                        className="cursor-pointer gap-1.5"
                    >
                        <Send className="size-3.5" />
                        Compose
                    </Button>
                </div>
            </header>

            {/* Notification list */}
            <main>
                {isPending ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="size-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 py-16 text-center">
                        <AlertTriangle className="size-5 text-destructive" />
                        <p className="text-xs text-muted-foreground">
                            Failed to load notifications
                        </p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void refetch()}
                            className="cursor-pointer gap-1.5"
                        >
                            <RefreshCw className="size-3" />
                            Retry
                        </Button>
                    </div>
                ) : notifications.length === 0 ? (
                    <Empty>
                        <EmptyTitle>No notifications yet</EmptyTitle>
                        <EmptyDescription>
                            Send your first notification to users using the compose button above.
                        </EmptyDescription>
                    </Empty>
                ) : (
                    <div className="space-y-2">
                        {notifications.map((n) => {
                            const typeConf = getTypeConfig(n.type);
                            const targetConf = getTargetConfig(n.target);
                            const TypeIcon = typeConf.icon;
                            const TargetIcon = targetConf.icon;

                            return (
                                <div
                                    key={n.id}
                                    className="flex items-start gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-2xs transition-colors hover:border-border/90"
                                >
                                    <div
                                        className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${typeConf.color}`}
                                    >
                                        <TypeIcon className="size-4" strokeWidth={1.75} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-semibold leading-tight truncate">
                                                {n.title}
                                            </h3>
                                            <span
                                                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold ${typeConf.color}`}
                                            >
                                                {typeConf.label}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                                            {n.message}
                                        </p>
                                        <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground/70">
                                            <span className="flex items-center gap-1">
                                                <TargetIcon className="size-3" />
                                                {targetConf.label}
                                            </span>
                                            <span>{formatTimeAgo(n.createdAt)}</span>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => deleteMutation.mutate(n.id)}
                                        disabled={deleteMutation.isPending}
                                        className="size-7 shrink-0 text-muted-foreground hover:text-destructive cursor-pointer"
                                        title="Delete notification"
                                    >
                                        <Trash2 className="size-3.5" />
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            <ComposeNotificationDialog
                open={composeOpen}
                onClose={() => setComposeOpen(false)}
            />
        </div>
    );
}
