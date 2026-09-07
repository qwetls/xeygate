import { Hono } from "hono";
import { AdminUsersController } from "@/controllers/adminUsers.controller.js";
import { RequireAdmin } from "@/middleware/AdminAuth.js";

export const AdminUsersRouter = new Hono();

AdminUsersRouter.get("/admin/users", RequireAdmin, AdminUsersController.ListUsers);
AdminUsersRouter.get("/admin/platform-analytics", RequireAdmin, AdminUsersController.PlatformAnalytics);
AdminUsersRouter.post("/admin/users/:id/approve", RequireAdmin, AdminUsersController.ApproveRegistration);
AdminUsersRouter.post("/admin/users/:id/ban", RequireAdmin, AdminUsersController.BanUser);
AdminUsersRouter.post("/admin/users/:id/unban", RequireAdmin, AdminUsersController.UnbanUser);
AdminUsersRouter.post("/admin/users/:id/revoke-api-access", RequireAdmin, AdminUsersController.RevokeApiAccess);
AdminUsersRouter.post("/admin/users/:id/approve-creator", RequireAdmin, AdminUsersController.ApproveCreator);
AdminUsersRouter.post("/admin/users/:id/reject-creator", RequireAdmin, AdminUsersController.RejectCreator);
