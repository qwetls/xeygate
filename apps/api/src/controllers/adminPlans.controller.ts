import type { Context } from "hono";
import { listPlanConfigsDB, updatePlanConfigDB, type PlanConfig } from "@srouter/db";
import type { PlanId, PlanTierName } from "@srouter/constants";
import { Err, Ok } from "@/utils/response.js";

const PLAN_IDS: PlanId[] = ["starter", "pro", "pro_max", "payg"];
const TIER_NAMES: PlanTierName[] = ["starter", "pro", "pro_max"];

function toDisplayConfig(cfg: PlanConfig) {
    return {
        id: cfg.plan,
        label: cfg.label,
        priceCentsUsd: cfg.priceCentsUsd,
        dailyTokens: cfg.dailyTokens,
        rpm: cfg.rpm,
        minTier: cfg.minTier
    };
}

export class AdminPlansController {
    /** GET /v1/plans — public pricing page feed. */
    public static async PublicPlans(c: Context): Promise<Response> {
        const configs = await listPlanConfigsDB();
        return Ok(c, { object: "plans", plans: configs.map(toDisplayConfig) });
    }

    /** GET /v1/admin/plans — full config incl. audit timestamp. */
    public static async ListPlans(c: Context): Promise<Response> {
        const configs = await listPlanConfigsDB();
        return Ok(c, {
            plans: configs.map((cfg) => ({ ...toDisplayConfig(cfg), updatedAt: cfg.updatedAt }))
        });
    }

    /** PUT /v1/admin/plans/:plan — partial update of a plan's limits. */
    public static async UpdatePlan(c: Context): Promise<Response> {
        const plan = c.req.param("plan") as PlanId;
        if (!PLAN_IDS.includes(plan)) {
            return Err(c, `Plan must be one of: ${PLAN_IDS.join(", ")}`, 400, {
                code: "invalid_plan"
            });
        }

        const body = await c.req.json<Record<string, unknown>>().catch(() => ({}));
        const patch: {
            label?: string;
            priceCentsUsd?: number;
            dailyTokens?: number;
            rpm?: number;
            minTier?: PlanTierName;
        } = {};

        if (body.label !== undefined) {
            const label = typeof body.label === "string" ? body.label.trim() : "";
            if (!label || label.length > 40) {
                return Err(c, "Label must be a non-empty string of at most 40 characters", 400, {
                    code: "invalid_label"
                });
            }
            patch.label = label;
        }

        if (body.priceCentsUsd !== undefined) {
            const price = Number(body.priceCentsUsd);
            if (!Number.isInteger(price) || price < 0 || price > 1_000_000) {
                return Err(c, "Price must be an integer number of cents between 0 and 1000000", 400, {
                    code: "invalid_price"
                });
            }
            patch.priceCentsUsd = price;
        }

        if (body.dailyTokens !== undefined) {
            const tokens = Number(body.dailyTokens);
            // 0 keeps the existing codebase convention: unlimited.
            if (!Number.isInteger(tokens) || tokens < 0 || tokens > 1e12) {
                return Err(c, "Daily token limit must be an integer ≥ 0 (0 = unlimited)", 400, {
                    code: "invalid_daily_tokens"
                });
            }
            patch.dailyTokens = tokens;
        }

        if (body.rpm !== undefined) {
            const rpm = Number(body.rpm);
            if (!Number.isInteger(rpm) || rpm < 0 || rpm > 100_000) {
                return Err(c, "Requests-per-minute must be an integer ≥ 0 (0 = unlimited)", 400, {
                    code: "invalid_rpm"
                });
            }
            patch.rpm = rpm;
        }

        if (body.minTier !== undefined) {
            const tier = body.minTier as PlanTierName;
            if (!TIER_NAMES.includes(tier)) {
                return Err(c, `Model access must be one of: ${TIER_NAMES.join(", ")}`, 400, {
                    code: "invalid_min_tier"
                });
            }
            patch.minTier = tier;
        }

        if (Object.keys(patch).length === 0) {
            return Err(c, "Provide at least one field to update", 400, { code: "empty_patch" });
        }

        const updated = await updatePlanConfigDB(plan, patch);
        if (!updated) return Err(c, "Plan configuration not found", 404);
        return Ok(c, { plan: { ...toDisplayConfig(updated), updatedAt: updated.updatedAt } });
    }
}
