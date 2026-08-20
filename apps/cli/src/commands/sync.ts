import { getAllAdapters, getAdapter } from "../adapters/index.js";
import { defaultStore } from "../lib/configStore.js";
import { checkServerHealth, fetchAvailableModels } from "../lib/srouterClient.js";
import { formatError, formatSuccess, formatWarning, pc } from "../lib/ui.js";

export interface SyncCommandOptions {
    url?: string;
    key?: string;
}

export async function syncCommand(
    toolId?: string,
    options: SyncCommandOptions = {}
): Promise<void> {
    const savedConfig = await defaultStore.loadConfig();
    const baseUrl = options.url || savedConfig.defaultBaseUrl || "http://localhost:3000/v1";
    const apiKey = options.key || savedConfig.defaultApiKey;

    const health = await checkServerHealth(baseUrl, apiKey);
    if (!health.healthy) {
        console.error(
            formatError(
                `Cannot sync: SRouter Gateway is unreachable at ${pc.bold(baseUrl)} (${health.error || "offline"}).`
            )
        );
        process.exitCode = 1;
        return;
    }

    const availableModels = await fetchAvailableModels(baseUrl, apiKey);
    if (availableModels.length === 0) {
        console.warn(formatWarning(`SRouter Gateway responded at ${baseUrl}, but returned 0 models.`));
    }

    const adaptersToSync = toolId
        ? [getAdapter(toolId)].filter((a): a is NonNullable<typeof a> => Boolean(a))
        : getAllAdapters();

    if (toolId && adaptersToSync.length === 0) {
        console.error(formatError(`Tool '${pc.bold(toolId)}' not supported.`));
        process.exitCode = 1;
        return;
    }

    for (const adapter of adaptersToSync) {
        if (!adapter) continue;
        const status = await adapter.getStatus();
        if (!status.linked && !toolId) {
            // Skip unlinked tools if running global sync
            continue;
        }

        try {
            const result = await adapter.link({
                baseUrl,
                apiKey,
                model: savedConfig.defaultModel || status.currentModel,
                opusModel: savedConfig.defaultOpusModel,
                sonnetModel: savedConfig.defaultSonnetModel,
                haikuModel: savedConfig.defaultHaikuModel,
                availableModels
            });

            console.log(
                formatSuccess(
                    `Synced ${pc.bold(pc.cyan(availableModels.length.toString()))} models to ${pc.bold(adapter.name)} (${pc.gray(result.modifiedPath)})`
                )
            );
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(formatError(`Failed to sync ${adapter.name}: ${msg}`));
        }
    }
}
