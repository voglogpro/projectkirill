import type { BotConnectionStatus, BuilderBlock, Lead, ProjectState } from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "";
const SESSION_KEY = "tma-studio-session";
interface Session { accessToken: string; refreshToken: string; user: { id: string; displayName: string; email: string } }
interface RemoteProject { id: string; name: string; status: ProjectState["status"]; publishedReleaseId?: string | null; updatedAt?: string }
interface RemotePage { id: string; title: string; slug: string; revision: number; updatedAt?: string; document: { blocks: BuilderBlock[] } }

export async function registerAccount(input: { displayName: string; email: string; password: string }): Promise<Session> { const response = await request<{ data: Session }>("/v1/auth/register", { method: "POST", body: JSON.stringify(input) }, false); setSession(response.data); return response.data; }
export async function loginAccount(input: { email: string; password: string }): Promise<Session> { const response = await request<{ data: Session }>("/v1/auth/login", { method: "POST", body: JSON.stringify(input) }, false); setSession(response.data); return response.data; }
export function hasSession(): boolean { return readSession() !== undefined; }
export function getCurrentUser(): Session["user"] | undefined { return readSession()?.user; }
export function logout(): void { sessionStorage.removeItem(SESSION_KEY); }

export async function ensureRemoteProject(local: ProjectState): Promise<ProjectState> {
  const projects = (await request<{ data: RemoteProject[] }>("/v1/projects")).data;
  if (projects.length === 0) return createRemoteProject(local);
  return loadRemoteProject(projects[0]!.id, local.plan);
}

export async function createRemoteProject(local: ProjectState): Promise<ProjectState> {
  const slug = `project-${crypto.randomUUID().slice(0, 8)}`;
  const project = (await request<{ data: RemoteProject }>("/v1/projects", { method: "POST", body: JSON.stringify({ name: local.name, slug }) })).data;
  const pages = (await request<{ data: RemotePage[] }>(`/v1/projects/${project.id}/pages`)).data;
  const entry = pages[0]!;
  const first = local.pages[0];
  if (first === undefined) return { ...local, id: project.id, name: project.name, pages: [{ id: entry.id, title: entry.title, slug: entry.slug, blocks: [], remoteRevision: entry.revision }], activePageId: entry.id };
  const entryIdMap = new Map([[first.id, entry.id]]);
  const seededPages = local.pages.map((page, index) => ({
    ...page,
    ...(index === 0 ? { id: entry.id, remoteRevision: entry.revision } : {}),
    blocks: remapActions(page.blocks, entryIdMap),
  }));
  return saveRemoteProject({
    ...local,
    id: project.id,
    name: project.name,
    pages: seededPages,
    activePageId: local.activePageId === first.id ? entry.id : local.activePageId,
  });
}

export async function loadRemoteProject(projectId: string, plan: ProjectState["plan"] = "free"): Promise<ProjectState> {
  const [project, pages, bot, entitlement] = await Promise.all([
    request<{ data: RemoteProject }>(`/v1/projects/${projectId}`),
    request<{ data: RemotePage[] }>(`/v1/projects/${projectId}/pages`),
    request<{ data: { botUsername?: string; miniAppUrl?: string; status: BotConnectionStatus } | null }>(`/v1/bot-connections/${projectId}`).catch(() => ({ data: null })),
    getEntitlement().catch(() => ({ planCode: plan, maxProjects: 1, maxActiveBots: 0, canPublish: false })),
  ]);
  const publishedAt = project.data.updatedAt === undefined ? 0 : Date.parse(project.data.updatedAt);
  const hasPendingChanges = project.data.publishedReleaseId != null && pages.data.some((page) => page.updatedAt !== undefined && Date.parse(page.updatedAt) > publishedAt);
  return { id: project.data.id, name: project.data.name, status: project.data.status, plan: entitlement.planCode, updatedAt: project.data.updatedAt, hasPendingChanges, botUsername: bot.data?.botUsername, miniAppUrl: bot.data?.miniAppUrl, botStatus: bot.data?.status, activePageId: pages.data[0]?.id, pages: pages.data.map((page) => ({ id: page.id, title: page.title, slug: page.slug, blocks: page.document.blocks, remoteRevision: page.revision })) };
}

export async function listRemoteProjects(): Promise<RemoteProject[]> { return (await request<{ data: RemoteProject[] }>("/v1/projects")).data; }
export async function renameRemoteProject(projectId: string, name: string): Promise<void> { await request(`/v1/projects/${projectId}`, { method: "PATCH", body: JSON.stringify({ name }) }); }

function documentFor(page: ProjectState["pages"][number]) { return { schemaVersion: 1, metadata: { title: page.title }, settings: { maxWidth: "normal", respectTelegramTheme: true }, blocks: page.blocks }; }
async function updateRemotePage(projectId: string, page: ProjectState["pages"][number]): Promise<RemotePage> {
  return (await request<{ data: RemotePage }>(`/v1/projects/${projectId}/pages/${page.id}`, { method: "PUT", body: JSON.stringify({ expectedRevision: page.remoteRevision, title: page.title, document: documentFor(page) }) })).data;
}

