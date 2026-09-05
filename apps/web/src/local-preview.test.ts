import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listPreviewProjects, loadPreviewFlow, loadPreviewProject, previewIdFromUrl, savePreviewFlow, savePreviewProject } from "./local-preview";
import { createProjectFromTemplate, loadProject, saveProject } from "./store";
import { createStarterFlow, loadFlow, saveFlow } from "./flow-store";
import { saveRemoteProject } from "./api";
import type { ProjectState } from "./types";

function storage() {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => values.delete(key) };
}
beforeEach(() => {
  vi.stubGlobal("localStorage", storage());
  vi.stubGlobal("sessionStorage", storage());
  // Independent accounts also isolate in-memory fallback between tests.
  sessionStorage.setItem("tma-studio-session", JSON.stringify({ user: { id: crypto.randomUUID() } }));
});
afterEach(() => vi.unstubAllGlobals());
function draft(): ProjectState { return { ...createProjectFromTemplate("catalog"), kit: "bot-app", storageMode: "local-preview" }; }

describe("free isolated drafts", () => {
  it("keeps cloud project and original flow storage intact", () => {
    const original = createProjectFromTemplate("services", "Не менять");
    const originalFlow = createStarterFlow("Не менять сценарий");
    saveProject(original); saveFlow(originalFlow);
    const preview = draft();
    saveProject(preview); savePreviewFlow(preview.id, createStarterFlow("Проба"));
    expect(loadProject().id).toBe(original.id);
    expect(loadFlow()).toEqual(originalFlow);
    expect(loadPreviewProject(preview.id)).toEqual(preview);
    expect(loadPreviewFlow(preview.id)?.metadata.name).toBe("Проба");
  });
  it("keeps multiple templates and accounts separate", () => {
    const first = draft(), second = draft();
    savePreviewProject(first); savePreviewProject(second);
    expect(listPreviewProjects()).toHaveLength(2);
    sessionStorage.setItem("tma-studio-session", JSON.stringify({ user: { id: "another-account" } }));
    expect(listPreviewProjects()).toEqual([]);
    expect(loadPreviewProject(first.id)).toBeUndefined();
  });
  it("never writes an isolated draft through the cloud save API", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    sessionStorage.setItem("tma-studio-session", JSON.stringify({ accessToken: "qa-only", user: { id: "qa" } }));
    const preview = draft();
    expect(await saveRemoteProject(preview)).toBe(preview);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("only restores explicit UUID draft URLs", () => {
    const id = crypto.randomUUID();
    vi.stubGlobal("location", { search: `?draft=${id}` });
    expect(previewIdFromUrl()).toBe(id);
    vi.stubGlobal("location", { search: "?draft=../../cloud" });
    expect(previewIdFromUrl()).toBeUndefined();
  });

  it("keeps the latest project and flow in memory on quota failure and warns the UI", () => {
    const target = new EventTarget();
    vi.stubGlobal("window", target);
    const warning = vi.fn();
    target.addEventListener("kira-preview-storage-error", warning);
    const preview = draft();
    savePreviewProject(preview);
    const staleFlow = createStarterFlow("До ошибки");
    savePreviewFlow(preview.id, staleFlow);
    const fail = vi.spyOn(localStorage, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    const newest = { ...preview, name: "Последняя версия" };
    const newestFlow = createStarterFlow("Новейший сценарий");
    expect(() => savePreviewProject(newest)).not.toThrow();
    expect(() => savePreviewFlow(preview.id, newestFlow)).not.toThrow();
    expect(loadPreviewProject(preview.id)).toEqual(newest);
    expect(loadPreviewFlow(preview.id)).toEqual(newestFlow);
    expect(listPreviewProjects()).toEqual([newest]);
    expect(warning).toHaveBeenCalledTimes(2);
    expect((warning.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({ projectId: preview.id, kind: "project" });
    // A subsequent durable write supersedes and removes the stale memory copy.
    fail.mockRestore();
    const savedAgain = { ...preview, name: "Сохранено на диск" };
    savePreviewProject(savedAgain);
    expect(loadPreviewProject(preview.id)).toEqual(savedAgain);
    expect(listPreviewProjects()).toEqual([savedAgain]);
  });

  it("lists volatile drafts when browser storage access itself is forbidden", () => {
    vi.stubGlobal("localStorage", {
      get length() { throw new DOMException("Blocked", "SecurityError"); },
      getItem: () => { throw new DOMException("Blocked", "SecurityError"); },
      setItem: () => { throw new DOMException("Blocked", "SecurityError"); },
    });
    const preview = draft(), flow = createStarterFlow("В памяти");
    expect(() => { savePreviewProject(preview); savePreviewFlow(preview.id, flow); }).not.toThrow();
    expect(loadPreviewProject(preview.id)).toEqual(preview);
    expect(loadPreviewFlow(preview.id)).toEqual(flow);
    expect(listPreviewProjects()).toEqual([preview]);
    expect(loadPreviewProject(crypto.randomUUID())).toBeUndefined();
  });

  it("never exposes account A's volatile project or flow to account B", () => {
    const originalSession = sessionStorage.getItem("tma-studio-session")!;
    vi.spyOn(localStorage, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    const preview = draft(), flow = createStarterFlow("Аккаунт A");
    savePreviewProject(preview); savePreviewFlow(preview.id, flow);
    sessionStorage.setItem("tma-studio-session", JSON.stringify({ user: { id: "separate-account-b" } }));
    expect(listPreviewProjects()).toEqual([]);
    expect(loadPreviewProject(preview.id)).toBeUndefined();
    expect(loadPreviewFlow(preview.id)).toBeUndefined();
    const second = { ...preview, name: "Аккаунт B" };
    savePreviewProject(second);
    expect(listPreviewProjects()).toEqual([second]);
    sessionStorage.setItem("tma-studio-session", originalSession);
    expect(listPreviewProjects()).toEqual([preview]);
    expect(loadPreviewFlow(preview.id)).toEqual(flow);
  });

  it.each(["{broken", "null", "{}", JSON.stringify({ schemaVersion: 1, metadata: { name: "Bad" }, nodes: [], edges: [] })])("rejects malformed or invalid stored scenario: %s", (corrupt) => {
    const preview = draft();
    const accountId = JSON.parse(sessionStorage.getItem("tma-studio-session")!).user.id as string;
    localStorage.setItem(`kira-preview-${accountId}-${preview.id}-flow`, corrupt);
    expect(loadPreviewFlow(preview.id)).toBeUndefined();
  });
});
