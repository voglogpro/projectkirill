import type { ProjectState } from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "";
const SESSION_KEY = "tma-studio-session";

interface Session { accessToken: string; refreshToken: string; user: { id: string; displayName: string; email: string } }
interface RemoteProject { id: string; name: string; status: ProjectState["status"]; }
interface RemotePage { id: string; title: string; slug: string; revision: number; document: { blocks: ProjectState["pages"][number]["blocks"] } }

export async function registerAccount(input: { displayName: string; email: string; password: string }): Promise<Session> {
  const response = await request<{ data: Session }>("/v1/auth/register", { method: "POST", body: JSON.stringify(input) }, false);
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(response.data)); return response.data;
}

export async function loginAccount(input: { email: string; password: string }): Promise<Session> {
  const response = await request<{ data: Session }>("/v1/auth/login", { method: "POST", body: JSON.stringify(input) }, false);
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(response.data)); return response.data;
}

export async function ensureRemoteProject(local: ProjectState): Promise<ProjectState> {
  let projects = (await request<{ data: RemoteProject[] }>("/v1/projects")).data;
  if (projects.length === 0) {
    const created = await request<{ data: RemoteProject }>("/v1/projects", { method: "POST", body: JSON.stringify({ name: local.name, slug: `project-${crypto.randomUUID().slice(0, 8)}` }) }); projects = [created.data];
  }
  const project = projects[0]!;
  const pages = (await request<{ data: RemotePage[] }>(`/v1/projects/${project.id}/pages`)).data;
  const page = pages[0];
  if (page === undefined) return { ...local, id: project.id };
  if (page.document.blocks.length === 0 && local.pages[0] !== undefined) {
    const updated = await request<{ data: RemotePage }>(`/v1/projects/${project.id}/pages/${page.id}`, { method: "PUT", body: JSON.stringify({ expectedRevision: page.revision, title: local.pages[0].title, document: { schemaVersion: 1, metadata: { title: local.pages[0].title }, settings: { maxWidth: "normal", respectTelegramTheme: true }, blocks: local.pages[0].blocks } }) });
    return { ...local, id: project.id, remoteRevision: updated.data.revision, pages: [{ ...local.pages[0], id: updated.data.id }] };
  }
  return { ...local, id: project.id, remoteRevision: page.revision, pages: pages.map((item) => ({ id: item.id, title: item.title, slug: item.slug, blocks: item.document.blocks })) };
}

export async function validateBot(projectId: string, botToken: string) {
  return (await request<{ data: { botId: string; firstName: string; username?: string } }>("/v1/bot-connections/validate", { method: "POST", body: JSON.stringify({ projectId, botToken }) })).data;
}

export async function createCheckout(planCode: "solo" | "trio") {
  return (await request<{ data: { checkoutId: string; status: string; confirmationUrl?: string } }>("/v1/billing/checkouts", { method: "POST", body: JSON.stringify({ planCode, clientRequestId: crypto.randomUUID() }) })).data;
}

export async function getEntitlement() {
  return (await request<{ data: { planCode: "free" | "solo" | "trio"; maxProjects: number; maxActiveBots: number; canPublish: boolean; validUntil?: string } }>("/v1/billing/entitlement")).data;
}

export async function saveRemotePage(project: ProjectState): Promise<ProjectState> {
  const page = project.pages[0];
  if (page === undefined || project.remoteRevision === undefined) return project;
  const updated = await request<{ data: RemotePage }>(`/v1/projects/${project.id}/pages/${page.id}`, {
    method: "PUT",
    body: JSON.stringify({ expectedRevision: project.remoteRevision, title: page.title, document: { schemaVersion: 1, metadata: { title: page.title }, settings: { maxWidth: "normal", respectTelegramTheme: true }, blocks: page.blocks } }),
  });
  return { ...project, remoteRevision: updated.data.revision };
}

export async function activateBot(projectId: string, botToken: string) {
  return (await request<{ data: { botId: string; botUsername?: string; miniAppUrl: string; status: "active" } }>("/v1/bot-connections", { method: "POST", body: JSON.stringify({ projectId, botToken, menuButtonText: "Открыть приложение" }) })).data;
}

export async function publishProject(projectId: string) {
  return (await request<{ data: { project: { publicId: string }; release: { version: number } } }>(`/v1/projects/${projectId}/publish`, { method: "POST" })).data;
}

export function hasSession(): boolean { return sessionStorage.getItem(SESSION_KEY) !== null; }

async function request<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
  const session = sessionStorage.getItem(SESSION_KEY); const accessToken = session === null ? undefined : (JSON.parse(session) as Session).accessToken;
  const response = await fetch(`${API_URL}${path}`, { ...init, headers: { "content-type": "application/json", ...(authenticated && accessToken !== undefined ? { authorization: `Bearer ${accessToken}` } : {}), ...init.headers }, signal: AbortSignal.timeout(10_000) });
  const body = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? "Сервис временно недоступен"); return body;
}
