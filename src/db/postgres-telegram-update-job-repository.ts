import type { Sql } from "postgres";
import type { SealedSecret } from "../crypto/token-vault.js";
import type { TelegramUpdate } from "../telegram/telegram-webhook.js";
import type {
  TelegramUpdateJob,
  TelegramUpdateJobRepository,
} from "../telegram/telegram-update-worker.js";

interface ClaimedUpdateRow {
  integration_id: string;
  update_id: number | string;
  lease_id: string;
  attempts: number;
  payload: TelegramUpdate;
  project_id: string;
  encrypted_token: SealedSecret;
  mini_app_url: string;
  menu_button_text: string;
}

export class PostgresTelegramUpdateJobRepository implements TelegramUpdateJobRepository {
  public constructor(private readonly sql: Sql) {}

  public async claimNext(options: { leaseSeconds: number; maxAttempts: number }): Promise<TelegramUpdateJob | null> {
    const rows = await this.sql<ClaimedUpdateRow[]>`
      WITH expired_final_leases AS (
        -- A worker can die after claiming its final attempt. Retire that row
        -- once its lease expires so it cannot remain pending forever.
        UPDATE telegram_updates
        SET processing_started_at = NULL,
            lease_id = NULL,
            dead_lettered_at = now(),
            last_error = COALESCE(last_error, 'WorkerLeaseExpired')
        WHERE processed_at IS NULL
          AND dead_lettered_at IS NULL
          AND attempts >= ${options.maxAttempts}
          AND (
            processing_started_at IS NULL
            OR processing_started_at < now() - (${options.leaseSeconds} * interval '1 second')
          )
        RETURNING integration_id, update_id
      ), candidate AS (
        SELECT
          u.integration_id,
          u.update_id,
          b.project_id,
          b.encrypted_token,
          b.mini_app_url,
          b.menu_button_text
        FROM telegram_updates u
        JOIN bot_integrations b ON b.id = u.integration_id
        WHERE u.processed_at IS NULL
          AND u.dead_lettered_at IS NULL
          AND u.next_attempt_at <= now()
          AND u.attempts < ${options.maxAttempts}
          AND (
            u.processing_started_at IS NULL
            OR u.processing_started_at < now() - (${options.leaseSeconds} * interval '1 second')
          )
          AND b.status = 'active'
        ORDER BY u.next_attempt_at, u.received_at, u.update_id
        FOR UPDATE OF u SKIP LOCKED
        LIMIT 1
      )
      UPDATE telegram_updates u
      SET processing_started_at = now(),
          lease_id = gen_random_uuid(),
          attempts = u.attempts + 1,
          last_error = NULL
      FROM candidate c
      WHERE u.integration_id = c.integration_id
        AND u.update_id = c.update_id
      RETURNING
        u.integration_id,
        u.update_id,
        u.lease_id,
        u.attempts,
        u.payload,
        c.project_id,
        c.encrypted_token,
        c.mini_app_url,
        c.menu_button_text
    `;
    const row = rows[0];
    return row === undefined
      ? null
      : {
          integrationId: row.integration_id,
          updateId: Number(row.update_id),
          leaseId: row.lease_id,
          attempts: row.attempts,
          projectId: row.project_id,
          encryptedToken: row.encrypted_token,
          miniAppUrl: row.mini_app_url,
          menuButtonText: row.menu_button_text,
          payload: row.payload,
        };
  }

  public async markProcessed(job: Pick<TelegramUpdateJob, "integrationId" | "updateId" | "leaseId">): Promise<boolean> {
    const rows = await this.sql<{ update_id: number }[]>`
      UPDATE telegram_updates
      SET processed_at = now(),
          processing_started_at = NULL,
          lease_id = NULL,
          last_error = NULL
      WHERE integration_id = ${job.integrationId}
        AND update_id = ${job.updateId}
        AND lease_id = ${job.leaseId}
        AND processed_at IS NULL
      RETURNING update_id
    `;
    return rows[0] !== undefined;
  }

  public async markFailed(input: {
    integrationId: string;
    updateId: number;
    leaseId: string;
    reason: string;
    retryAt: Date;
    deadLetter: boolean;
  }): Promise<boolean> {
    const rows = await this.sql<{ update_id: number }[]>`
      UPDATE telegram_updates
      SET processing_started_at = NULL,
          lease_id = NULL,
          last_error = ${input.reason},
          next_attempt_at = ${input.retryAt},
          dead_lettered_at = CASE WHEN ${input.deadLetter} THEN now() ELSE NULL END
      WHERE integration_id = ${input.integrationId}
        AND update_id = ${input.updateId}
        AND lease_id = ${input.leaseId}
        AND processed_at IS NULL
      RETURNING update_id
    `;
    return rows[0] !== undefined;
  }
}
