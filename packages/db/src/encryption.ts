import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Credentials are encrypted at rest with AES-256-GCM. The data key is derived
// (SHA-256) from XEYGATE_ENCRYPTION_KEY, falling back to JWT_SECRET so existing
// deployments provision a key without extra setup. Encrypted values are tagged
// with a version prefix so legacy plaintext rows keep working and can be
// transparently upgraded on next write.
const PREFIX = "enc:v1:";

let _warnedNoKey = false;

function DerivedKey(): Buffer | null {
    const secret = (process.env.XEYGATE_ENCRYPTION_KEY || process.env.JWT_SECRET || "").trim();
    if (!secret) return null;
    return createHash("sha256").update(secret).digest();
}

function WarnMissingKeyOnce(): void {
    if (_warnedNoKey) return;
    _warnedNoKey = true;
    // eslint-disable-next-line no-console
    console.warn(
        "[xeygate] XEYGATE_ENCRYPTION_KEY/JWT_SECRET not set — provider credentials stored in PLAINTEXT. Set a secret before production."
    );
}

export function EncryptSecret(Value: string | undefined | null): string | undefined | null {
    if (Value == null || Value === "") return Value;
    if (Value.startsWith(PREFIX)) return Value;
    const Key = DerivedKey();
    if (!Key) {
        WarnMissingKeyOnce();
        return Value;
    }
    const Iv = randomBytes(12);
    const Cipher = createCipheriv("aes-256-gcm", Key, Iv);
    const Encrypted = Buffer.concat([Cipher.update(Value, "utf8"), Cipher.final()]);
    const Tag = Cipher.getAuthTag();
    return `${PREFIX}${Iv.toString("base64")}:${Tag.toString("base64")}:${Encrypted.toString("base64")}`;
}

export function DecryptSecret(Value: string | undefined | null): string | undefined | null {
    if (Value == null || Value === "") return Value;
    if (!Value.startsWith(PREFIX)) return Value;
    const Key = DerivedKey();
    if (!Key) return Value;
    try {
        const [IvB64, TagB64, DataB64] = Value.slice(PREFIX.length).split(":");
        const Iv = Buffer.from(IvB64, "base64");
        const Tag = Buffer.from(TagB64, "base64");
        const Data = Buffer.from(DataB64, "base64");
        const Decipher = createDecipheriv("aes-256-gcm", Key, Iv);
        Decipher.setAuthTag(Tag);
        return Buffer.concat([Decipher.update(Data), Decipher.final()]).toString("utf8");
    } catch {
        // Auth tag mismatch (key rotated?) — surface raw rather than crash routing.
        return Value;
    }
}

export function IsEncrypted(Value: string | undefined | null): boolean {
    return typeof Value === "string" && Value.startsWith(PREFIX);
}
