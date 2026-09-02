import { createHash } from "node:crypto";
import type { Sql } from "postgres";
import type { CoreRepository } from "../application/core-service.js";
import type { PageRecord, ProjectRecord, ProjectSnapshot, PublicAppManifest } from "../domain/core.js";
import { pageDocumentSchema, type PageDocument } from "../domain/page-document.js";
import { ConflictError } from "../domain/errors.js";

interface ProjectRow {
  id: string; public_id: string; name: string; slug: string; status: ProjectRecord["status"];
  entry_page_id: string | null; published_release_id: string | null; updated_at: Date;
}
interface PageRow {
  id: string; project_id: string; slug: string; title: string; draft_document: unknown; draft_revision: number; updated_at: Date;
}
interface PostgresError { code?: string }

export class PostgresCoreRepository implements CoreRepository {
  public constructor(private readonly sql: Sql) {}

  public async createProject(ownerUserId: string, input: { name: string; slug: string; entryDocument: PageDocument }): Promise<ProjectRecord> {
    try {
      return await this.sql.begin(async (transaction) => {
        const projects = await transaction<ProjectRow[]>`
          INSERT INTO projects (owner_user_id, name, slug)
          VALUES (${ownerUserId}, ${input.name}, ${input.slug})
          RETURNING id, public_id, name, slug, status, entry_page_id, published_release_id, updated_at
        `;
        const project = required(projects[0], "Project insert returned no row");
        const pages = await transaction<{ id: string }[]>`
          INSERT INTO pages (project_id, slug, title, draft_document)
          VALUES (${project.id}, 'home', ${input.entryDocument.metadata.title}, ${transaction.json(input.entryDocument)})
          RETURNING id
        `;
        const entryPageId = required(pages[0], "Entry page insert returned no row").id;
        const updated = await transaction<ProjectRow[]>`
          UPDATE projects SET entry_page_id = ${entryPageId} WHERE id = ${project.id}
          RETURNING id, public_id, name, slug, status, entry_page_id, published_release_id, updated_at
        `;
        return mapProject(required(updated[0], "Project update returned no row"));
      });
    } catch (error) {
      if ((error as PostgresError).code === "23505") throw new ConflictError("A project or page with this slug already exists");
      throw error;
    }
  }

  public async listProjects(ownerUserId: string): Promise<ProjectRecord[]> {
    const rows = await this.sql<ProjectRow[]>`
      SELECT id, public_id, name, slug, status, entry_page_id, published_release_id, updated_at
      FROM projects WHERE owner_user_id = ${ownerUserId} ORDER BY updated_at DESC
    `;
    return rows.map(mapProject);
  }

  public async getOwnedProject(ownerUserId: string, projectId: string): Promise<ProjectRecord | null> {
    const rows = await this.sql<ProjectRow[]>`
      SELECT id, public_id, name, slug, status, entry_page_id, published_release_id, updated_at
      FROM projects WHERE id = ${projectId} AND owner_user_id = ${ownerUserId} LIMIT 1
    `;
    return rows[0] === undefined ? null : mapProject(rows[0]);
  }

  public async updateProject(ownerUserId: string, projectId: string, name: string): Promise<ProjectRecord | null> {
    const rows = await this.sql<ProjectRow[]>`
      UPDATE projects SET name = ${name}
      WHERE id = ${projectId} AND owner_user_id = ${ownerUserId}
      RETURNING id, public_id, name, slug, status, entry_page_id, published_release_id, updated_at
    `;
    return rows[0] === undefined ? null : mapProject(rows[0]);
  }

  public async listPages(ownerUserId: string, projectId: string): Promise<PageRecord[] | null> {
    const owned = await this.getOwnedProject(ownerUserId, projectId);
    if (owned === null) return null;
    const rows = await this.sql<PageRow[]>`
      SELECT id, project_id, slug, title, draft_document, draft_revision, updated_at
      FROM pages WHERE project_id = ${projectId} ORDER BY created_at, id
    `;
    return rows.map(mapPage);
  }

  public async createPage(ownerUserId: string, projectId: string, input: { slug: string; title: string; document: PageDocument }): Promise<PageRecord | null> {
    try {
      const rows = await this.sql<PageRow[]>`
        INSERT INTO pages (project_id, slug, title, draft_document)
        SELECT p.id, ${input.slug}, ${input.title}, ${this.sql.json(input.document)}
        FROM projects p WHERE p.id = ${projectId} AND p.owner_user_id = ${ownerUserId}
        RETURNING id, project_id, slug, title, draft_document, draft_revision, updated_at
      `;
      return rows[0] === undefined ? null : mapPage(rows[0]);
    } catch (error) {
      if ((error as PostgresError).code === "23505") throw new ConflictError("A page with this slug already exists");
      throw error;
    }
  }

