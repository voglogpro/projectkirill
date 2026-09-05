import { botFlowDocumentSchema, type BotFlowDocument } from "../../../src/domain/bot-flow";
import type { ProjectState } from "./types";

function account(): string {
  try { return (JSON.parse(sessionStorage.getItem("tma-studio-session") ?? "null") as { user?: { id?: string } } | null)?.user?.id ?? "guest"; }
  catch { return "guest"; }
}
function prefix(): string { return `kira-preview-${account()}-`; }
function key(id: string, kind: "project" | "flow"): string { return `${prefix()}${id}-${kind}`; }

/** Only unsaved writes live here; keys include the account to prevent draft leakage. */
const unsaved = new Map<string, string>();

function read(storedKey: string): string | null {
  const latest = unsaved.get(storedKey);
  if (latest !== undefined) return latest;
  try { return localStorage.getItem(storedKey); }
  catch { return null; }
}

function write(id: string, kind: "project" | "flow", value: string): void {
  const storedKey = key(id, kind);
  try {
    localStorage.setItem(storedKey, value);
    unsaved.delete(storedKey);
  } catch {
    // Keep the editor usable, but never tell the owner a volatile draft is durable.
    unsaved.set(storedKey, value);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("kira-preview-storage-error", { detail: { projectId: id, kind } }));
    }
  }
}

export function previewIdFromUrl(): string | undefined {
  if (typeof location === "undefined") return undefined;
  const id = new URLSearchParams(location.search).get("draft");
  return id && /^[a-f0-9-]{36}$/i.test(id) ? id : undefined;
}
export function loadPreviewProject(id: string): ProjectState | undefined {
  try {
    const project = JSON.parse(read(key(id, "project")) ?? "null") as ProjectState | null;
    return project?.storageMode === "local-preview" && project.id === id && Array.isArray(project.pages) ? project : undefined;
  } catch { return undefined; }
}
export function savePreviewProject(project: ProjectState): void {
  if (project.storageMode !== "local-preview" || !project.kit) return;
  write(project.id, "project", JSON.stringify(project));
}
export function loadPreviewFlow(id: string): BotFlowDocument | undefined {
  try { return botFlowDocumentSchema.parse(JSON.parse(read(key(id, "flow")) ?? "null")); }
  catch { return undefined; }
}
export function savePreviewFlow(id: string, flow: BotFlowDocument): void {
  write(id, "flow", JSON.stringify(flow));
}
export function listPreviewProjects(): ProjectState[] {
  const result: ProjectState[] = [];
  const ownPrefix = prefix();
  const storedKeys = new Set(unsaved.keys());
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const storedKey = localStorage.key(index);
      if (storedKey !== null) storedKeys.add(storedKey);
    }
  } catch { /* Even enumeration may be blocked; include the account's unsaved drafts. */ }
  for (const storedKey of storedKeys) {
    if (!storedKey.startsWith(ownPrefix) || !storedKey.endsWith("-project")) continue;
    const project = loadPreviewProject(storedKey.slice(ownPrefix.length, -8));
    if (project) result.push(project);
  }
  return result;
}
