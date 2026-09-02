import type { Sql } from "postgres";
import type { AuthRepository, AuthUser, SessionContext } from "../application/auth-service.js";
import { ConflictError } from "../domain/errors.js";

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string | null;
}

interface PostgresError { code?: string; constraint_name?: string }

export class PostgresAuthRepository implements AuthRepository {
  public constructor(private readonly sql: Sql) {}

  public async createUser(input: { email: string; displayName: string; passwordHash: string }): Promise<AuthUser> {
    try {
      const rows = await this.sql<UserRow[]>`
        INSERT INTO users (email, display_name, password_hash)
        VALUES (${input.email}, ${input.displayName}, ${input.passwordHash})
        RETURNING id, email::text, display_name, password_hash
      `;
      const row = rows[0];
      if (row === undefined) throw new Error("User insert returned no row");
      return mapUser(row);
    } catch (error) {
      const pg = error as PostgresError;
      if (pg.code === "23505") throw new ConflictError("An account with this email already exists");
      throw error;
    }
  }

  public async findUserByEmail(email: string): Promise<AuthUser | null> {
    const rows = await this.sql<UserRow[]>`
      SELECT id, email::text, display_name, password_hash FROM users WHERE email = ${email} LIMIT 1
    `;
    return rows[0] === undefined ? null : mapUser(rows[0]);
  }

  public async createSession(input: {
    id: string; familyId: string; userId: string; refreshTokenHash: string; expiresAt: Date; context: SessionContext;
  }): Promise<void> {
    await this.sql`
      INSERT INTO sessions (id, family_id, user_id, refresh_token_hash, expires_at, user_agent, ip_address)
      VALUES (${input.id}, ${input.familyId}, ${input.userId}, ${input.refreshTokenHash}, ${input.expiresAt},
              ${input.context.userAgent ?? null}, ${input.context.ipAddress ?? null}::inet)
    `;
  }

  public async rotateSession(input: {
    oldTokenHash: string; newSessionId: string; newTokenHash: string; expiresAt: Date; context: SessionContext;
  }): Promise<{ kind: "rotated"; userId: string; sessionId: string } | { kind: "invalid" } | { kind: "reused" }> {
    return await this.sql.begin(async (transaction) => {
      const rows = await transaction<{ id: string; family_id: string; user_id: string; expires_at: Date; revoked_at: Date | null; replaced_by_id: string | null }[]>`
        SELECT id, family_id, user_id, expires_at, revoked_at, replaced_by_id
        FROM sessions WHERE refresh_token_hash = ${input.oldTokenHash}
        FOR UPDATE
      `;
      const current = rows[0];
      if (current === undefined) return { kind: "invalid" } as const;
      if (current.revoked_at !== null || current.replaced_by_id !== null) {
        await transaction`
          UPDATE sessions SET revoked_at = COALESCE(revoked_at, now()), revoked_reason = COALESCE(revoked_reason, 'refresh_reuse')
          WHERE family_id = ${current.family_id}
        `;
        return { kind: "reused" } as const;
      }
      if (new Date(current.expires_at).getTime() <= Date.now()) return { kind: "invalid" } as const;

      await transaction`
        INSERT INTO sessions (id, family_id, user_id, refresh_token_hash, expires_at, user_agent, ip_address)
        VALUES (${input.newSessionId}, ${current.family_id}, ${current.user_id}, ${input.newTokenHash}, ${input.expiresAt},
                ${input.context.userAgent ?? null}, ${input.context.ipAddress ?? null}::inet)
      `;
      await transaction`
        UPDATE sessions
        SET revoked_at = now(), revoked_reason = 'rotated', replaced_by_id = ${input.newSessionId}, last_used_at = now()
        WHERE id = ${current.id}
      `;
      return { kind: "rotated", userId: current.user_id, sessionId: input.newSessionId } as const;
    });
  }

  public async revokeSession(sessionId: string, userId: string, reason: string): Promise<void> {
    await this.sql`
      UPDATE sessions SET revoked_at = COALESCE(revoked_at, now()), revoked_reason = COALESCE(revoked_reason, ${reason})
      WHERE id = ${sessionId} AND user_id = ${userId}
    `;
  }
}

function mapUser(row: UserRow): AuthUser {
  return { id: row.id, email: row.email, displayName: row.display_name, passwordHash: row.password_hash };
}
