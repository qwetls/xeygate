import { db, isPostgres } from "./db.js";
import { num, str } from "./row-utils.js";

export interface OAuthSession {
    state: string;
    codeVerifier?: string;
    clientId?: string;
    redirectUri?: string;
    createdAt?: number;
}

interface OAuthSessionRow {
    state: string;
    code_verifier: string;
    client_id: string;
    redirect_uri: string;
    created_at: number;
}

export async function saveOAuthSessionDB(session: OAuthSession): Promise<OAuthSession> {
    const UpsertSql = isPostgres()
        ? `INSERT INTO oauth_sessions (state, code_verifier, client_id, redirect_uri, created_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(state) DO UPDATE SET
               code_verifier = EXCLUDED.code_verifier,
               client_id = EXCLUDED.client_id,
               redirect_uri = EXCLUDED.redirect_uri,
               created_at = EXCLUDED.created_at`
        : `INSERT INTO oauth_sessions (state, code_verifier, client_id, redirect_uri, created_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(state) DO UPDATE SET
               code_verifier = excluded.code_verifier,
               client_id = excluded.client_id,
               redirect_uri = excluded.redirect_uri,
               created_at = excluded.created_at`;

    await db.prepare(UpsertSql).run(
        session.state,
        session.codeVerifier ?? "",
        session.clientId ?? "",
        session.redirectUri ?? "",
        session.createdAt ?? Date.now()
    );

    return session;
}

export async function getOAuthSessionDB(state: string): Promise<OAuthSession | null> {
    const Row = (await db
        .prepare("SELECT * FROM oauth_sessions WHERE state = ?")
        .get(state)) as unknown as OAuthSessionRow | undefined;

    if (!Row) return null;

    return {
        state: str(Row.state),
        codeVerifier: str(Row.code_verifier),
        clientId: str(Row.client_id),
        redirectUri: str(Row.redirect_uri),
        createdAt: num(Row.created_at)
    };
}

export async function deleteOAuthSessionDB(state: string): Promise<boolean> {
    const Result = await db.prepare("DELETE FROM oauth_sessions WHERE state = ?").run(state);
    return num(Result.changes) > 0;
}

export async function cleanupExpiredOAuthSessionsDB(maxAgeMs: number): Promise<void> {
    const Cutoff = Date.now() - maxAgeMs;
    await db.prepare("DELETE FROM oauth_sessions WHERE created_at < ?").run(Cutoff);
}