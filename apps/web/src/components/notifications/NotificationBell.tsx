import { useState } from "react";
import { Bell } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Notification } from "@srouter/types";

// ── Types ──────────────────────────────────────────────────

interface NotificationWithRead extends Notification {
    read: boolean;
}

// ── API helpers ────────────────────────────────────────────

async function fetchNotifications(): Promise<{ notifications: NotificationWithRead[]; total: number }> {
    const res = await api.get<{ notifications: NotificationWithRead[]; total: number }>("/v1/users/notifications?limit=50");
    return res;
}

async function fetchUnreadCount(): Promise<{ count: number }> {
    const res = await api.get<{ count: number }>("/v1/users/notifications/unread-count");
    return res;
}

async function markAsRead(notificationId: string): Promise<void> {
    await api.post(`/v1/users/notifications/${notificationId}/read`);
}

async function markAllAsRead(): Promise<void> {
    await api.post("/v1/users/notifications/read-all");
}

// ── Badge indicator ────────────────────────────────────────

function UnreadBadge({ count }: { count: number }) {
    if (count === 0) return null;
    return (
        <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">
            {count > 9 ? "9+" : count}
        </span>
    );
}

// ── Notification item ──────────────────────────────────────

function NotificationItem({
    notification,
    onRead
}: {
    notification: NotificationWithRead;
    onRead: (id: string) => void;
}) {
    const typeColors: Record<string, string> = {
        announcement: "bg-blue-500/10 text-blue-500",
        maintenance: "bg-amber-500/10 text-amber-500",
        model_disable: "bg-red-500/10 text-red-500",
        update: "bg-emerald-500/10 text-emerald-500",
        alert: "bg-orange-500/10 text-orange-500",
        info: "bg-gray-500/10 text-gray-500"
    };

    const typeLabels: Record<string, string> = {
        announcement: "Announcement",
        maintenance: "Maintenance",
        model_disable: "Model Disable",
        update: "Update",
        alert: "Alert",
        info: "Info"
    };

    return (
        <div
            className={`flex flex-col gap-1 rounded-lg border p-3 transition-colors ${
                notification.read
                    ? "border-border/50 bg-background"
                    : "border-border/80 bg-secondary/30"
            } hover:border-border/80`}
            onClick={() => !notification.read && onRead(notification.id)}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span
                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                            typeColors[notification.type] || typeColors.info
                        }`}
                    >
                        {typeLabels[notification.type] || notification.type}
                    </span>
                    {!notification.read && (
                        <span className="size-2 rounded-full bg-emerald-500" />
                    )}
                </div>
                <span className="text-[10px] text-muted-foreground">
                    {new Date(notification.createdAt).toLocaleDateString()}
                </span>
            </div>
            <h4 className="text-sm font-semibold leading-tight">{notification.title}</h4>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                {notification.message}
            </p>
        </div>
    );
}

// ── Main notification bell component ───────────────────────

export function NotificationBell() {
    const [isOpen, setIsOpen] = useState(false);
    const queryClient = useQueryClient();

    const { data: unreadData } = useQuery({
        queryKey: ["notifications-unread-count"],
        queryFn: fetchUnreadCount,
        refetchInterval: 30000 // Poll every 30 seconds
    });

    const { data: notificationsData, isLoading } = useQuery({
        queryKey: ["notifications"],
        queryFn: fetchNotifications,
        enabled: isOpen // Only fetch when dropdown is open
    });

    const readMutation = useMutation({
        mutationFn: markAsRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
            queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
        }
    });

    const readAllMutation = useMutation({
        mutationFn: markAllAsRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
            queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
        }
    });

    const unreadCount = unreadData?.count ?? 0;
    const notifications = notificationsData?.notifications ?? [];

    return (
        <div className="relative">
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsOpen(!isOpen)}
                className="relative size-8 rounded-md text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground cursor-pointer"
                title="Notifications"
            >
                <Bell className="size-3.5" strokeWidth={1.75} />
                <UnreadBadge count={unreadCount} />
            </Button>

            {isOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-border/80 bg-card shadow-2xl">
                    <div className="flex items-center justify-between border-b border-border/60 p-3">
                        <h3 className="text-sm font-semibold">Notifications</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={() => readAllMutation.mutate()}
                                className="text-[10px] text-emerald-500 hover:text-emerald-400 cursor-pointer"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>
                    <div className="max-h-80 overflow-y-auto p-2">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="size-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="py-8 text-center text-xs text-muted-foreground">
                                No notifications
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {notifications.map((n) => (
                                    <NotificationItem
                                        key={n.id}
                                        notification={n}
                                        onRead={(id) => readMutation.mutate(id)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
