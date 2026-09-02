import type { TokenSaverSettings } from "@srouter/types";
import { getSettingDB, setSettingDB } from "./settings.js";

export const DEFAULT_TOKEN_SAVER_SETTINGS: TokenSaverSettings = {
    enabled: true,
    compressToolOutput: {
        enabled: true,
        compressGit: true,
        compressGrep: true,
        compressFileLists: true,
        compressLogs: true,
        stripAnsiAndWhitespace: true,
        minCharacterThreshold: 50
    },
    lazySeniorDev: {
        enabled: true,
        mode: "balanced"
    },
    compressLlmOutput: {
        enabled: true,
        mode: "terse",
        stripPleasantries: true
    }
};

const SETTINGS_KEY = "token_saver_config";

export async function getTokenSaverSettingsDB(): Promise<TokenSaverSettings> {
    const Raw = await getSettingDB(SETTINGS_KEY, "");
    if (!Raw) {
        return { ...DEFAULT_TOKEN_SAVER_SETTINGS };
    }
    try {
        const Parsed = JSON.parse(Raw) as Partial<TokenSaverSettings>;
        return {
            enabled: Parsed.enabled ?? DEFAULT_TOKEN_SAVER_SETTINGS.enabled,
            compressToolOutput: {
                ...DEFAULT_TOKEN_SAVER_SETTINGS.compressToolOutput,
                ...(Parsed.compressToolOutput ?? {})
            },
            lazySeniorDev: {
                ...DEFAULT_TOKEN_SAVER_SETTINGS.lazySeniorDev,
                ...(Parsed.lazySeniorDev ?? {})
            },
            compressLlmOutput: {
                ...DEFAULT_TOKEN_SAVER_SETTINGS.compressLlmOutput,
                ...(Parsed.compressLlmOutput ?? {})
            }
        };
    } catch {
        return { ...DEFAULT_TOKEN_SAVER_SETTINGS };
    }
}

export async function setTokenSaverSettingsDB(settings: Partial<TokenSaverSettings>): Promise<TokenSaverSettings> {
    const Current = await getTokenSaverSettingsDB();
    const Updated: TokenSaverSettings = {
        enabled: typeof settings.enabled === "boolean" ? settings.enabled : Current.enabled,
        compressToolOutput: {
            ...Current.compressToolOutput,
            ...(settings.compressToolOutput ?? {})
        },
        lazySeniorDev: {
            ...Current.lazySeniorDev,
            ...(settings.lazySeniorDev ?? {})
        },
        compressLlmOutput: {
            ...Current.compressLlmOutput,
            ...(settings.compressLlmOutput ?? {})
        }
    };
    await setSettingDB(SETTINGS_KEY, JSON.stringify(Updated));
    return Updated;
}