  public async updatePage(ownerUserId: string, projectId: string, pageId: string, input: { expectedRevision: number; title: string; document: PageDocument }): Promise<PageRecord | "revision_conflict" | null> {
    const rows = await this.sql<PageRow[]>`
      UPDATE pages pg SET title = ${input.title}, draft_document = ${this.sql.json(input.document)}, draft_revision = draft_revision + 1
      FROM projects p
      WHERE pg.id = ${pageId} AND pg.project_id = ${projectId} AND pg.project_id = p.id
        AND p.owner_user_id = ${ownerUserId} AND pg.draft_revision = ${input.expectedRevision}
      RETURNING pg.id, pg.project_id, pg.slug, pg.title, pg.draft_document, pg.draft_revision, pg.updated_at
    `;
    if (rows[0] !== undefined) return mapPage(rows[0]);
    const existing = await this.sql<{ revision: number }[]>`
      SELECT pg.draft_revision AS revision FROM pages pg JOIN projects p ON p.id = pg.project_id
      WHERE pg.id = ${pageId} AND pg.project_id = ${projectId} AND p.owner_user_id = ${ownerUserId}
    `;
    return existing[0] === undefined ? null : "revision_conflict";
  }

  public async deletePage(ownerUserId: string, projectId: string, pageId: string): Promise<"deleted" | "entry_page" | "not_found"> {
    return await this.sql.begin(async (transaction) => {
      const projects = await transaction<{ entry_page_id: string | null }[]>`
        SELECT entry_page_id FROM projects WHERE id = ${projectId} AND owner_user_id = ${ownerUserId} FOR UPDATE
      `;
      const project = projects[0];
      if (project === undefined) return "not_found" as const;
      if (project.entry_page_id === pageId) return "entry_page" as const;
      const rows = await transaction<{ id: string }[]>`DELETE FROM pages WHERE id = ${pageId} AND project_id = ${projectId} RETURNING id`;
      return rows[0] === undefined ? "not_found" as const : "deleted" as const;
    });
  }

  public async getOwnedSnapshot(ownerUserId: string, projectId: string): Promise<ProjectSnapshot | null> {
    const project = await this.getOwnedProject(ownerUserId, projectId);
    if (project === null) return null;
    const pages = await this.listPages(ownerUserId, projectId);
    return { project, pages: pages ?? [] };
  }

  public async publishSnapshot(ownerUserId: string, snapshot: ProjectSnapshot, contentHash: string): Promise<PublicAppManifest | "revision_conflict"> {
    return await this.sql.begin(async (transaction) => {
      const projectRows = await transaction<ProjectRow[]>`
        SELECT id, public_id, name, slug, status, entry_page_id, published_release_id, updated_at
        FROM projects WHERE id = ${snapshot.project.id} AND owner_user_id = ${ownerUserId} FOR UPDATE
      `;
      const project = projectRows[0];
      if (project === undefined || project.entry_page_id === null) return "revision_conflict" as const;
      const currentPages = await transaction<PageRow[]>`
        SELECT id, project_id, slug, title, draft_document, draft_revision, updated_at
        FROM pages WHERE project_id = ${project.id} ORDER BY created_at, id FOR UPDATE
      `;
      if (!sameRevisions(snapshot.pages, currentPages)) return "revision_conflict" as const;

      const releaseRows = await transaction<{ id: string; version: number; created_at: Date }[]>`
        INSERT INTO releases (project_id, version, content_hash, published_by)
        VALUES (${project.id}, COALESCE((SELECT max(version) + 1 FROM releases WHERE project_id = ${project.id}), 1), ${contentHash}, ${ownerUserId})
        RETURNING id, version, created_at
      `;
      const release = required(releaseRows[0], "Release insert returned no row");
      const publishedPages: PublicAppManifest["pages"] = [];

      for (const [position, pageRow] of currentPages.entries()) {
        const page = mapPage(pageRow);
        const pageHash = createHash("sha256").update(JSON.stringify(page.document), "utf8").digest("hex");
        const versions = await transaction<{ id: string }[]>`
          INSERT INTO page_versions (page_id, version, document, content_hash, published_by)
          VALUES (${page.id}, COALESCE((SELECT max(version) + 1 FROM page_versions WHERE page_id = ${page.id}), 1),
                  ${transaction.json(page.document)}, ${pageHash}, ${ownerUserId})
          RETURNING id
        `;
        const pageVersionId = required(versions[0], "Page version insert returned no row").id;
        await transaction`
          INSERT INTO release_pages (release_id, project_id, page_id, page_version_id, slug, title, position)
          VALUES (${release.id}, ${project.id}, ${page.id}, ${pageVersionId}, ${page.slug}, ${page.title}, ${position})
        `;
        await transaction`UPDATE pages SET published_version_id = ${pageVersionId} WHERE id = ${page.id}`;
        publishedPages.push({ id: page.id, slug: page.slug, title: page.title, document: page.document });
      }
      // `updated_at` is the publication boundary used by the dashboard to
      // distinguish the live release from drafts edited afterwards.
      await transaction`
        UPDATE projects
        SET published_release_id = ${release.id}, status = 'active', updated_at = now()
        WHERE id = ${project.id}
      `;
      return {
        project: { publicId: project.public_id, name: project.name, entryPageId: project.entry_page_id },
        release: { id: release.id, version: release.version, contentHash, publishedAt: release.created_at.toISOString() },
        pages: publishedPages,
      };
    });
  }

