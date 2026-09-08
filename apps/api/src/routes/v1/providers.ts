import { Hono } from "hono";
import { ProvidersController } from "@/controllers/providers.controller.js";
import { RequireAdmin } from "@/middleware/AdminAuth.js";
import { RequireCreator } from "@/middleware/CreatorAuth.js";
import { ApiKeyAuth } from "@/middleware/ApiKeyAuth.js";
import {
    getCreatorEarningsDB,
    getEarningsSummaryDB,
    listPayoutsDB,
    createPayoutRequestDB,
    getAvailableBalanceDB,
    getPendingPayoutCountDB,
    markEarningsPaidForPayoutDB,
    userAuthStore
} from "@srouter/db";
import { Err, Ok } from "@/utils/response.js";

export const ProvidersRouter = new Hono();

// Minimum payout a creator may request (keeps manual transfers worthwhile).
export const MIN_PAYOUT_AMOUNT = 10;

// Creator-scoped management (session cookie + creator role).
// Registered before the ":providerId" wildcard so "mine" is not captured as an ID.
ProvidersRouter.get("/providers/mine", RequireCreator, ProvidersController.ListMyProviders);
ProvidersRouter.post("/providers/mine", RequireCreator, ProvidersController.AddMyProvider);
ProvidersRouter.post(
    "/providers/mine/verify",
    RequireCreator,
    ProvidersController.VerifyMyProvider
);
ProvidersRouter.delete("/providers/mine/:id", RequireCreator, ProvidersController.DeleteMyProvider);
ProvidersRouter.patch("/providers/mine/:id", RequireCreator, ProvidersController.UpdateMyProvider);

// Creator earnings dashboard.
ProvidersRouter.get("/providers/mine/earnings", RequireCreator, async (c) => {
    const userId = c.get("userId") as string;
    const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
    const offset = Math.max(Number(c.req.query("offset") ?? 0), 0);
    const [earnings, summary] = await Promise.all([
        getCreatorEarningsDB(userId, limit, offset),
        getEarningsSummaryDB(userId)
    ]);
    return Ok(c, { earnings, summary });
});

// Creator payout requests (internal balance → tracked payout, admin pays out).
ProvidersRouter.get("/providers/mine/payouts", RequireCreator, async (c) => {
    const userId = c.get("userId") as string;
    const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
    const offset = Math.max(Number(c.req.query("offset") ?? 0), 0);
    const [payouts, available] = await Promise.all([
        listPayoutsDB(userId, limit, offset),
        getAvailableBalanceDB(userId)
    ]);
    return Ok(c, { payouts, available });
});

ProvidersRouter.post("/providers/mine/payouts/request", RequireCreator, async (c) => {
    const userId = c.get("userId") as string;
    const body = await c.req.json<{ amount?: number }>().catch(() => ({}));
    const amount = Math.round(Number(body.amount) * 1e6) / 1e6;
    if (!amount || amount < MIN_PAYOUT_AMOUNT) {
        return Err(c, `Minimum payout is $${MIN_PAYOUT_AMOUNT}`, 400, {
            code: "below_minimum_payout"
        });
    }

    const [available, pendingCount, wallet] = await Promise.all([
        getAvailableBalanceDB(userId),
        getPendingPayoutCountDB(userId),
        userAuthStore.getUserCredits(userId)
    ]);
    if (pendingCount > 0) {
        return Err(c, "You already have a payout request pending review.", 409, {
            code: "payout_pending"
        });
    }
    if (amount > Math.min(available, wallet)) {
        return Err(
            c,
            `Requested $${amount} exceeds your available balance of $${Math.min(available, wallet).toFixed(2)}`,
            400,
            { code: "insufficient_balance" }
        );
    }

    const payout = await createPayoutRequestDB({ userId, amount });
    // Lock the funds: debit the creator wallet by the payout amount. The row
    // stays 'pending' until the admin processes it (paid → earnings FIFO
    // flipped to paid; failed → wallet refunded).
    await userAuthStore.updateCredits(userId, -amount);
    const availableAfter = Math.max(0, await getAvailableBalanceDB(userId));
    return Ok(c, { payout, available: availableAfter });
});

// Provider catalog is model-discovery data (same sensitivity as GET /models),
// so it stays on ApiKeyAuth — clients need it to discover routable models.
ProvidersRouter.get("/providers", ApiKeyAuth, ProvidersController.ListProviders);
ProvidersRouter.get("/providers/catalog", ApiKeyAuth, ProvidersController.GetCatalog);
ProvidersRouter.get("/providers/:providerId", ApiKeyAuth, ProvidersController.GetProvider);

// Mutation endpoints require Admin Auth
ProvidersRouter.post("/providers/verify", RequireAdmin, ProvidersController.VerifyProvider);
ProvidersRouter.post("/providers", RequireAdmin, ProvidersController.AddProvider);
ProvidersRouter.delete("/providers/:id", RequireAdmin, ProvidersController.DeleteProvider);

// Custom (user-added) models per provider driver
ProvidersRouter.post(
    "/providers/:providerId/models",
    RequireAdmin,
    ProvidersController.AddCustomModel
);
ProvidersRouter.delete(
    "/providers/:providerId/models/:modelId{.+}",
    RequireAdmin,
    ProvidersController.DeleteCustomModel
);

// Round-robin load balancing toggle
ProvidersRouter.patch(
    "/providers/:providerId/round-robin",
    RequireAdmin,
    ProvidersController.ToggleRoundRobin
);
