import { getAdapter, getAllAdapters } from "../adapters/index.js";
import { formatError, formatInfo, formatSuccess, pc } from "../lib/ui.js";

export async function unlinkCommand(toolId: string): Promise<void> {
    const adapter = getAdapter(toolId);
    if (!adapter) {
        console.error(
            formatError(
                `Tool '${pc.bold(toolId)}' not supported. Available tools: ${getAllAdapters()
                    .map((a) => a.id)
                    .join(", ")}`
            )
        );
        process.exitCode = 1;
        return;
    }

    try {
        const restored = await adapter.unlink();
        if (restored) {
            console.log(
                formatSuccess(
                    `Restored original configuration for ${pc.bold(pc.cyan(adapter.name))}!`
                )
            );
        } else {
            console.log(
                formatInfo(
                    `No active SRouter configuration or backup found for ${pc.bold(adapter.name)}.`
                )
            );
        }
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(formatError(`Failed to unlink ${adapter.name}: ${msg}`));
        process.exitCode = 1;
    }
}
