// ─────────────────────────────────────────────────────────────
// Notifications — shared type definitions for API & web
// ─────────────────────────────────────────────────────────────

export type NotificationType =
    | "announcement"
    | "maintenance"
    | "model_disable"
    | "update"
    | "alert"
    | "info";

export type NotificationTarget = "all" | "admin" | "creator" | "buyer";

export interface Notification {
    id: string;
    title: string;
    message: string;
    type: NotificationType;
    target: NotificationTarget;
    createdBy: string;
    createdAt: number;
}

export interface NotificationWithRead extends Notification {
    read: boolean;
}
