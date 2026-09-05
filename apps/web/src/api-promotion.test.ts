import { afterEach, describe, expect, it, vi } from "vitest";
import { promoteLocalPreview } from "./api";
import { createStarterFlow } from "./flow-store";
import type { ProjectState } from "./types";

const draftId = "11111111-1111-4111-8111-111111111111";
const firstId = "22222222-2222-4222-8222-222222222222";
const secondId = "33333333-3333-4333-8333-333333333333";
function draft(): ProjectState {
  return { id: draftId, name: "Пример", status: "draft", plan: "free", kit: "bot", storageMode: "local-preview", activePageId: firstId, pages: [
    { id: firstId, title: "Главная", slug: "home", blocks: [{ id: "link", version: 1, type: "button", props: { label: "Далее", style: "primary", action: { kind: "page", pageId: secondId }, haptic: "light", fullWidth: true } }] },
    { id: secondId, title: "Контакты", slug: "contacts", blocks: [] },
  ] };
}

function server(options: { recovered?: boolean; losePostResponse?: boolean; active?: boolean; occupied?: boolean; failFirstFlowSave?: boolean } = {}) {
  vi.stubGlobal("sessionStorage", { getItem: () => JSON.stringify({ accessToken: "test", user: { id: "owner" } }) });
  const target = { id: "remote-project", slug: `draft-${draftId}`, name: "Пример", status: options.active ? "active" : "draft", entryPageId: "remote-home", publishedReleaseId: options.active ? "release" : null };
  const projects = options.recovered || options.active ? [target] : options.occupied ? [{ ...target, id: "unrelated", slug: "unrelated" }] : [];
  const pages = [{ id: "remote-home", slug: "home", title: "Главная", revision: 1, document: { blocks: [] as unknown[] } }];
  const writes: Array<{ path: string; method: string; body: Record<string, unknown> }> = [];
  let savedFlow: unknown;
  let failedFlowSave = false;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    const body = JSON.parse(String(init.body ?? "{}")) as Record<string, unknown>;
    const respond = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 });
    if (method !== "GET") writes.push({ path: url, method, body });
    if (url === "/v1/billing/entitlement") return respond({ planCode: "free", maxProjects: 1, maxActiveBots: 0, canPublish: false });
    if (url === "/v1/projects") {
      if (method === "GET") return respond(projects);
      projects.push(target);
      if (options.losePostResponse) throw new TypeError("lost response");
      return respond(target);
    }
    if (url === "/v1/projects/remote-project") return respond(target);
    if (url.endsWith("/flow")) {
      if (method === "PUT") {
        if (options.failFirstFlowSave && !failedFlowSave) { failedFlowSave = true; throw new TypeError("lost flow connection"); }
        savedFlow = body.document;
      }
      return respond({ revision: 1, document: savedFlow });
    }
    if (url.endsWith("/pages")) {
      if (method === "GET") return respond(pages);
      const created = { id: `remote-${pages.length}`, slug: String(body.slug), title: String(body.title), revision: 1, document: body.document as { blocks: unknown[] } };
      pages.push(created); return respond(created);
    }
    const page = pages.find((item) => url.endsWith(`/pages/${item.id}`));
    if (page && method === "PUT") { page.document = body.document as { blocks: unknown[] }; page.revision++; return respond(page); }
    throw new Error(`Unexpected request ${method} ${url}`);
  }));
  return { projects, pages, writes, flow: () => savedFlow };
}

afterEach(() => vi.unstubAllGlobals());

describe("isolated preview promotion", () => {
  it("recovers a committed project after a lost POST response and remaps links", async () => {
    const state = server({ losePostResponse: true });
    const flow = createStarterFlow();
    const result = await promoteLocalPreview(draft(), flow);
    expect(result.storageMode).toBeUndefined();
    expect(result.id).toBe("remote-project");
    expect(result.pages[0]?.blocks[0]).toMatchObject({ props: { action: { pageId: "remote-1" } } });
    expect(state.projects).toHaveLength(1);
    expect(state.flow()).toEqual(flow);
  });

  it("resumes its own partial draft even when the free project slot is occupied", async () => {
    const state = server({ recovered: true });
    await promoteLocalPreview(draft(), createStarterFlow());
    const edited = draft();
    edited.pages[1]!.title = "Новые контакты";
    const result = await promoteLocalPreview(edited, createStarterFlow());
    expect(result.pages[1]?.title).toBe("Новые контакты");
    expect(state.pages).toHaveLength(2);
    expect(state.writes.filter((write) => write.path === "/v1/projects")).toHaveLength(0);
  });

  it("never overwrites an already active target", async () => {
    const state = server({ active: true });
    await expect(promoteLocalPreview(draft(), createStarterFlow())).rejects.toThrow("уже запущен");
    expect(state.writes).toHaveLength(0);
  });

  it("retries a failed scenario save with the latest local pages and flow", async () => {
    const state = server({ failFirstFlowSave: true });
    await expect(promoteLocalPreview(draft(), createStarterFlow("До сбоя"))).rejects.toThrow();
    const edited = draft();
    edited.pages[1]!.title = "Изменено после сбоя";
    const flow = createStarterFlow("Последняя версия сценария");
    const result = await promoteLocalPreview(edited, flow);
    expect(state.projects).toHaveLength(1);
    expect(state.pages).toHaveLength(2);
    expect(result.pages[1]?.title).toBe("Изменено после сбоя");
    expect(state.flow()).toEqual(flow);
    expect(state.writes.filter((write) => write.path === "/v1/projects")).toHaveLength(1);
  });

  it("does not overwrite an unrelated project or allocate another slot", async () => {
    const state = server({ occupied: true });
    await expect(promoteLocalPreview(draft(), createStarterFlow())).rejects.toThrow("Лимит");
    expect(state.writes).toHaveLength(0);
  });
});
