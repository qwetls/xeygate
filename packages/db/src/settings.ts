import { db } from "./db.js";
import { str } from "./row-utils.js";

interface SettingRow {
    key: string;
    value: string;
}

export async function getSettingDB(key: string, defaultValue = ""): Promise<string> {
    const Row = (await db
        .prepare("SELECT value FROM system_settings WHERE key = ?")
        .get(key)) as unknown as SettingRow | undefined;
    return Row ? Row.value : defaultValue;
}

export async function setSettingDB(key: string, value: string): Promise<void> {
    await db.prepare(
        `INSERT INTO system_settings (key, value)
         VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(key, value);
}

export async function getAllSettingsDB(): Promise<Record<string, string>> {
    const Rows = (await db.prepare("SELECT key, value FROM system_settings").all()) as unknown as SettingRow[];
    const Result: Record<string, string> = {};
    for (const r of Rows) {
        Result[r.key] = r.value;
    }
    return Result;
}

export async function getRequireApiKeyDB(): Promise<boolean> {
    const Val = await getSettingDB("require_api_key", "false");
    return Val === "true" || Val === "1";
}

export async function setRequireApiKeyDB(required: boolean): Promise<void> {
    await setSettingDB("require_api_key", required ? "true" : "false");
}

export async function getRoundRobinDB(providerId: string): Promise<boolean> {
    return (await getSettingDB(`round_robin_${providerId}`, "false")) === "true";
}

export async function setRoundRobinDB(providerId: string, enabled: boolean): Promise<void> {
    await setSettingDB(`round_robin_${providerId}`, enabled ? "true" : "false");
}