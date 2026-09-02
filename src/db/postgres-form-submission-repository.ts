import type { Sql } from "postgres";
import type { FormConnection, FormSubmissionRepository } from "../application/form-submission-service.js";

export class PostgresFormSubmissionRepository implements FormSubmissionRepository {
  public constructor(private readonly sql: Sql) {}
  public async getActiveConnection(publicId: string): Promise<FormConnection | null> {
    const rows = await this.sql<{ project_id: string; encrypted_token: unknown }[]>`
      SELECT p.id AS project_id, bi.encrypted_token
      FROM projects p JOIN bot_integrations bi ON bi.project_id = p.id
      JOIN billing_subscriptions bs ON bs.user_id = p.owner_user_id AND bs.status = 'active' AND bs.current_period_end > now()
      WHERE p.public_id = ${publicId} AND p.status = 'active' AND bi.status = 'active'
      LIMIT 1
    `;
    const row = rows[0]; return row === undefined ? null : { projectId: row.project_id, encryptedToken: row.encrypted_token };
  }
  public async store(input: { requestId: string; projectId: string; pageId: string; formKey: string; telegramUserId?: string; values: Record<string, string | boolean> }): Promise<"stored" | "duplicate"> {
    return this.sql.begin(async (transaction) => {
      const rows = await transaction<{ id: string }[]>`
        INSERT INTO form_submissions (request_id, project_id, page_id, form_key, telegram_user_id, payload)
        VALUES (${input.requestId}, ${input.projectId}, ${input.pageId}, ${input.formKey}, ${input.telegramUserId ?? null}::bigint, ${transaction.json(input.values)})
        ON CONFLICT (project_id, request_id) DO NOTHING RETURNING id
      `;
      const row = rows[0]; if (row === undefined) return "duplicate" as const;
      await transaction`
        INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload)
        VALUES ('form_submission', ${row.id}, 'form.submitted', ${transaction.json({ submissionId: row.id, projectId: input.projectId })})
      `;
      return "stored" as const;
    });
  }
  public async listOwned(ownerUserId: string, projectId: string) {
    const rows = await this.sql<Array<{ id: string; form_key: string; page_title: string; telegram_user_id: string | null; payload: Record<string, string | boolean>; created_at: Date }>>`
      SELECT fs.id, fs.form_key, p.title AS page_title, fs.telegram_user_id::text, fs.payload, fs.created_at
      FROM form_submissions fs
      JOIN pages p ON p.id = fs.page_id
      JOIN projects project ON project.id = fs.project_id
      WHERE fs.project_id = ${projectId} AND project.owner_user_id = ${ownerUserId}
      ORDER BY fs.created_at DESC
      LIMIT 500
    `;
    return rows.map((row) => ({ id: row.id, formKey: row.form_key, pageTitle: row.page_title, ...(row.telegram_user_id === null ? {} : { telegramUserId: row.telegram_user_id }), values: row.payload, createdAt: row.created_at.toISOString() }));
  }
}
