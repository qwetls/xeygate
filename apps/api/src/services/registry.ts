import {
    BAI_BASE_URL,
    BLUESMINDS_BASE_URL,
    CODEBUDDY_BASE_URL,
    CODEBUDDY_CN_BASE_URL,
    CODEBUDDY_CN_DOMAIN,
    CODEBUDDY_CN_USER_AGENT,
    DEFAULT_PROVIDERS,
    GOROUTER_BASE_URL,
    isProviderBaseId,
    isSeedProvider,
    NEOSANTARA_BASE_URL,
    OPENCODE_ZEN_BASE_URL,
    providerBaseId,
    SEED_MARKER,
    SEEKAI_BASE_URL,
    TABITOKEN_BASE_URL,
    TOKENROUTER_BASE_URL
} from "@srouter/constants";
import { deleteProviderDB, getAllProvidersDB, getAllDisabledModelsDB, getRoundRobinDB, upsertProviderDB } from "@srouter/db";
import {
    AntigravityExecutor,
    AnthropicExecutor,
    BAIExecutor,
    BluesMindsExecutor,
    CodeBuddyExecutor,
    CodexExecutor,
    CommandCodeExecutor,
    GoRouterExecutor,
    KiroExecutor,
    OpenCodeZenExecutor,
    OpenAIExecutor,
    QoderExecutor,
    SeekAIExecutor,
    TabiTokenExecutor,
    TokenRouterExecutor
} from "@srouter/executors";
import { ProviderRegistry } from "@srouter/providers";

// Create a global ProviderRegistry instance
export const registry = new ProviderRegistry();

// ── Server-side model gate ──────────────────────────────────────────────
// disabled_models is consulted on every routing candidate check, so the whole
// (tiny) table is cached briefly and flushed explicitly when a rule is
// toggled. The TTL is the cross-process safety net.
const DISABLED_GATE_TTL_MS = 30_000;
let disabledGateCache: { at: number; pairs: Set<string> } | null = null;
let disabledGateInflight: Promise<Set<string>> | null = null;

function disabledPairKey(providerId: string, modelId: string): string {
    return `${providerId}\u0000${modelId}`;
}

async function disabledModelPairs(): Promise<Set<string>> {
    if (disabledGateCache && Date.now() - disabledGateCache.at < DISABLED_GATE_TTL_MS) {
        return disabledGateCache.pairs;
    }
    if (!disabledGateInflight) {
        disabledGateInflight = getAllDisabledModelsDB()
            .then((rows) => {
                const pairs = new Set<string>();
                for (const row of rows) {
                    pairs.add(
                        disabledPairKey(row.providerId.toLowerCase(), row.modelId.toLowerCase())
                    );
                }
                disabledGateCache = { at: Date.now(), pairs };
                return pairs;
            })
            .finally(() => {
                disabledGateInflight = null;
            });
    }
    return disabledGateInflight;
}

/**
 * Official rules are stored under the shared base id, so they must shadow
 * every connection of that driver; creator rules are stored under the
 * connection id and can never collide with a base id.
 */
export async function IsModelDisabled(providerId: string, bareModelId: string): Promise<boolean> {
    const pairs = await disabledModelPairs();
    const model = bareModelId.toLowerCase();
    const connection = providerId.toLowerCase();
    if (pairs.has(disabledPairKey(connection, model))) return true;
    const base = providerBaseId(connection).toLowerCase();
    return base !== connection && pairs.has(disabledPairKey(base, model));
}

export function InvalidateDisabledModelsCache(): void {
    disabledGateCache = null;
}

registry.setModelGate(IsModelDisabled);

/**
 * Seed built-in driver rows into the providers table on first startup, so the
 * dashboard catalog is DB-driven but never empty. Rows are flagged with the
 * seed marker so they are not treated as real connections.
 */
export async function seedDefaultProviders(): Promise<void> {
    const existing = await getAllProvidersDB();
    const existingIds = new Set(existing.map((p) => p.id));
    const validSeedIds = new Set(DEFAULT_PROVIDERS.map((p) => p.id));

    // Clean up any stale seed records no longer in DEFAULT_PROVIDERS
    for (const p of existing) {
        if (isSeedProvider(p) && !validSeedIds.has(p.id)) {
            await deleteProviderDB(p.id);
        }
    }

    const now = Date.now();
    for (const seed of DEFAULT_PROVIDERS) {
        const existingRow = existing.find((p) => p.id === seed.id);
        if (!existingRow) {
            await upsertProviderDB({
                id: seed.id,
                providerId: seed.id,
                name: seed.name,
                category: seed.category,
                protocol: seed.protocol,
                base_url: seed.base_url,
                enabled: true,
                providerSpecificData: { [SEED_MARKER]: "true" },
                createdAt: now
            });
        } else if (isSeedProvider(existingRow)) {
            if (
                existingRow.category !== seed.category ||
                existingRow.protocol !== seed.protocol ||
                existingRow.name !== seed.name ||
                existingRow.base_url !== seed.base_url
            ) {
                await upsertProviderDB({
                    ...existingRow,
                    name: seed.name,
                    category: seed.category,
                    protocol: seed.protocol,
                    base_url: seed.base_url
                });
            }
        }
    }
}

/**
 * Load saved OAuth & Custom providers from SQLite Database on startup
 */
