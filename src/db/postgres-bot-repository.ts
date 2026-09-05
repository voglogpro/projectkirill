import type { Sql } from "postgres";
import type { BotConnectionRepository, OwnedProject } from "../application/connect-bot.js";
import type { SealedSecret } from "../crypto/token-vault.js";
import { ConflictError, NotFoundError } from "../domain/errors.js";
import { hasMiniApp, type ProductKit } from "../domain/product-kit.js";

interface PostgresError {
  code?: string;
  constraint_name?: string;
}

export class PostgresBotConnectionRepository implements BotConnectionRepository {
  public constructor(private readonly sql: Sql) {}

  public async findOwnedProject(projectId: string, ownerUserId: string): Promise<OwnedProject | null> {
    const rows = await this.sql<{ id: string; public_id: string; kit: ProductKit }[]>`
      SELECT id, public_id, kit
      FROM projects
      WHERE id = ${projectId} AND owner_user_id = ${ownerUserId}
      LIMIT 1
    `;
    const row = rows[0];
    return row === undefined ? null : { id: row.id, publicId: row.public_id, kit: row.kit };
  }

  public async reserve(input: {
    projectId: string;
    ownerUserId: string;
    bot: { id: string; firstName: string; username?: string };
    token: SealedSecret;
    webhookSecretHash?: Uint8Array;
    menuButtonText: string;
    miniAppUrl: string;
  }): Promise<{ integrationId: string; publicIntegrationId?: string }> {
    try {
      const rows = await this.sql<{ id: string; public_id: string }[]>`
        INSERT INTO bot_integrations (
          project_id, telegram_bot_id, bot_username, bot_first_name,
          encrypted_token, webhook_secret_hash, menu_button_text, mini_app_url, status
        )
        SELECT
          p.id, ${input.bot.id}::bigint, ${input.bot.username ?? null}, ${input.bot.firstName},
          ${this.sql.json({
            version: input.token.version,
            algorithm: input.token.algorithm,
            ciphertext: input.token.ciphertext,
            iv: input.token.iv,
            authTag: input.token.authTag,
            wrappedKey: {
              keyId: input.token.wrappedKey.keyId,
              ciphertext: input.token.wrappedKey.ciphertext,
              iv: input.token.wrappedKey.iv,
              authTag: input.token.wrappedKey.authTag,
            },
          })}, ${input.webhookSecretHash === undefined ? null : Buffer.from(input.webhookSecretHash)}, ${input.menuButtonText}, ${input.miniAppUrl}, 'configuring'
        FROM projects p
        WHERE p.id = ${input.projectId} AND p.owner_user_id = ${input.ownerUserId}
        ON CONFLICT (project_id) DO UPDATE SET
          telegram_bot_id = EXCLUDED.telegram_bot_id,
          bot_username = EXCLUDED.bot_username,
          bot_first_name = EXCLUDED.bot_first_name,
          encrypted_token = EXCLUDED.encrypted_token,
          webhook_secret_hash = EXCLUDED.webhook_secret_hash,
          menu_button_text = EXCLUDED.menu_button_text,
          mini_app_url = EXCLUDED.mini_app_url,
          status = 'configuring',
          last_error = NULL,
          updated_at = now()
        RETURNING id, public_id
      `;
      const row = rows[0];
      if (row === undefined) throw new NotFoundError("Project not found");
      return { integrationId: row.id, publicIntegrationId: row.public_id };
    } catch (error) {
      const postgresError = error as PostgresError;
      if (postgresError.code === "23505" && postgresError.constraint_name === "bot_integrations_telegram_bot_id_key") {
        throw new ConflictError("This Telegram bot is already connected to another project");
      }
      throw error;
    }
  }

  public async markActive(integrationId: string): Promise<void> {
    await this.sql`
      UPDATE bot_integrations
      SET status = 'active', configured_at = now(),
          webhook_configured_at = CASE WHEN webhook_secret_hash IS NULL THEN NULL ELSE now() END,
          last_error = NULL, updated_at = now()
      WHERE id = ${integrationId}
    `;
  }

  public async markError(integrationId: string, reason: string): Promise<void> {
    await this.sql`
      UPDATE bot_integrations
      SET status = 'error', last_error = ${reason}, updated_at = now()
      WHERE id = ${integrationId}
    `;
  }

  public async getOwned(projectId: string, ownerUserId: string) {
    const rows = await this.sql<Array<{ bot_username: string | null; bot_first_name: string; mini_app_url: string; kit: ProductKit; status: "configuring" | "active" | "error" | "revoked" }>>`
      SELECT bi.bot_username, bi.bot_first_name, bi.mini_app_url, bi.status, p.kit
      FROM bot_integrations bi JOIN projects p ON p.id = bi.project_id
      WHERE bi.project_id = ${projectId} AND p.owner_user_id = ${ownerUserId}
      LIMIT 1
    `;
    const row = rows[0];
    return row === undefined ? null : { ...(row.bot_username === null ? {} : { botUsername: row.bot_username }), botFirstName: row.bot_first_name, miniAppUrl: hasMiniApp(row.kit) ? row.mini_app_url : "", status: row.status };
  }
}
