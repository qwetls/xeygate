import {
    getCustomModelsByProviderDB,
    getCustomModelsForProviderDB,
    userAuthStore,
    type CustomModelRow
} from "@srouter/db";
import { providerBaseId } from "@srouter/constants";

// ── Marketplace scope (namespaces) ──────────────────────────────────────

/**
 * Marketplace key space. /user/v1 serves creator listings only, /official/v1
 * serves platform-official (admin-owned) listings only; the unscoped /v1
 * default ("all") serves both for backward compatibility.
 */
export type MarketplaceScope = "user" | "official" | "all";

// ── Official provider detection ─────────────────────────────────────────

export function IsOfficialOwnerId(ownerId: string | null | undefined): boolean {
    return !ownerId;
}

/**
 * Official supply = platform-owned: legacy rows without an owner, or a
 * connection whose owner account has is_admin set.
 */
export async function IsOfficialProviderRow(row: {
    ownerId?: string | null;
}): Promise<boolean> {
    if (IsOfficialOwnerId(row.ownerId)) return true;
    const cached = officialFlagCache.get(row.ownerId!);
    if (cached && Date.now() < cached.expires) return cached.value;
    const user = await userAuthStore.getUserById(row.ownerId!);
    const value = Boolean(user?.isAdmin);
    officialFlagCache.set(row.ownerId!, {
        value,
        expires: Date.now() + OFFICIAL_TTL_MS
    });
    return value;
}

const OFFICIAL_TTL_MS = 60_000;
const officialFlagCache = new Map<
    string,
    { value: boolean; expires: number }
>();

export function InvalidateOfficialCache(ownerId?: string): void {
    if (ownerId) officialFlagCache.delete(ownerId);
    else officialFlagCache.clear();
}

// ── Marketplace row selection per provider ───────────────────────────────

/**
 * Custom_models rows that surface for one provider in the marketplace.
 *
 * Official listings are keyed by the shared provider identity (base id) and
 * inherited by every connection of that driver — the admin registers the
 * catalog once, then connects keys in any order.  Creator listings stay
 * connection-scoped: UUID-based keys can never collide with a base id.
 */
export async function SelectMarketplaceRows(
    row: { id: string; providerId?: string | null },
    isOfficial: boolean
): Promise<CustomModelRow[]> {
    const key = (row.providerId || row.id).toLowerCase();
    if (!isOfficial) return getCustomModelsByProviderDB(key);
    const base = providerBaseId(key).toLowerCase();
    return base === key
        ? getCustomModelsByProviderDB(key)
        : getCustomModelsForProviderDB(key, base);
}