export async function loadSavedProvidersFromDB(): Promise<void> {
    const savedProviders = await getAllProvidersDB();
    for (const p of savedProviders) {
        if (!p.enabled) continue;
        // Seed rows describe drivers, not connections; they never get executors.
        if (isSeedProvider(p)) continue;

        const providerType = p.providerId || p.id;
        const baseUrl = p.base_url;
        registry.setRoundRobin(providerBaseId(p.id), await getRoundRobinDB(providerBaseId(p.id)));

        switch (true) {
            case isProviderBaseId(p.id, "kiro"):
                registry.registerProvider(
                    new KiroExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken,
                        refreshToken: p.refreshToken,
                        providerSpecificData: p.providerSpecificData
                    })
                );
                break;
            case isProviderBaseId(p.id, "codebuddy"):
                registry.registerProvider(
                    new CodeBuddyExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl:
                            baseUrl ||
                            (providerType === "codebuddy-cn"
                                ? CODEBUDDY_CN_BASE_URL
                                : CODEBUDDY_BASE_URL),
                        apiKey: p.apiKey,
                        accessToken: p.accessToken,
                        modelPrefix: providerType === "codebuddy-cn" ? "codebuddy-cn" : "codebuddy",
                        ...(providerType === "codebuddy-cn"
                            ? {
                                  domain: CODEBUDDY_CN_DOMAIN,
                                  userAgent: CODEBUDDY_CN_USER_AGENT,
                                  flavor: "cli" as const
                              }
                            : {})
                    })
                );
                break;
            case isProviderBaseId(p.id, "commandcode"):
                registry.registerProvider(
                    new CommandCodeExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken
                    })
                );
                break;
            case isProviderBaseId(p.id, "antigravity"):
                registry.registerProvider(
                    new AntigravityExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken,
                        refreshToken: p.refreshToken
                    })
                );
                break;
            case isProviderBaseId(p.id, "openai_codex"):
                registry.registerProvider(
                    new CodexExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken,
                        refreshToken: p.refreshToken,
                        accountId: p.accountId
                    })
                );
                break;
            case isProviderBaseId(p.id, "neosantara"):
                registry.registerProvider(
                    new OpenAIExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl: baseUrl || NEOSANTARA_BASE_URL,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken
                    })
                );
                break;
            case isProviderBaseId(p.id, "gorouter"):
                registry.registerProvider(
                    new GoRouterExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl: baseUrl || GOROUTER_BASE_URL,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken
                    })
                );
                break;
            case isProviderBaseId(p.id, "bluesminds"):
                registry.registerProvider(
                    new BluesMindsExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl: baseUrl || BLUESMINDS_BASE_URL,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken
                    })
                );
                break;
            case isProviderBaseId(p.id, "seekai"):
                registry.registerProvider(
                    new SeekAIExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl: baseUrl || SEEKAI_BASE_URL,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken
                    })
                );
                break;
            case isProviderBaseId(p.id, "tabitoken"):
                registry.registerProvider(
                    new TabiTokenExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl: baseUrl || TABITOKEN_BASE_URL,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken
                    })
                );
                break;
            case isProviderBaseId(p.id, "tokenrouter"):
                registry.registerProvider(
                    new TokenRouterExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl: baseUrl || TOKENROUTER_BASE_URL,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken
                    })
                );
                break;
            case isProviderBaseId(p.id, "opencode_zen") ||
                isProviderBaseId(p.id, "zen") ||
                providerType === "opencode_zen":
                registry.registerProvider(
                    new OpenCodeZenExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl: baseUrl || OPENCODE_ZEN_BASE_URL,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken
                    })
                );
                break;
            case isProviderBaseId(p.id, "bai") || providerType === "bai":
                registry.registerProvider(
                    new BAIExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl: baseUrl || BAI_BASE_URL,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken
                    })
                );
                break;
            case isProviderBaseId(p.id, "qoder"):
                registry.registerProvider(
                    new QoderExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken,
                        refreshToken: p.refreshToken,
                        providerSpecificData: p.providerSpecificData
                    })
                );
                break;
            case p.protocol === "openai" ||
                p.category === "oauth" ||
                providerType === "openai_codex" ||
                providerType === "openai" ||
                providerType === "custom_openai":
                registry.registerProvider(
                    new OpenAIExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        alias: p.alias,
                        baseUrl,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken
                    })
                );
                break;
            case isProviderBaseId(p.id, "claude") || providerType === "claude":
                registry.registerProvider(
                    new AnthropicExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken,
                        refreshToken: p.refreshToken,
                        organizationId: p.organizationId
                    })
                );
                break;
            case p.protocol === "anthropic" ||
                providerType === "anthropic" ||
                providerType === "custom_anthropic":
                registry.registerProvider(
                    new AnthropicExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        alias: p.alias,
                        baseUrl,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken
                    })
                );
                break;
            default:
                break;
        }
    }

    // Auto-register built-in free tier providers so users can immediately use them out of the box
    const freeTierSeeds = DEFAULT_PROVIDERS.filter((s) => s.category === "free_tier");
    for (const seed of freeTierSeeds) {
        const hasExplicitConnection = savedProviders.some(
            (p) => (p.id === seed.id || p.providerId === seed.id) && !isSeedProvider(p)
        );
        if (!hasExplicitConnection) {
            if (seed.id === "opencode_zen") {
                registry.registerProvider(
                    new OpenCodeZenExecutor({
                        id: seed.id,
                        name: seed.name,
                        baseUrl: seed.base_url || OPENCODE_ZEN_BASE_URL
                    })
                );
            }
        }
    }
}

/**
 * Warm model discovery after the HTTP server starts. Keeping this outside the
 * database reload helper avoids network side effects for provider mutations
 * and keeps reloads lazy when a connection is added or removed.
 */
export function warmModelRegistry(): void {
    void registry.refreshModels().catch(() => undefined);
}

// Seed built-in driver rows, then auto load saved DB providers
// Deferred to boot() — must run after PG schema init.
// Called from index.ts boot() via warmModelRegistry().
export function startProviderRegistry(): Promise<void> {
    return seedDefaultProviders().then(() => loadSavedProvidersFromDB());
}
