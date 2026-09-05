import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { userAuthStore, type UserAuthStore } from "@srouter/db";

export const USER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const USER_SESSION_COOKIE = "xeygate_user_session";

const PASSWORD_HASH_ALGORITHM = "scrypt";
const PASSWORD_HASH_LENGTH = 64;
const PASSWORD_SALT_LENGTH = 16;
const PASSWORD_SCRYPT_N = 16_384;
const PASSWORD_SCRYPT_R = 8;
const PASSWORD_SCRYPT_P = 1;
const PASSWORD_SCRYPT_MAXMEM = 32 * 1024 * 1024;

export function validateEmail(email: unknown): string | null {
    if (typeof email !== "string" || email.length === 0) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Invalid email format";
    return null;
}

export function validateUserPassword(value: unknown): string | null {
    if (typeof value !== "string" || value.length === 0) return "Password is required";
    if (value.length < 8) return "Password must be at least 8 characters";
    if (value.length > 128) return "Password must be at most 128 characters";
    return null;
}

export function hashUserPassword(password: string): string {
    const salt = randomBytes(PASSWORD_SALT_LENGTH);
    const derivedKey = scryptSync(password, salt, PASSWORD_HASH_LENGTH, {
        N: PASSWORD_SCRYPT_N,
        r: PASSWORD_SCRYPT_R,
        p: PASSWORD_SCRYPT_P,
        maxmem: PASSWORD_SCRYPT_MAXMEM
    });
    return [
        PASSWORD_HASH_ALGORITHM,
        PASSWORD_SCRYPT_N,
        PASSWORD_SCRYPT_R,
        PASSWORD_SCRYPT_P,
        salt.toString("base64url"),
        derivedKey.toString("base64url")
    ].join("$");
}

export function verifyUserPassword(password: string, storedHash: string): boolean {
    try {
        const parts = storedHash.split("$");
        if (parts.length !== 6 || parts[0] !== PASSWORD_HASH_ALGORITHM) return false;
        const [, nValue, rValue, pValue, saltValue, hashValue] = parts;
        const n = Number(nValue);
        const r = Number(rValue);
        const p = Number(pValue);
        if (![n, r, p].every((v) => Number.isSafeInteger(v) && v > 0)) return false;
        const salt = Buffer.from(saltValue, "base64url");
        const expected = Buffer.from(hashValue, "base64url");
        if (salt.length === 0 || expected.length === 0) return false;
        const actual = scryptSync(password, salt, expected.length, {
            N: n, r, p, maxmem: PASSWORD_SCRYPT_MAXMEM
        });
        return actual.length === expected.length && timingSafeEqual(actual, expected);
    } catch {
        return false;
    }
}

export function hashSessionToken(token: string): string {
    return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function createUserSession(
    store: Pick<UserAuthStore, "createSession"> = userAuthStore,
    userId: string,
    now = Date.now()
): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    await store.createSession(hashSessionToken(token), userId, now);
    return token;
}

export async function verifyUserSession(
    store: Pick<UserAuthStore, "getSession"> = userAuthStore,
    token: string | undefined,
    now = Date.now()
): Promise<string | null> {
    if (!token) return null;
    const session = await store.getSession(hashSessionToken(token), now);
    return session?.userId ?? null;
}

export async function revokeUserSession(
    store: Pick<UserAuthStore, "deleteSession"> = userAuthStore,
    token: string | undefined
): Promise<boolean> {
    if (!token) return false;
    return await store.deleteSession(hashSessionToken(token));
}
