import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { CoreService, DocumentValidationError, type CoreRepository } from "../src/application/core-service.js";
import { ConflictError } from "../src/domain/errors.js";
import type { PageDocument } from "../src/domain/page-document.js";

const ownerId = randomUUID();
const projectId = randomUUID();
const publicId = randomUUID();
const pageId = randomUUID();

function document(blocks: PageDocument["blocks"] = []): PageDocument {
  return { schemaVersion: 1, metadata: { title: "Главная" }, settings: { maxWidth: "normal", respectTelegramTheme: true }, blocks };
}

function fixture(doc = document()) {
  const project = { id: projectId, publicId, name: "Shop", slug: "my-shop", status: "draft" as const, entryPageId: pageId, publishedReleaseId: null, updatedAt: new Date().toISOString() };
  const page = { id: pageId, projectId, slug: "home", title: "Главная", document: doc, revision: 1, updatedAt: new Date().toISOString() };
  const manifest = { project: { publicId, name: "Shop", entryPageId: pageId }, release: { id: randomUUID(), version: 1, contentHash: "a".repeat(64), publishedAt: new Date().toISOString() }, pages: [{ id: pageId, slug: "home", title: "Главная", document: doc }] };
  const repository: CoreRepository = {
    createProject: vi.fn().mockResolvedValue(project), listProjects: vi.fn().mockResolvedValue([project]),
    getOwnedProject: vi.fn().mockResolvedValue(project), updateProject: vi.fn().mockResolvedValue(project),
    listPages: vi.fn().mockResolvedValue([page]), createPage: vi.fn().mockResolvedValue(page),
    updatePage: vi.fn().mockResolvedValue(page), deletePage: vi.fn().mockResolvedValue("deleted"),
    getOwnedSnapshot: vi.fn().mockResolvedValue({ project, pages: [page] }), publishSnapshot: vi.fn().mockResolvedValue(manifest),
    createPreviewGrant: vi.fn().mockResolvedValue(true), getPublicApp: vi.fn().mockResolvedValue(manifest), getPreviewApp: vi.fn().mockResolvedValue({ project, pages: [page] }),
  };
  return { service: new CoreService(repository), repository, page, project };
}

describe("CoreService", () => {
  it("validates the complete graph and publishes one snapshot", async () => {
    const { service, repository } = fixture();
    const result = await service.publish(ownerId, projectId);
    expect(result.project.publicId).toBe(publicId);
    expect(repository.publishSnapshot).toHaveBeenCalledOnce();
    expect(vi.mocked(repository.publishSnapshot).mock.calls[0]?.[2]).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects cross-project page links before writing a release", async () => {
    const bad = document([{ id: randomUUID(), version: 1, type: "button", props: { label: "Чужая страница", style: "primary", action: { kind: "page", pageId: randomUUID() }, haptic: "light", fullWidth: true } }]);
    const { service, repository } = fixture(bad);
    await expect(service.publish(ownerId, projectId)).rejects.toBeInstanceOf(DocumentValidationError);
    expect(repository.publishSnapshot).not.toHaveBeenCalled();
  });

  it("rejects non-http external links", async () => {
    const bad = document([{ id: randomUUID(), version: 1, type: "button", props: { label: "Опасная ссылка", style: "primary", action: { kind: "url", url: "javascript:alert(1)" }, haptic: "none", fullWidth: true } }]);
    const { service } = fixture();
    await expect(service.updatePage(ownerId, projectId, pageId, { expectedRevision: 1, title: "Главная", document: bad })).rejects.toBeInstanceOf(DocumentValidationError);
  });

  it("maps optimistic locking failures to a conflict", async () => {
    const { service, repository } = fixture();
    vi.mocked(repository.updatePage).mockResolvedValue("revision_conflict");
    await expect(service.updatePage(ownerId, projectId, pageId, { expectedRevision: 1, title: "Главная", document: document() })).rejects.toBeInstanceOf(ConflictError);
  });
});
