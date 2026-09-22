import { db } from "./db.js";
import { generateId, num, str, optStr } from "./row-utils.js";

// ─────────────────────────────────────────────────────────────
// Notifications — admin-created broadcast messages.
// Every user gets a row in `user_notification_reads` when they
// view the notification, which tracks unread/read state.
// ─────────────────────────────────────────────────────────────

export type NotificationType =
    | "announcement"
    | "maintenance"
    | "model_disable"
    | "update"
    | "alert"
    | "info";

export interface Notification {
    id: string;
    title: string;
    message: string;
    type: NotificationType;
    target: "all" | "admin" | "creator" | "buyer";
    createdBy: string;
    createdAt: number;
}

interface NotificationRow {
    id: string;
    title: string;
    message: string;
    type: string;
    target: string;
    created_by: string;
    created_at: number;
}

interface ReadRow {
    user_id: string;
    notification_id: string;
    read_at: number;
}

function mapNotificationRow(row: NotificationRow): Notification {
    return {
        id: str(row.id),
        title: str(row.title),
        message: str(row.message),
        type: str(row.type, "info") as NotificationType,
        target: str(row.target, "all") as Notification["target"],
        createdBy: str(row.created_by),
        createdAt: num(row.created_at)
    };
}

// ── Create ──────────────────────────────────────────────────

export async function createNotificationDB(data: {
    title: string;
    message: string;
    type: NotificationType;
    target?: Notification["target"];
    createdBy: string;
}): Promise<Notification> {
    const id = generateId("notif");
    const now = Date.now();
    await db
        .prepare(
            `INSERT INTO notifications (id, title, message, type, target, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
            id,
            data.title,
            data.message,
            data.type,
            data.target ?? "all",
            data.createdBy,
            now
        );
    return {
        id,
        title: data.title,
        message: data.message,
        type: data.type,
        target: data.target ?? "all",
        createdBy: data.createdBy,
        createdAt: now
    };
}

// ── List (with optional unread flag for a specific user) ────

export async function listNotificationsDB(
    limit = 50,
    offset = 0
): Promise<Notification[]> {
    const rows = (await db
        .prepare(
            `SELECT * FROM notifications ORDER BY created_at DESC LIMIT ? OFFSET ?`
        )
        .all(limit, offset)) as unknown as NotificationRow[];
    return rows.map(mapNotificationRow);
}

export async function listUserNotificationsDB(
    userId: string,
    limit = 50,
    offset = 0
): Promise<(Notification & { read: boolean })[]> {
    const rows = (await db
        .prepare(
            `SELECT n.*, r.read_at IS NOT NULL AS is_read
       FROM notifications n
       LEFT JOIN user_notification_reads r
         ON r.notification_id = n.id AND r.user_id = ?
       ORDER BY n.created_at DESC
       LIMIT ? OFFSET ?`
        )
        .all(userId, limit, offset)) as unknown as (NotificationRow & {
        is_read: number | boolean;
    })[];
    return rows.map((r) => ({
        ...mapNotificationRow(r),
        read: Boolean(r.is_read)
    }));
}

// ── Unread count ────────────────────────────────────────────

export async function getUnreadNotificationCountDB(
    userId: string
): Promise<number> {
    const row = (await db
        .prepare(
            `SELECT COUNT(*) AS count
       FROM notifications n
       LEFT JOIN user_notification_reads r
         ON r.notification_id = n.id AND r.user_id = ?
       WHERE r.notification_id IS NULL`
        )
        .get(userId)) as unknown as { count: number } | undefined;
    return num(row?.count);
}

// ── Mark read ───────────────────────────────────────────────

export async function markNotificationReadDB(
    notificationId: string,
    userId: string
): Promise<boolean> {
    const now = Date.now();
    try {
        await db
            .prepare(
                `INSERT OR IGNORE INTO user_notification_reads (user_id, notification_id, read_at)
           VALUES (?, ?, ?)`
            )
            .run(userId, notificationId, now);
        return true;
    } catch {
        return false;
    }
}

export async function markAllNotificationsReadDB(
    userId: string
): Promise<number> {
    const now = Date.now();
    // Insert read rows for all notifications this user hasn't read yet.
    const result = await db
        .prepare(
            `INSERT INTO user_notification_reads (user_id, notification_id, read_at)
       SELECT ?, n.id, ?
       FROM notifications n
       LEFT JOIN user_notification_reads r
         ON r.notification_id = n.id AND r.user_id = ?
       WHERE r.notification_id IS NULL`
        )
        .run(userId, now, userId);
    return num(result.changes);
}

// ── Delete (admin) ──────────────────────────────────────────

export async function deleteNotificationDB(
    notificationId: string
): Promise<boolean> {
    const result = await db
        .prepare(`DELETE FROM user_notification_reads WHERE notification_id = ?`)
        .run(notificationId);
    await db
        .prepare(`DELETE FROM notifications WHERE id = ?`)
        .run(notificationId);
    return true;
}

// ── Total count (admin) ─────────────────────────────────────

export async function countNotificationsDB(): Promise<number> {
    const row = (await db
        .prepare(`SELECT COUNT(*) AS count FROM notifications`)
        .get()) as unknown as { count: number } | undefined;
    return num(row?.count);
}
