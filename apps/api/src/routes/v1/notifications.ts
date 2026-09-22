import { Hono } from "hono";
import {
    createNotificationDB,
    listNotificationsDB,
    listUserNotificationsDB,
    getUnreadNotificationCountDB,
    markNotificationReadDB,
    markAllNotificationsReadDB,
    deleteNotificationDB,
    countNotificationsDB,
    type NotificationType,
    type Notification
} from "@srouter/db";
import { RequireAdmin } from "@/middleware/AdminAuth.js";
import { RequireUserAuth } from "@/middleware/UserAuth.js";
import { Err, Ok } from "@/utils/response.js";

export const NotificationsRouter = new Hono();

// ── Admin endpoints ──────────────────────────────────────────

// Create a new notification (admin only)
NotificationsRouter.post("/notifications", RequireAdmin, async (c) => {
    const userId = c.get("userId") as string;
    const body = await c.req
        .json<{
            title?: string;
            message?: string;
            type?: NotificationType;
            target?: "all" | "admin" | "creator" | "buyer";
        }>()
        .catch(() => ({}));

    if (!body.title || typeof body.title !== "string" || body.title.trim().length === 0) {
        return Err(c, "Title is required", 400);
    }
    if (!body.message || typeof body.message !== "string" || body.message.trim().length === 0) {
        return Err(c, "Message is required", 400);
    }

    const validTypes: NotificationType[] = [
        "announcement",
        "maintenance",
        "model_disable",
        "update",
        "alert",
        "info"
    ];
    const type = validTypes.includes(body.type as NotificationType)
        ? (body.type as NotificationType)
        : "info";

    const validTargets = ["all", "admin", "creator", "buyer"];
    const target = validTargets.includes(body.target as "all" | "admin" | "creator" | "buyer")
        ? (body.target as "all" | "admin" | "creator" | "buyer")
        : "all";

    const notification = await createNotificationDB({
        title: body.title.trim(),
        message: body.message.trim(),
        type,
        target,
        createdBy: userId
    });

    return Ok(c, { notification });
});

// List all notifications (admin only)
NotificationsRouter.get("/notifications", RequireAdmin, async (c) => {
    const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
    const offset = Math.max(Number(c.req.query("offset") ?? 0), 0);

    const [notifications, total] = await Promise.all([
        listNotificationsDB(limit, offset),
        countNotificationsDB()
    ]);

    return Ok(c, { notifications, total });
});

// Delete a notification (admin only)
NotificationsRouter.delete("/notifications/:id", RequireAdmin, async (c) => {
    const notificationId = c.req.param("id");
    await deleteNotificationDB(notificationId);
    return Ok(c, { message: "Notification deleted" });
});

// ── User endpoints ──────────────────────────────────────────

// Get notifications for the current user (with read status)
NotificationsRouter.get("/users/notifications", RequireUserAuth, async (c) => {
    const userId = c.get("userId") as string;
    const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
    const offset = Math.max(Number(c.req.query("offset") ?? 0), 0);

    const notifications = await listUserNotificationsDB(userId, limit, offset);
    return Ok(c, { notifications });
});

// Get unread notification count for the current user
NotificationsRouter.get("/users/notifications/unread-count", RequireUserAuth, async (c) => {
    const userId = c.get("userId") as string;
    const count = await getUnreadNotificationCountDB(userId);
    return Ok(c, { count });
});

// Mark a notification as read
NotificationsRouter.post("/users/notifications/:id/read", RequireUserAuth, async (c) => {
    const userId = c.get("userId") as string;
    const notificationId = c.req.param("id");
    await markNotificationReadDB(notificationId, userId);
    return Ok(c, { message: "Notification marked as read" });
});

// Mark all notifications as read
NotificationsRouter.post("/users/notifications/read-all", RequireUserAuth, async (c) => {
    const userId = c.get("userId") as string;
    const count = await markAllNotificationsReadDB(userId);
    return Ok(c, { count, message: "All notifications marked as read" });
});
