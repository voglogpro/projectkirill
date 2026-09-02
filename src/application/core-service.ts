import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { ConflictError, DomainError, NotFoundError } from "../domain/errors.js";
import {
  createPageSchema,
  createProjectSchema,
  previewGrantSchema,
  updatePageSchema,
  updateProjectSchema,
  type PageRecord,
  type ProjectRecord,
  type ProjectSnapshot,
  type PublicAppManifest,
} from "../domain/core.js";
import { pageDocumentSchema, type Block, type PageDocument } from "../domain/page-document.js";

export interface CoreRepository {
  createProject(ownerUserId: string, input: { name: string; slug: string; entryDocument: PageDocument }): Promise<ProjectRecord>;
  listProjects(ownerUserId: string): Promise<ProjectRecord[]>;
  getOwnedProject(ownerUserId: string, projectId: string): Promise<ProjectRecord | null>;
  updateProject(ownerUserId: string, projectId: string, name: string): Promise<ProjectRecord | null>;
  listPages(ownerUserId: string, projectId: string): Promise<PageRecord[] | null>;
  createPage(ownerUserId: string, projectId: string, input: { slug: string; title: string; document: PageDocument }): Promise<PageRecord | null>;
  updatePage(ownerUserId: string, projectId: string, pageId: string, input: { expectedRevision: number; title: string; document: PageDocument }): Promise<PageRecord | "revision_conflict" | null>;
  deletePage(ownerUserId: string, projectId: string, pageId: string): Promise<"deleted" | "entry_page" | "not_found">;
  getOwnedSnapshot(ownerUserId: string, projectId: string): Promise<ProjectSnapshot | null>;
  publishSnapshot(ownerUserId: string, snapshot: ProjectSnapshot, contentHash: string): Promise<PublicAppManifest | "revision_conflict">;
  createPreviewGrant(ownerUserId: string, projectId: string, tokenHash: string, expiresAt: Date): Promise<boolean>;
  getPublicApp(publicId: string): Promise<PublicAppManifest | null>;
  getPreviewApp(tokenHash: string): Promise<ProjectSnapshot | null>;
}

export interface CoreEntitlementGate {
  assertCanCreateProject(userId: string): Promise<void>;
  assertCanPublish(userId: string, projectId: string): Promise<void>;
}

export class DocumentValidationError extends DomainError {
  public constructor(message: string) {
    super("DOCUMENT_INVALID", message, 422);
  }
}

export class CoreService {
  public constructor(
    private readonly repository: CoreRepository,
    private readonly clock: () => number = () => Date.now(),
    private readonly entitlements?: CoreEntitlementGate,
  ) {}

  public async createProject(ownerUserId: string, untrustedInput: unknown): Promise<ProjectRecord> {
    const input = createProjectSchema.parse(untrustedInput);
    await this.entitlements?.assertCanCreateProject(ownerUserId);
    const entryDocument = pageDocumentSchema.parse({
      schemaVersion: 1,
      metadata: { title: "Главная" },
      settings: { maxWidth: "normal", respectTelegramTheme: true },
      blocks: [],
    });
    return await this.repository.createProject(ownerUserId, { ...input, entryDocument });
  }

  public listProjects(ownerUserId: string): Promise<ProjectRecord[]> {
    return this.repository.listProjects(ownerUserId);
  }

  public async getProject(ownerUserId: string, projectId: string): Promise<ProjectRecord> {
    const project = await this.repository.getOwnedProject(ownerUserId, z.uuid().parse(projectId));
    if (project === null) throw new NotFoundError("Project not found");
    return project;
  }

  public async updateProject(ownerUserId: string, projectId: string, untrustedInput: unknown): Promise<ProjectRecord> {
    const input = updateProjectSchema.parse(untrustedInput);
    const project = await this.repository.updateProject(ownerUserId, z.uuid().parse(projectId), input.name);
    if (project === null) throw new NotFoundError("Project not found");
    return project;
  }

  public async listPages(ownerUserId: string, projectId: string): Promise<PageRecord[]> {
    const pages = await this.repository.listPages(ownerUserId, z.uuid().parse(projectId));
    if (pages === null) throw new NotFoundError("Project not found");
    return pages;
  }

  public async createPage(ownerUserId: string, projectId: string, untrustedInput: unknown): Promise<PageRecord> {
    const input = createPageSchema.parse(untrustedInput);
    const document = validateDocument(input.document);
    const page = await this.repository.createPage(ownerUserId, z.uuid().parse(projectId), { slug: input.slug, title: input.title, document });
    if (page === null) throw new NotFoundError("Project not found");
    return page;
  }

  public async updatePage(ownerUserId: string, projectId: string, pageId: string, untrustedInput: unknown): Promise<PageRecord> {
    const input = updatePageSchema.parse(untrustedInput);
    const document = validateDocument(input.document);
    const result = await this.repository.updatePage(ownerUserId, z.uuid().parse(projectId), z.uuid().parse(pageId), { ...input, document });
    if (result === null) throw new NotFoundError("Page not found");
    if (result === "revision_conflict") throw new ConflictError("The page was changed in another session");
    return result;
  }

