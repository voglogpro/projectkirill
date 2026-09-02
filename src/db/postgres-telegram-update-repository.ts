import type { Sql } from "postgres";
import type {
  TelegramUpdate,
  TelegramUpdateRepository,
  TelegramWebhookIntegration,
} from "../telegram/telegram-webhook.js";

type PostgresJsonValue = Parameters<Sql["json"]>[0];

export class PostgresTelegramUpdateRepository implements TelegramUpdateRepository {
  public constructor(private readonly sql: Sql) {}

  public async findActiveIntegration(publicId: string): Promise<TelegramWebhookIntegration | null> {
    const rows = await this.sql<
      { id: string; project_id: string; webhook_secret_hash: Uint8Array }[]
    >`
      SELECT id, project_id, webhook_secret_hash
      FROM bot_integrations
      WHERE public_id = ${publicId}
        AND status = 'active'
        AND webhook_secret_hash IS NOT NULL
      LIMIT 1
    `;
    const row = rows[0];
    return row === undefined
      ? null
      : { id: row.id, projectId: row.project_id, webhookSecretHash: row.webhook_secret_hash };
  }

  public async storeUpdate(input: {
    integrationId: string;
    updateId: number;
    payload: TelegramUpdate;
  }): Promise<"stored" | "duplicate"> {
    const rows = await this.sql<{ update_id: string }[]>`
      INSERT INTO telegram_updates (integration_id, update_id, payload)
      VALUES (${input.integrationId}, ${input.updateId}, ${this.sql.json(input.payload as PostgresJsonValue)})
      ON CONFLICT (integration_id, update_id) DO NOTHING
      RETURNING update_id
    `;
    return rows[0] === undefined ? "duplicate" : "stored";
  }
}
