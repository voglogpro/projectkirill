import { createHash } from "node:crypto";
import type { Sql } from "postgres";
import { botFlowDocumentSchema, type BotFlowDocument } from "../domain/bot-flow.js";
import type { DialogState } from "../domain/bot-flow-runtime.js";
import { ConflictError, NotFoundError } from "../domain/errors.js";
import type { BotFlowSource, DialogStateStore } from "../telegram/telegram-update-worker.js";

export interface BotFlowDraft {
  document: BotFlowDocument;
  revision: number;
  publishedVersion?: number;
  updatedAt: Date;
}

export interface PublishedFlow {
  versionId: string;
  version: number;
}

interface FlowRow { document: unknown; revision: number; published_version_id: string | null; updated_at: Date }

/**
 * Scenario storage: one editable draft per project plus immutable published
 * versions. The worker reads only published versions, so editing never changes
 * what live subscribers are talking to.
 */
export class PostgresBotFlowRepository implements BotFlowSource, DialogStateStore {
  public constructor(private readonly sql: Sql) {}

  /** Creates the draft on first read so the editor always has something to open. */
  public async getDraft(ownerUserId: string, projectId: string, seed: BotFlowDocument): Promise<BotFlowDraft> {
    await this.assertOwned(ownerUserId, projectId);
    const rows = await this.sql<FlowRow[]>`
      SELECT document, revision, published_version_id, updated_at FROM bot_flows WHERE project_id = ${projectId}
    `;
    const row = rows[0];
    if (row !== undefined) return this.toDraft(projectId, row);

    const created = await this.sql<FlowRow[]>`
      INSERT INTO bot_flows (project_id, document) VALUES (${projectId}, ${this.sql.json(seed)})
      ON CONFLICT (project_id) DO UPDATE SET updated_at = now()
      RETURNING document, revision, published_version_id, updated_at
    `;
    return this.toDraft(projectId, required(created[0], "Bot flow insert returned no row"));
  }

  public async saveDraft(
    ownerUserId: string,
    projectId: string,
    document: BotFlowDocument,
    expectedRevision: number,
  ): Promise<BotFlowDraft> {
    await this.assertOwned(ownerUserId, projectId);
    const rows = await this.sql<FlowRow[]>`
      UPDATE bot_flows
      SET document = ${this.sql.json(document)}, revision = revision + 1, updated_at = now()
      WHERE project_id = ${projectId} AND revision = ${expectedRevision}
      RETURNING document, revision, published_version_id, updated_at
    `;
    const row = rows[0];
    // A missing row means either no draft yet or a stale revision; both are the
    // same message to the editor, which reloads and retries.
    if (row === undefined) throw new ConflictError("Сценарий изменён в другой вкладке — обновите страницу");
    return this.toDraft(projectId, row);
  }

  public async publish(ownerUserId: string, projectId: string): Promise<PublishedFlow> {
    await this.assertOwned(ownerUserId, projectId);
    return this.sql.begin(async (transaction) => {
      const drafts = await transaction<{ document: unknown }[]>`
        SELECT document FROM bot_flows WHERE project_id = ${projectId} FOR UPDATE
      `;
      const draft = drafts[0];
      if (draft === undefined) throw new NotFoundError("Сценарий не найден");
      // Publishing revalidates: a draft saved by an older build must not reach
      // the worker in a shape the interpreter cannot walk.
      const document = botFlowDocumentSchema.parse(draft.document);

      const counts = await transaction<{ next: string }[]>`
        SELECT (coalesce(max(version), 0) + 1)::text AS next FROM bot_flow_versions WHERE project_id = ${projectId}
      `;
      const version = Number(required(counts[0], "Version count returned no row").next);
      const hash = createHash("sha256").update(JSON.stringify(document), "utf8").digest("hex");
      const versions = await transaction<{ id: string }[]>`
        INSERT INTO bot_flow_versions (project_id, version, document, content_hash)
        VALUES (${projectId}, ${version}, ${transaction.json(document)}, ${hash})
        RETURNING id
      `;
      const versionId = required(versions[0], "Version insert returned no row").id;
      await transaction`UPDATE bot_flows SET published_version_id = ${versionId}, updated_at = now() WHERE project_id = ${projectId}`;
      return { versionId, version };
    });
  }

  /** Worker port: the frozen scenario a live bot answers with. */
  public async loadPublishedFlow(projectId: string): Promise<BotFlowDocument | null> {
    const rows = await this.sql<{ document: unknown }[]>`
      SELECT versions.document
      FROM bot_flows flows
      JOIN bot_flow_versions versions ON versions.id = flows.published_version_id
      WHERE flows.project_id = ${projectId}
    `;
    const row = rows[0];
    if (row === undefined) return null;
    const parsed = botFlowDocumentSchema.safeParse(row.document);
    // A version that no longer validates is a deployment problem, not a reason
    // to break every conversation: fall back to the pre-scenario behaviour.
    return parsed.success ? parsed.data : null;
  }

  public async load(integrationId: string, chatId: string): Promise<DialogState | null> {
    const rows = await this.sql<{ state: DialogState }[]>`
      SELECT state FROM bot_dialog_states WHERE integration_id = ${integrationId} AND chat_id = ${chatId}
    `;
    return rows[0]?.state ?? null;
  }

  public async save(integrationId: string, chatId: string, state: DialogState): Promise<void> {
    await this.sql`
      INSERT INTO bot_dialog_states (integration_id, chat_id, state)
      VALUES (${integrationId}, ${chatId}, ${this.sql.json({ ...state })})
      ON CONFLICT (integration_id, chat_id) DO UPDATE SET state = EXCLUDED.state, updated_at = now()
    `;
  }

  private async assertOwned(ownerUserId: string, projectId: string): Promise<void> {
    const rows = await this.sql<{ id: string }[]>`
      SELECT id FROM projects WHERE id = ${projectId} AND owner_user_id = ${ownerUserId}
    `;
    // Same answer for someone else's project and a missing one, so the API
    // never confirms that a project id exists.
    if (rows[0] === undefined) throw new NotFoundError("Проект не найден");
  }

  private async toDraft(projectId: string, row: FlowRow): Promise<BotFlowDraft> {
    const published = row.published_version_id === null ? undefined : await this.versionNumber(projectId, row.published_version_id);
    return {
      document: botFlowDocumentSchema.parse(row.document),
      revision: row.revision,
      ...(published === undefined ? {} : { publishedVersion: published }),
      updatedAt: row.updated_at,
    };
  }

  private async versionNumber(projectId: string, versionId: string): Promise<number | undefined> {
    const rows = await this.sql<{ version: number }[]>`
      SELECT version FROM bot_flow_versions WHERE project_id = ${projectId} AND id = ${versionId}
    `;
    return rows[0]?.version;
  }
}

function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}
