import type { ModelPrice } from "./types.js";

/**
 * Normalizes raw model names by stripping provider prefixes, namespaces, and tags,
 * and resolving aliases.
 *
 * Example:
 * - "commandcode/deepseek/deepseek-v4-flash" -> "deepseek-v4-flash"
 * - "deepseek/deepseek-v4-flash:latest" -> "deepseek-v4-flash"
 * - "claude-3.5-sonnet" -> "claude-3-5-sonnet-20241022" (via alias)
 */
export function normalizeModelName(rawModel: string, aliases?: Record<string, string>): string {
    if (!rawModel) return "";

    let clean = rawModel.trim();

    // 1. Strip tags/suffixes like :free, :latest, :online, :extended
    if (clean.includes(":") && !clean.includes("://")) {
        const colonIndex = clean.lastIndexOf(":");
        clean = clean.substring(0, colonIndex).trim();
    }

    // 2. Strip namespace / provider prefixes (e.g. "commandcode/deepseek/deepseek-v4-flash" -> "deepseek-v4-flash")
    if (clean.includes("/")) {
        clean = clean.split("/").pop()?.trim() ?? clean;
    }

    // 3. Match against aliases (case-insensitive)
    if (aliases) {
        const lower = clean.toLowerCase();
        for (const [alias, target] of Object.entries(aliases)) {
            if (alias.toLowerCase() === lower) {
                return target;
            }
        }
    }

    return clean;
}

/**
 * Finds the canonical model key in the `models` dictionary that matches `rawModel`.
 * Returns the canonical model key if found, or undefined.
 */
export function findCanonicalModelKey(
    rawModel: string,
    models: Record<string, ModelPrice>,
    aliases?: Record<string, string>
): string | undefined {
    if (!rawModel) return undefined;

    // 1. Normalized name lookup first (strips provider prefix, resolves aliases)
    const normalized = normalizeModelName(rawModel, aliases);
    if (models[normalized]) {
        return normalized;
    }

    // 2. Exact match on raw input
    if (models[rawModel]) {
        return rawModel;
    }

    // 3. Case-insensitive lookup on normalized name
    const normalizedLower = normalized.toLowerCase();
    for (const key of Object.keys(models)) {
        if (key.toLowerCase() === normalizedLower) {
            return key;
        }
    }

    // 4. Case-insensitive lookup on base name (before alias substitution)
    const baseClean = (rawModel.includes("/") ? (rawModel.split("/").pop() ?? rawModel) : rawModel)
        .split(":")[0]!
        .trim()
        .toLowerCase();

    for (const key of Object.keys(models)) {
        if (key.toLowerCase() === baseClean) {
            return key;
        }
    }

    return undefined;
}