  public async deletePage(ownerUserId: string, projectId: string, pageId: string): Promise<void> {
    const result = await this.repository.deletePage(ownerUserId, z.uuid().parse(projectId), z.uuid().parse(pageId));
    if (result === "not_found") throw new NotFoundError("Page not found");
    if (result === "entry_page") throw new ConflictError("The entry page cannot be deleted");
  }

  public async publish(ownerUserId: string, projectId: string): Promise<PublicAppManifest> {
    await this.entitlements?.assertCanPublish(ownerUserId, projectId);
    const snapshot = await this.repository.getOwnedSnapshot(ownerUserId, z.uuid().parse(projectId));
    if (snapshot === null) throw new NotFoundError("Project not found");
    validateSnapshot(snapshot);
    const contentHash = sha256(stableStringify({
      project: { name: snapshot.project.name, entryPageId: snapshot.project.entryPageId },
      pages: snapshot.pages.map(({ id, slug, title, document, revision }) => ({ id, slug, title, document, revision })),
    }));
    const result = await this.repository.publishSnapshot(ownerUserId, snapshot, contentHash);
    if (result === "revision_conflict") throw new ConflictError("The project changed while it was being published");
    return result;
  }

  public async createPreviewGrant(ownerUserId: string, projectId: string, untrustedInput: unknown): Promise<{ token: string; expiresAt: string }> {
    const input = previewGrantSchema.parse(untrustedInput);
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(this.clock() + input.ttlSeconds * 1_000);
    const created = await this.repository.createPreviewGrant(ownerUserId, z.uuid().parse(projectId), sha256(token), expiresAt);
    if (!created) throw new NotFoundError("Project not found");
    return { token, expiresAt: expiresAt.toISOString() };
  }

  public async getPublicApp(publicId: string): Promise<PublicAppManifest> {
    const app = await this.repository.getPublicApp(z.uuid().parse(publicId));
    if (app === null) throw new NotFoundError("Application not found");
    return app;
  }

  public async getPreviewApp(token: string): Promise<ProjectSnapshot> {
    if (token.length < 32 || token.length > 256) throw new NotFoundError("Preview not found");
    const snapshot = await this.repository.getPreviewApp(sha256(token));
    if (snapshot === null) throw new NotFoundError("Preview not found");
    snapshot.pages.forEach((page) => validateDocument(page.document));
    return snapshot;
  }
}

function validateSnapshot(snapshot: ProjectSnapshot): void {
  if (snapshot.project.entryPageId === null || !snapshot.pages.some((page) => page.id === snapshot.project.entryPageId)) {
    throw new DocumentValidationError("The project has no valid entry page");
  }
  const pageIds = new Set(snapshot.pages.map((page) => page.id));
  for (const page of snapshot.pages) validateDocument(page.document, pageIds);
}

function validateDocument(value: unknown, pageIds?: ReadonlySet<string>): PageDocument {
  const document = pageDocumentSchema.parse(value);
  const blockIds = new Set<string>();
  const formKeys = new Set<string>();
  const stack: Array<{ block: Block; depth: number }> = document.blocks.map((block) => ({ block, depth: 1 }));
  let total = 0;
  while (stack.length > 0) {
    const item = stack.pop();
    if (item === undefined) break;
    total += 1;
    if (total > 1_000 || item.depth > 20) throw new DocumentValidationError("The document is too deeply nested or contains too many blocks");
    if (blockIds.has(item.block.id)) throw new DocumentValidationError(`Duplicate block id: ${item.block.id}`);
    blockIds.add(item.block.id);
    if (item.block.type === "section") {
      item.block.children.forEach((child) => stack.push({ block: child, depth: item.depth + 1 }));
      continue;
    }
    if (item.block.type === "form") {
      if (formKeys.has(item.block.props.formKey)) throw new DocumentValidationError(`Duplicate form key: ${item.block.props.formKey}`);
      formKeys.add(item.block.props.formKey);
      for (const field of item.block.props.fields) {
        if (field.kind === "select" && new Set(field.options.map((option) => option.value)).size !== field.options.length) {
          throw new DocumentValidationError(`Select field ${field.id} has duplicate option values`);
        }
      }
    }
    if (item.block.type === "button") validateAction(item.block.props.action, pageIds);
    if (item.block.type === "product") validateAction(item.block.props.cta.action, pageIds);
  }
  return document;
}

function validateAction(action: { kind: string; url?: string; pageId?: string }, pageIds?: ReadonlySet<string>): void {
  if (action.kind === "url") {
    const protocol = new URL(action.url ?? "").protocol;
    if (protocol !== "https:" && protocol !== "http:") throw new DocumentValidationError("External links must use HTTP or HTTPS");
  }
  if (action.kind === "page" && pageIds !== undefined && !pageIds.has(action.pageId ?? "")) {
    throw new DocumentValidationError("A block links to a page outside this project");
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(",")}}`;
}
