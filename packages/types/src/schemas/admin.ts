import { z } from "zod";

/**
 * POST /v1/admin/bootstrap
 *
 * First-come-wins account claim when no admin exists yet. The email and
 * password are validated in the route handler itself; the schema mirrors that
 * shape so the dashboard form can be driven client-side.
 */
export const AdminBootstrapSchema = z.object({
    email: z.string({ required_error: "Email is required" }).email("Invalid email"),
    password: z.string({ required_error: "Password is required" }).min(8, "Password must be at least 8 characters"),
    name: z.string().optional()
});

export type AdminBootstrapZod = z.infer<typeof AdminBootstrapSchema>;

export const TunnelConfigSchema = z.object({
    token: z.string().optional(),
    domain: z.string().optional()
});

export type TunnelConfigZod = z.infer<typeof TunnelConfigSchema>;