  public async createPreviewGrant(ownerUserId: string, projectId: string, tokenHash: string, expiresAt: Date): Promise<boolean> {
    const rows = await this.sql<{ id: string }[]>`
      INSERT INTO preview_grants (project_id, created_by, token_hash, expires_at)
      SELECT p.id, ${ownerUserId}, ${tokenHash}, ${expiresAt}
      FROM projects p WHERE p.id = ${projectId} AND p.owner_user_id = ${ownerUserId}
      RETURNING id
    `;
    return rows[0] !== undefined;
  }

  public async getPublicApp(publicId: string): Promise<PublicAppManifest | null> {
    const rows = await this.sql<Array<{
      public_id: string; project_name: string; entry_page_id: string; release_id: string; release_version: number;
      release_hash: string; published_at: Date; page_id: string; page_slug: string; page_title: string; document: unknown;
    }>>`
      SELECT p.public_id, p.name AS project_name, p.entry_page_id, r.id AS release_id, r.version AS release_version,
             r.content_hash AS release_hash, r.created_at AS published_at, pg.id AS page_id,
             rp.slug AS page_slug, rp.title AS page_title, pv.document
      FROM projects p
      JOIN billing_subscriptions bs ON bs.user_id = p.owner_user_id AND bs.status = 'active' AND bs.current_period_end > now()
      JOIN releases r ON r.id = p.published_release_id AND r.project_id = p.id
      JOIN release_pages rp ON rp.release_id = r.id AND rp.project_id = p.id
      JOIN pages pg ON pg.id = rp.page_id AND pg.project_id = p.id
      JOIN page_versions pv ON pv.id = rp.page_version_id AND pv.page_id = pg.id
      WHERE p.public_id = ${publicId} AND p.status = 'active'
      ORDER BY rp.position
    `;
    return mapManifest(rows);
  }

  public async getPreviewApp(tokenHash: string): Promise<ProjectSnapshot | null> {
    const projects = await this.sql<ProjectRow[]>`
      SELECT p.id, p.public_id, p.name, p.slug, p.status, p.entry_page_id, p.published_release_id, p.updated_at
      FROM preview_grants g JOIN projects p ON p.id = g.project_id
      WHERE g.token_hash = ${tokenHash} AND g.revoked_at IS NULL AND g.expires_at > now() LIMIT 1
    `;
    const project = projects[0];
    if (project === undefined) return null;
    const pages = await this.sql<PageRow[]>`
      SELECT id, project_id, slug, title, draft_document, draft_revision, updated_at
      FROM pages WHERE project_id = ${project.id} ORDER BY created_at, id
    `;
    return { project: mapProject(project), pages: pages.map(mapPage) };
  }
}

function mapProject(row: ProjectRow): ProjectRecord {
  return {
    id: row.id, publicId: row.public_id, name: row.name, slug: row.slug, status: row.status,
    entryPageId: row.entry_page_id, publishedReleaseId: row.published_release_id, updatedAt: row.updated_at.toISOString(),
  };
}

function mapPage(row: PageRow): PageRecord {
  return {
    id: row.id, projectId: row.project_id, slug: row.slug, title: row.title,
    document: pageDocumentSchema.parse(row.draft_document), revision: row.draft_revision, updatedAt: row.updated_at.toISOString(),
  };
}

function sameRevisions(expected: PageRecord[], actual: PageRow[]): boolean {
  if (expected.length !== actual.length) return false;
  const revisions = new Map(expected.map((page) => [page.id, page.revision]));
  return actual.every((page) => revisions.get(page.id) === page.draft_revision);
}

function mapManifest(rows: Array<{
  public_id: string; project_name: string; entry_page_id: string; release_id: string; release_version: number;
  release_hash: string; published_at: Date; page_id: string; page_slug: string; page_title: string; document: unknown;
}>): PublicAppManifest | null {
  const first = rows[0];
  if (first === undefined) return null;
  return {
    project: { publicId: first.public_id, name: first.project_name, entryPageId: first.entry_page_id },
    release: { id: first.release_id, version: first.release_version, contentHash: first.release_hash, publishedAt: first.published_at.toISOString() },
    pages: rows.map((row) => ({ id: row.page_id, slug: row.page_slug, title: row.page_title, document: pageDocumentSchema.parse(row.document) })),
  };
}

function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}
