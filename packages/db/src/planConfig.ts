import { db } from "./db.js";
import { num, str } from "./row-utils.js";
import { PLANS, type PlanId, type PlanTierName } from "@srouter/constants";

// ─────────────────────────────────────────────────────
// Plan configurations — admin-editable limits per plan tier.
// Seeds itself from the constant PLAN defaults the first time it is
// read, so a fresh install (or a table dropped on purpose) falls back
// to code defaults and an admin edit in the dashboard overrides them
// without a redeploy. Enforcement reads through `getPlanConfigDB`,
// which caches rows briefly (hot path: every inference request).
// ─────────────────────────────────────────────────────

export interface PlanConfig {
    plan: PlanId;
    label: string;
    /** Monthly price in cents — 0 means free (or no fee, for payg). */
    priceCentsUsd: number;
    /** Daily token budget — 0 means unlimited. */
    dailyTokens: number;
    /** Requests per minute — 0 means unlimited. */
    rpm: number;
    /** Minimum model tier the plan grants access to. */
    minTier: PlanTierName;
    updatedAt: number;
}

interface PlanConfigRow {
    plan: string;
    label: string;
    price_cents_usd: number;
    daily_tokens: number;
    rpm: number;
    min_tier: string;
    updated_at: number;
}

function mapRow(row: PlanConfigRow): PlanConfig {
    return {
        plan: str(row.plan) as PlanId,
        label: str(row.label, "Starter"),
        priceCentsUsd: num(row.price_cents_usd),
        dailyTokens: num(row.daily_tokens),
        rpm: num(row.rpm),
        minTier: (["starter", "pro", "pro_max"].includes(row.min_tier)
            ? row.min_tier
            : "starter") as PlanTierName,
        updatedAt: num(row.updated_at)
    };
}

function fallbackConfig(planId: PlanId): PlanConfig {
    const def = PLANS[planId];
    return {
        plan: def.id,
        label: def.label,
        priceCentsUsd: def.priceCentsUsd,
        dailyTokens: def.dailyTokens,
        rpm: def.requestsPerMinute,
        minTier: def.minTier,
        updatedAt: 0
    };
}

// ── Short-lived cache (TTL) — mirrors the central-denylist gate pattern ──

const CACHE_TTL_MS = 15_000;
let cache: Map<PlanId, PlanConfig> | null = null;
let cacheAt = 0;

function cacheFresh(): boolean {
    return cache !== null && Date.now() - cacheAt < CACHE_TTL_MS;
}

function invalidatePlanConfigCache(): void {
    cache = null;
    cacheAt = 0;
}

/**
 * Insert code-default rows for any plan not yet present (idempotent),
 * then return the full config map. Runs once per TTL window.
 */
async function loadAllPlanConfigs(): Promise<Map<PlanId, PlanConfig>> {
    if (cacheFresh() && cache) return cache;

    const placeholders = Object.keys(PLANS)
        .map(() => "(?, ?, ?, ?, ?, ?, ?)")
        .join(", ");
    const values: unknown[] = [];
    const now = Date.now();
    for (const def of Object.values(PLANS)) {
        values.push(def.id, def.label, def.priceCentsUsd, def.dailyTokens, def.requestsPerMinute, def.minTier, now);
    }
    await db
        .prepare(
            `INSERT INTO plan_configs (plan, label, price_cents_usd, daily_tokens, rpm, min_tier, updated_at)
             VALUES ${placeholders}
             ON CONFLICT(plan) DO NOTHING`
        )
        .run(...values);

    const rows = (await db.prepare("SELECT * FROM plan_configs").all()) as unknown as PlanConfigRow[];
    const map = new Map<PlanId, PlanConfig>();
    for (const row of rows) {
        const cfg = mapRow(row);
        map.set(cfg.plan, cfg);
    }
    cache = map;
    cacheAt = now;
    return map;
}

/** Admin-facing fresh list (no cache) — every known plan, DB row or default. */
export async function listPlanConfigsDB(): Promise<PlanConfig[]> {
    const rows = (await db.prepare("SELECT * FROM plan_configs").all()) as unknown as PlanConfigRow[];
    const map = new Map<PlanId, PlanConfig>();
    for (const row of rows) {
        const cfg = mapRow(row);
        map.set(cfg.plan, cfg);
    }
    const out: PlanConfig[] = [];
    for (const id of Object.keys(PLANS) as PlanId[]) {
        out.push(map.get(id) ?? fallbackConfig(id));
    }
    return out;
}

/** Enforcement read — cached, falls back to the constant default. */
export async function getPlanConfigDB(planId: PlanId): Promise<PlanConfig> {
    try {
        const map = await loadAllPlanConfigs();
        return map.get(planId) ?? fallbackConfig(planId);
    } catch {
        return fallbackConfig(planId);
    }
}

export interface PlanConfigPatch {
    label?: string;
    priceCentsUsd?: number;
    dailyTokens?: number;
    rpm?: number;
    minTier?: PlanTierName;
}

/** Admin edit — upserts the row and clears the cache immediately. */
export async function updatePlanConfigDB(
    planId: PlanId,
    patch: PlanConfigPatch
): Promise<PlanConfig | null> {
    const current = (await listPlanConfigsDB()).find((p) => p.plan === planId);
    if (!current) return null;

    const next: PlanConfig = {
        plan: planId,
        label: patch.label?.trim() ? patch.label.trim().slice(0, 40) : current.label,
        priceCentsUsd:
            patch.priceCentsUsd === undefined ? current.priceCentsUsd : patch.priceCentsUsd,
        dailyTokens: patch.dailyTokens === undefined ? current.dailyTokens : patch.dailyTokens,
        rpm: patch.rpm === undefined ? current.rpm : patch.rpm,
        minTier: patch.minTier ?? current.minTier,
        updatedAt: Date.now()
    };

    await db
        .prepare(
            `INSERT INTO plan_configs (plan, label, price_cents_usd, daily_tokens, rpm, min_tier, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(plan) DO UPDATE SET
               label = excluded.label,
               price_cents_usd = excluded.price_cents_usd,
               daily_tokens = excluded.daily_tokens,
               rpm = excluded.rpm,
               min_tier = excluded.min_tier,
               updated_at = excluded.updated_at`
        )
        .run(
            next.plan,
            next.label,
            next.priceCentsUsd,
            next.dailyTokens,
            next.rpm,
            next.minTier,
            next.updatedAt
        );

    invalidatePlanConfigCache();
    return next;
}
