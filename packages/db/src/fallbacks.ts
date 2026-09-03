import type {
    CreateFallbackRuleInput,
    FallbackRule,
    UpdateFallbackRuleInput
} from "@srouter/types";
import { db } from "./db.js";
import { generateId, num, optStr, str } from "./row-utils.js";

interface FallbackRuleRow {
    id: string;
    source_model: string;
    target_model: string;
    priority: number;
    enabled: number;
    trigger_on_status: string | null;
    max_retries: number | null;
    created_at: number;
}

function rowToFallbackRule(row: FallbackRuleRow): FallbackRule {
    let triggerOnStatus: number[] | undefined;
    if (row.trigger_on_status) {
        try {
            const parsed = JSON.parse(row.trigger_on_status);
            if (Array.isArray(parsed)) {
                triggerOnStatus = parsed.map((s) => num(s));
            }
        } catch {
            triggerOnStatus = undefined;
        }
    }

    return {
        id: row.id,
        sourceModel: row.source_model,
        targetModel: row.target_model,
        priority: num(row.priority, 1),
        enabled: Boolean(row.enabled),
        triggerOnStatus,
        maxRetries: row.max_retries !== null ? num(row.max_retries) : undefined,
        createdAt: num(row.created_at)
    };
}

export async function getAllFallbackRulesDB(): Promise<FallbackRule[]> {
    const Rows = (await db
        .prepare("SELECT * FROM fallback_rules ORDER BY priority ASC, created_at ASC")
        .all()) as unknown as FallbackRuleRow[];
    return Rows.map(rowToFallbackRule);
}

export async function getFallbackRuleByIdDB(id: string): Promise<FallbackRule | null> {
    const Row = (await db
        .prepare("SELECT * FROM fallback_rules WHERE id = ?")
        .get(id)) as unknown as FallbackRuleRow | undefined;
    if (!Row) return null;
    return rowToFallbackRule(Row);
}

export async function createFallbackRuleDB(input: CreateFallbackRuleInput): Promise<FallbackRule> {
    const Id = input.id || generateId("fb");
    const CreatedAt = input.createdAt || Date.now();
    const TriggerStatusStr = input.triggerOnStatus ? JSON.stringify(input.triggerOnStatus) : null;

    await db.prepare(`
        INSERT INTO fallback_rules (id, source_model, target_model, priority, enabled, trigger_on_status, max_retries, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        Id,
        input.sourceModel,
        input.targetModel,
        input.priority ?? 1,
        input.enabled !== false ? 1 : 0,
        TriggerStatusStr,
        input.maxRetries ?? 1,
        CreatedAt
    );

    return {
        id: Id,
        sourceModel: input.sourceModel,
        targetModel: input.targetModel,
        priority: input.priority ?? 1,
        enabled: input.enabled !== false,
        triggerOnStatus: input.triggerOnStatus,
        maxRetries: input.maxRetries ?? 1,
        createdAt: CreatedAt
    };
}

export async function updateFallbackRuleDB(
    id: string,
    updates: UpdateFallbackRuleInput
): Promise<FallbackRule | null> {
    const Existing = await getFallbackRuleByIdDB(id);
    if (!Existing) return null;

    const UpdatedSourceModel = updates.sourceModel ?? Existing.sourceModel;
    const UpdatedTargetModel = updates.targetModel ?? Existing.targetModel;
    const UpdatedPriority = updates.priority ?? Existing.priority;
    const UpdatedEnabled =
        updates.enabled !== undefined ? (updates.enabled ? 1 : 0) : Existing.enabled ? 1 : 0;
    const UpdatedTriggerStatus =
        updates.triggerOnStatus !== undefined
            ? updates.triggerOnStatus
                ? JSON.stringify(updates.triggerOnStatus)
                : null
            : Existing.triggerOnStatus
              ? JSON.stringify(Existing.triggerOnStatus)
              : null;
    const UpdatedMaxRetries = updates.maxRetries ?? Existing.maxRetries ?? 1;

    await db.prepare(`
        UPDATE fallback_rules
        SET source_model = ?,
            target_model = ?,
            priority = ?,
            enabled = ?,
            trigger_on_status = ?,
            max_retries = ?
        WHERE id = ?
    `).run(
        UpdatedSourceModel,
        UpdatedTargetModel,
        UpdatedPriority,
        UpdatedEnabled,
        UpdatedTriggerStatus,
        UpdatedMaxRetries,
        id
    );

    return getFallbackRuleByIdDB(id);
}

export async function deleteFallbackRuleDB(id: string): Promise<boolean> {
    const Result = await db.prepare("DELETE FROM fallback_rules WHERE id = ?").run(id);
    return num(Result.changes) > 0;
}

export async function findMatchingFallbackRulesDB(sourceModel: string): Promise<FallbackRule[]> {
    const AllRules = (await getAllFallbackRulesDB()).filter((r) => r.enabled);
    const NormalizedSource = sourceModel.toLowerCase().trim();
    const Prefix = sourceModel.includes("/") ? sourceModel.split("/")[0] : undefined;
    const NormalizedPrefix = Prefix?.toLowerCase().trim();

    const Matches: { rule: FallbackRule; matchScore: number }[] = [];

    for (const rule of AllRules) {
        const RuleSourceNormalized = rule.sourceModel.toLowerCase().trim();
        const RuleTargetNormalized = rule.targetModel.toLowerCase().trim();

        if (RuleTargetNormalized === NormalizedSource) continue;

        if (rule.sourceModel === sourceModel || RuleSourceNormalized === NormalizedSource) {
            Matches.push({ rule, matchScore: 1 });
        } else if (RuleSourceNormalized.endsWith("/*")) {
            const RulePrefix = RuleSourceNormalized.slice(0, -2);
            if (
                NormalizedPrefix &&
                (NormalizedPrefix === RulePrefix || NormalizedSource.startsWith(`${RulePrefix}/`))
            ) {
                Matches.push({ rule, matchScore: 2 });
            }
        } else if (rule.sourceModel === "*") {
            Matches.push({ rule, matchScore: 3 });
        }
    }

    Matches.sort((a, b) => {
        if (a.rule.priority !== b.rule.priority) {
            return a.rule.priority - b.rule.priority;
        }
        if (a.matchScore !== b.matchScore) {
            return a.matchScore - b.matchScore;
        }
        return a.rule.createdAt - b.rule.createdAt;
    });

    return Matches.map((m) => m.rule);
}