export async function saveRemoteProject(project: ProjectState): Promise<ProjectState> {
  if (!hasSession()) return project;
  await renameRemoteProject(project.id, project.name);
  const stagedPages = [] as ProjectState["pages"];
  const idMap = new Map<string, string>();
  for (const page of project.pages) {
    if (page.remoteRevision === undefined) {
      const created = (await request<{ data: RemotePage }>(`/v1/projects/${project.id}/pages`, { method: "POST", body: JSON.stringify({ slug: page.slug, title: page.title, document: documentFor(page) }) })).data;
      idMap.set(page.id, created.id); stagedPages.push({ ...page, id: created.id, remoteRevision: created.revision });
    } else { idMap.set(page.id, page.id); stagedPages.push(page); }
  }
  const normalized = stagedPages.map((page) => ({ ...page, blocks: remapActions(page.blocks, idMap) }));
  const savedPages = [] as ProjectState["pages"];
  for (const page of normalized) { const updated = await updateRemotePage(project.id, page); savedPages.push({ ...page, remoteRevision: updated.revision }); }
  return { ...project, pages: savedPages, activePageId: idMap.get(project.activePageId ?? "") ?? savedPages[0]?.id, updatedAt: new Date().toISOString(), hasPendingChanges: project.status === "active" ? true : project.hasPendingChanges };
}
export const saveRemotePage = saveRemoteProject;
export async function deleteRemotePage(projectId: string, pageId: string): Promise<void> { await request(`/v1/projects/${projectId}/pages/${pageId}`, { method: "DELETE" }); }

export async function createPreview(projectId: string): Promise<string> {
  const grant = (await request<{ data: { token: string } }>(`/v1/projects/${projectId}/preview-grants`, { method: "POST", body: JSON.stringify({ ttlSeconds: 3600 }) })).data;
  return `${location.origin}/app/preview?preview=${encodeURIComponent(grant.token)}`;
}

export async function fetchLeads(projectId: string): Promise<Lead[]> { return (await request<{ data: Lead[] }>(`/v1/projects/${projectId}/submissions`)).data; }
export async function validateBot(projectId: string, botToken: string) { return (await request<{ data: { botId: string; firstName: string; username?: string } }>("/v1/bot-connections/validate", { method: "POST", body: JSON.stringify({ projectId, botToken }) })).data; }
export async function createCheckout(planCode: "solo" | "trio") { return (await request<{ data: { checkoutId: string; status: string; confirmationUrl?: string } }>("/v1/billing/checkouts", { method: "POST", body: JSON.stringify({ planCode, clientRequestId: crypto.randomUUID() }) })).data; }
export async function getEntitlement() { return (await request<{ data: { planCode: "free" | "solo" | "trio"; maxProjects: number; maxActiveBots: number; canPublish: boolean; validUntil?: string } }>("/v1/billing/entitlement")).data; }
export async function activateBot(projectId: string, botToken: string) { return (await request<{ data: { botId: string; botUsername?: string; miniAppUrl: string; status: "active" } }>("/v1/bot-connections", { method: "POST", body: JSON.stringify({ projectId, botToken, menuButtonText: "Открыть приложение" }) })).data; }
export async function publishProject(projectId: string) { return (await request<{ data: { project: { publicId: string }; release: { version: number } } }>(`/v1/projects/${projectId}/publish`, { method: "POST" })).data; }

function readSession(): Session | undefined { try { const value = sessionStorage.getItem(SESSION_KEY); return value === null ? undefined : JSON.parse(value) as Session; } catch { return undefined; } }
function setSession(session: Session): void { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
function remapActions(blocks: BuilderBlock[], ids: ReadonlyMap<string, string>): BuilderBlock[] { return blocks.map((block) => { if (block.type === "button" && block.props.action.kind === "page") return { ...block, props: { ...block.props, action: { ...block.props.action, pageId: ids.get(block.props.action.pageId) ?? block.props.action.pageId } } }; if (block.type === "product" && block.props.cta.action.kind === "page") return { ...block, props: { ...block.props, cta: { ...block.props.cta, action: { ...block.props.cta.action, pageId: ids.get(block.props.cta.action.pageId) ?? block.props.cta.action.pageId } } } }; return block; }); }
async function refreshSession(session: Session): Promise<Session | undefined> {
  try { const response = await request<{ data: Session }>("/v1/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken: session.refreshToken }) }, false, false); setSession(response.data); return response.data; }
  catch { logout(); return undefined; }
}

async function request<T = unknown>(path: string, init: RequestInit = {}, authenticated = true, retry = true): Promise<T> {
  const session = readSession();
  let response: Response;
  try { response = await fetch(`${API_URL}${path}`, { ...init, headers: { ...(init.body === undefined ? {} : { "content-type": "application/json" }), ...(authenticated && session ? { authorization: `Bearer ${session.accessToken}` } : {}), ...init.headers }, signal: AbortSignal.timeout(12_000) }); }
  catch (error) { throw new Error(error instanceof DOMException && error.name === "TimeoutError" ? "Сервер не ответил вовремя. Попробуйте ещё раз." : "Нет соединения с сервером."); }
  if (response.status === 401 && authenticated && retry && session && await refreshSession(session)) return request<T>(path, init, true, false);
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? "Сервис временно недоступен");
  return body;
}
