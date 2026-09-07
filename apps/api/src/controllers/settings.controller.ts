import type { Context } from "hono";
import {
    getAllSettingsDB,
    getRequireApiKeyDB,
    getRequireRegistrationApprovalDB,
    setRequireApiKeyDB,
    setRequireRegistrationApprovalDB,
    setSettingDB
} from "@srouter/db";
import { UpdateSettingsSchema } from "@srouter/types";
import { Err, Ok } from "@/utils/response.js";

export class SettingsController {
    public static async GetSettings(c: Context): Promise<Response> {
        return Ok(c, {
            require_api_key: await getRequireApiKeyDB(),
            requireApiKey: await getRequireApiKeyDB(),
            require_registration_approval: await getRequireRegistrationApprovalDB(),
            settings: await getAllSettingsDB()
        });
    }

    public static async UpdateSettings(c: Context): Promise<Response> {
        const RawBody = await c.req.json().catch(() => null);
        const Parsed = UpdateSettingsSchema.safeParse(RawBody);
        if (!Parsed.success) {
            return Err(c, Parsed.error.issues[0]?.message || "Invalid settings payload", 400);
        }

        try {
            if (typeof Parsed.data.require_api_key === "boolean") {
                await setRequireApiKeyDB(Parsed.data.require_api_key);
            }
            if (typeof Parsed.data.require_registration_approval === "boolean") {
                await setRequireRegistrationApprovalDB(Parsed.data.require_registration_approval);
            }
            if (Parsed.data.settings) {
                for (const [key, value] of Object.entries(Parsed.data.settings)) {
                    if (typeof value === "string") {
                        await setSettingDB(key, value);
                    }
                }
            }

            return Ok(c, {
                message: "Settings updated successfully",
                require_api_key: await getRequireApiKeyDB(),
                requireApiKey: await getRequireApiKeyDB(),
                require_registration_approval: await getRequireRegistrationApprovalDB(),
                settings: await getAllSettingsDB()
            });
        } catch (error) {
            return Err(
                c,
                error instanceof Error ? error.message : "Failed to update settings",
                500
            );
        }
    }
}