import { useCallback, useEffect, useState } from "react";
import { createRemoteProject, ensureRemoteProject, getCurrentUser, getEntitlement, hasSession, listRemoteProjects, loadRemoteFlow, loadRemoteProject, promoteLocalPreview, publishProject, publishRemoteFlow, saveRemoteProject } from "./api";
import { AuthModal } from "./components/AuthModal";
import { Builder } from "./components/Builder";
import { Dashboard } from "./components/Dashboard";
import { Landing } from "./components/Landing";
import { LaunchModal } from "./components/LaunchModal";
import { LegalPage } from "./components/LegalPage";
import { Onboarding } from "./components/Onboarding";
import { Service } from "./components/Service";
import { PreviewModal } from "./components/PreviewModal";
import { StartHub } from "./components/StartHub";
import { WorkspaceShell } from "./components/WorkspaceShell";
import { FlowEditor } from "./components/FlowEditor";
import { createFlowFromTemplate, createStarterFlow, flowTemplateOptions, loadFlow, pageTemplateForFlow, saveFlow, type FlowTemplateId } from "./flow-store";
import { listPreviewProjects, loadPreviewFlow, loadPreviewProject, previewIdFromUrl, savePreviewFlow } from "./local-preview";
import { createProjectFromTemplate, loadProject, saveProject } from "./store";
import type { DashboardSection, ProductKit, ProjectState } from "./types";
import { planFitsKit, priceForKit, type PaidBillingPlanCode } from "./pricing";

type Screen = "landing" | "hub" | "onboarding" | "dashboard" | "builder" | "flow" | "legal" | "service";
type StartIntent = { mode?: "register" | "login"; templateId?: FlowTemplateId; plan?: PaidBillingPlanCode; kit?: ProductKit };
const routeFor: Record<Screen, string> = { landing: "/", hub: "/hub", onboarding: "/start", dashboard: "/workspace", builder: "/builder", flow: "/flow", legal: "/privacy", service: "/service" };
function screenFromPath(path: string): Screen { return path === "/privacy" || path === "/terms" ? "legal" : path.startsWith("/service") ? "service" : path.startsWith("/flow") ? "flow" : path.startsWith("/builder") ? "builder" : path.startsWith("/workspace") || path.startsWith("/billing/return") ? "dashboard" : path.startsWith("/start") ? "onboarding" : path.startsWith("/hub") || path.startsWith("/guide") ? "hub" : "landing"; }

function initialProject(): ProjectState {
  const id = previewIdFromUrl();
  if (!id) return loadProject();
  return loadPreviewProject(id) ?? { ...createProjectFromTemplate("blank", "Бесплатный черновик"), id, kit: "bot-app", storageMode: "local-preview" };
}

export function App() {
  const [screen, setScreen] = useState<Screen>(() => screenFromPath(location.pathname));
  const [project, setProject] = useState<ProjectState>(initialProject);
  const [flow, setFlow] = useState(() => { const id = previewIdFromUrl(); return id ? loadPreviewFlow(id) ?? createStarterFlow() : loadFlow(); });
  const [intent, setIntent] = useState<StartIntent>({});
  const [launchOpen, setLaunchOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resumeLaunch, setResumeLaunch] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [toast, setToast] = useState<string>();
  const [section, setSection] = useState<DashboardSection>("overview");
  const [draftSaveOpen, setDraftSaveOpen] = useState(false);
  const [resumeDraftSave, setResumeDraftSave] = useState(false);

  /** The sidebar stays put, so choosing a section may open an editor beside it. */
  function openSection(next: DashboardSection) {
    if (next === "flow") { navigate("flow"); return; }
    if (next === "design") { navigate("builder"); return; }
    setSection(next);
    navigate("dashboard");
    window.scrollTo(0, 0);
  }

  const navigate = useCallback((next: Screen, replace = false, draftId?: string) => { setScreen(next); history[replace ? "replaceState" : "pushState"]({}, "", `${routeFor[next]}${draftId ? `?draft=${encodeURIComponent(draftId)}` : ""}`); window.scrollTo(0, 0); }, []);
  useEffect(() => { const pop = () => {
    const id = previewIdFromUrl();
    setProject(initialProject());
    setFlow(id ? loadPreviewFlow(id) ?? createStarterFlow() : loadFlow());
    setScreen(screenFromPath(location.pathname));
  }; addEventListener("popstate", pop); return () => removeEventListener("popstate", pop); }, []);
  useEffect(() => { if (!location.pathname.startsWith("/billing/return")) return; setToast("Возвращаемся в мастер и проверяем оплату…"); try { const channel = new BroadcastChannel("tma-studio-payment"); channel.postMessage({ type: "payment-return" }); channel.close(); } catch { /* The launch modal still has a manual status check. */ } }, []);
  // Cancel stale reads when switching to another project or a free preview.
  // A failed read must never create an extra cloud project.
  useEffect(() => {
    if (project.storageMode === "local-preview" || (screen !== "dashboard" && screen !== "builder") || !hasSession()) return;
    let active = true;
    void loadRemoteProject(project.id).then((remote) => {
      if (active) {
        const restored = { ...remote, activePageId: remote.pages.some((page) => page.id === project.activePageId) ? project.activePageId : remote.activePageId };
        setProject(restored); saveProject(restored);
      }
    }).catch((reason) => { if (active) setToast(messageFrom(reason, "Не удалось восстановить проект")); });
    return () => { active = false; };
  }, [screen, project.id, project.storageMode]);
  useEffect(() => {
    const warn = () => setToast("Браузер не разрешил сохранить черновик. Изменения доступны только в этой вкладке — не закрывайте её.");
    window.addEventListener("kira-preview-storage-error", warn);
    return () => window.removeEventListener("kira-preview-storage-error", warn);
  }, []);
  // The hub can be opened directly (reload, «Помощь», a bookmark), so it loads
  // the project list itself instead of relying on the login that filled it.
  useEffect(() => { if (screen !== "hub" || !hasSession()) return; let active = true; void listRemoteProjects().then((items) => { if (active) setProjects(items.map((item) => ({ id: item.id, name: item.name }))); }).catch(() => undefined); return () => { active = false; }; }, [screen]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(undefined), 4000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (!draftSaveOpen) return;
    const dialog = document.getElementById("draft-save-title")?.closest<HTMLElement>('[role="dialog"]');
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.querySelector<HTMLElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) setDraftSaveOpen(false);
      if (event.key !== "Tab") return;
      const buttons = Array.from(dialog?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
      const target = event.shiftKey ? buttons.at(-1) : buttons[0];
      if (document.activeElement === (event.shiftKey ? buttons[0] : buttons.at(-1)) || !dialog?.contains(document.activeElement)) { event.preventDefault(); target?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [draftSaveOpen, busy]);

  const updateProject = useCallback((next: ProjectState) => { setProject(next); saveProject(next); }, []);

  async function start(nextIntent: StartIntent = {}) {
    setIntent(nextIntent);
    if (!hasSession()) { setAuthOpen(true); return; }
    if (nextIntent.templateId) { navigate("onboarding"); return; }
    navigate("hub");
  }

  async function openWorkspace() {
    if (!hasSession()) { if (project.storageMode === "local-preview") updateProject(loadProject()); navigate("dashboard"); return; }
    setBusy(true);
    try { const remote = await ensureRemoteProject(project.storageMode === "local-preview" ? loadProject() : project); updateProject(remote); navigate("dashboard"); }
    catch (reason) { setToast(messageFrom(reason, "Не удалось открыть проект")); }
    finally { setBusy(false); }
  }

  // Every way in — a fresh account or a returning login — passes through the
  // start screen: first say what you are building, then land in a tool.
  async function afterAuth(_mode: "register" | "login" = "login") {
    setAuthOpen(false);
    setBusy(true);
    try {
      const remoteProjects = await listRemoteProjects();
      setProjects(remoteProjects.map((item) => ({ id: item.id, name: item.name })));
      if (resumeDraftSave) { saveProject(project); savePreviewFlow(project.id, flow); setResumeDraftSave(false); setDraftSaveOpen(true); navigate(project.kit === "bot" ? "flow" : "builder", false, project.id); return; }
      if (resumeLaunch) { const remote = remoteProjects.some((item) => item.id === project.id) ? await saveRemoteProject(project) : await createRemoteProject(project); updateProject(remote); setResumeLaunch(false); setLaunchOpen(true); navigate("builder"); return; }
      if (intent.templateId) { navigate("onboarding"); return; }
      navigate("hub");
    } catch (reason) { setToast(messageFrom(reason, "Не удалось загрузить кабинет")); }
    finally { setBusy(false); }
  }

  async function pickKit(kit: ProductKit, plan?: PaidBillingPlanCode) {
    setIntent((current) => ({ kit, plan: plan ?? (current.plan && planFitsKit(current.plan, kit) ? current.plan : undefined) }));
    const existing = listPreviewProjects().find((item) => item.kit === kit);
    const names: Record<ProductKit, string> = { bot: "Мой текстовый бот", "bot-app": "Мой Mini App", "bot-app-site": "Мой проект", site: "Мой сайт" };
    const next: ProjectState = existing ?? { ...createProjectFromTemplate(kit === "bot-app" ? "catalog" : "services", names[kit]), kit, storageMode: "local-preview" };
    const scenario = loadPreviewFlow(next.id) ?? createStarterFlow(next.name);
    updateProject(next); setFlow(scenario); savePreviewFlow(next.id, scenario);
    navigate(kit === "bot" ? "flow" : "builder", false, next.id);
    setToast("Бесплатный черновик на этом устройстве. Облачные проекты не изменены.");
  }

  async function openProject(id: string) {
    const local = loadPreviewProject(id);
    if (local) { updateProject(local); setFlow(loadPreviewFlow(id) ?? createStarterFlow(local.name)); navigate(local.kit === "bot" ? "flow" : "builder", false, id); return; }
    setBusy(true);
    try { updateProject(await loadRemoteProject(id)); navigate("dashboard"); }
    catch (reason) { setToast(messageFrom(reason, "Не удалось открыть проект")); }
    finally { setBusy(false); }
  }

  async function finishOnboarding(templateId: FlowTemplateId, name: string, kit: ProductKit = intent.kit ?? "bot") {
    setBusy(true);
    // The bot is the product; the Mini App page is seeded to match and waits
    // until the owner adds it as the second product.
    const local = createProjectFromTemplate(pageTemplateForFlow[templateId], name);
    const scenario = createFlowFromTemplate(templateId, name);
    try {
      const next: ProjectState = { ...local, kit, storageMode: "local-preview" };
      updateProject(next); setFlow(scenario); savePreviewFlow(next.id, scenario);
      navigate(next.kit === "bot" ? "flow" : "builder", false, next.id); setToast("Шаблон готов. Меняйте и проверяйте бесплатно — существующие проекты не изменятся.");
    } catch (reason) { setToast(messageFrom(reason, "Не удалось создать бота")); }
    finally { setBusy(false); }
  }

  async function launch(current: ProjectState = project) {
    if (current.storageMode === "local-preview") { updateProject(current); setDraftSaveOpen(true); return; }
    if (!hasSession()) { setResumeLaunch(true); setAuthOpen(true); return; }
    setBusy(true);
    try {
      const synced = await saveRemoteProject(current);
      const entitlement = await getEntitlement();
      const ready = { ...synced, plan: entitlement.planCode };
      updateProject(ready);
      if (ready.botUsername && ready.botStatus === "active" && entitlement.canPublish && (planFitsKit(entitlement.planCode, ready.kit ?? "bot") || Boolean(ready.legacyFullAccessUntil && Date.parse(ready.legacyFullAccessUntil) > Date.now()))) {
        await publishProject(ready.id);
        await loadRemoteFlow(ready.id);
        await publishRemoteFlow(ready.id);
        updateProject({ ...ready, status: "active", previewed: true, hasPendingChanges: false });
        setToast("Изменения опубликованы — Mini App уже обновлён");
        return;
      }
      setLaunchOpen(true);
    }
    catch (reason) { setToast(`Не удалось подготовить публикацию: ${messageFrom(reason, "попробуйте ещё раз")}`); }
    finally { setBusy(false); }
  }
  function preview(current: ProjectState = project) { const next = { ...current, previewed: true }; updateProject(next); setPreviewOpen(true); }

  async function saveDraftToAccount() {
    if (!hasSession()) { setResumeDraftSave(true); setDraftSaveOpen(false); setAuthOpen(true); return; }
    setBusy(true);
    try {
      const created = await promoteLocalPreview(project, flow);
      updateProject({ ...created, kit: project.kit }); saveFlow(flow);
      setDraftSaveOpen(false); navigate(project.kit === "bot" ? "flow" : "builder", true);
      setToast("Сохранено новым проектом в аккаунте. Существующие проекты не изменены.");
      setLaunchOpen(true);
    } catch (reason) { setToast(messageFrom(reason, "Не удалось сохранить в аккаунт. Локальная копия сохранена.")); }
    finally { setBusy(false); }
  }

  return <>
    {screen === "landing" && <Landing onStart={(value) => void start(value)} onService={() => navigate("service")} />}
    {screen === "service" && <Service onStart={() => void start()} onHome={() => navigate("landing")} />}
    {screen === "legal" && <LegalPage kind={location.pathname === "/terms" ? "terms" : "privacy"} onBack={() => navigate("landing")} />}
    {screen === "hub" && <StartHub userName={getCurrentUser()?.displayName} pending={busy} projects={[...projects, ...listPreviewProjects().map((item) => ({ id: item.id, name: `${item.name} · на устройстве` }))]} onPick={(kit, plan) => void pickKit(kit, plan)} onTemplate={(templateId) => { setIntent({ templateId, kit: "bot" }); void finishOnboarding(templateId, flowTemplateOptions.find((item) => item.id === templateId)?.title ?? "Мой бот", "bot"); }} onOpenProject={(id) => void openProject(id)} onSkip={() => void openWorkspace()} />}
    {screen === "onboarding" && <Onboarding initialTemplate={intent.templateId} pending={busy} onBack={() => navigate("hub")} onCreate={(templateId, name) => void finishOnboarding(templateId, name)} />}
    {(screen === "dashboard" || screen === "flow" || screen === "builder") && <WorkspaceShell
      project={project}
      active={screen === "flow" ? "flow" : screen === "builder" ? "design" : section}
      editing={screen === "flow" || screen === "builder"}
      primaryLabel={project.status === "active" ? "Опубликовать изменения" : "Запустить проект"}
      onPrimary={() => void launch()}
      onSelect={(next) => openSection(next)}
      onNewProject={() => navigate("hub")}
      onHome={() => navigate("landing")}
      onOpenProject={async (id) => { setBusy(true); try { updateProject(await loadRemoteProject(id)); navigate("dashboard"); } catch (reason) { setToast(messageFrom(reason, "Не удалось открыть проект")); } finally { setBusy(false); } }}
    >
      {screen === "dashboard" && <Dashboard project={project} section={section} onSelect={openSection} onProjectChange={updateProject} onEdit={() => navigate("builder")} onEditFlow={() => navigate("flow")} onPreview={() => preview()} onLaunch={() => void launch()} onReconnect={() => setLaunchOpen(true)} onGuide={() => navigate("hub")} onMessage={setToast} />}
      {project.storageMode === "local-preview" && (screen === "builder" || screen === "flow") && <nav className="local-preview-nav" aria-label="Конструкторы черновика"><span>Бесплатный черновик</span><button aria-pressed={screen === "flow"} onClick={() => navigate("flow", false, project.id)}>Бот</button><button aria-pressed={screen === "builder"} onClick={() => navigate("builder", false, project.id)}>Mini App / сайт</button><button onClick={() => navigate("hub")}>Все конструкторы</button></nav>}
      {screen === "flow" && <FlowEditor key={project.id} localOnly={project.storageMode === "local-preview"} flow={flow} projectId={project.id} onChange={(next) => { setFlow(next); if (project.storageMode === "local-preview") savePreviewFlow(project.id, next); else saveFlow(next); }} onBack={() => navigate(project.storageMode === "local-preview" ? "hub" : "dashboard")} onLaunch={() => void launch()} onMessage={setToast} />}
      {screen === "builder" && <Builder key={project.id} initialProject={project} onChange={updateProject} onBack={() => navigate(project.storageMode === "local-preview" ? "hub" : "dashboard")} onPreview={(current) => preview(current)} onLaunch={(current) => void launch(current)} onMessage={setToast} />}
    </WorkspaceShell>}
    {authOpen && <AuthModal initialMode={intent.mode ?? "register"} onClose={() => { setAuthOpen(false); setResumeDraftSave(false); setResumeLaunch(false); }} onAuthenticated={afterAuth} onDemo={() => { setAuthOpen(false); setResumeDraftSave(false); setResumeLaunch(false); navigate("onboarding"); }} />}
    {launchOpen && <LaunchModal projectId={project.id} projectKit={project.kit ?? "bot"} legacyFullAccessUntil={project.legacyFullAccessUntil} initialPlan={project.plan === "free" ? intent.plan : project.plan} existingBot={project.botUsername && project.botStatus === "active" ? { username: project.botUsername, miniAppUrl: project.miniAppUrl } : undefined} onClose={() => setLaunchOpen(false)} onLaunched={(result) => { updateProject({ ...project, status: "active", plan: result.plan, botUsername: result.botUsername, miniAppUrl: result.miniAppUrl, botStatus: "active", previewed: true, hasPendingChanges: false }); setToast("Бот опубликован и готов принимать клиентов"); }} />}
    {previewOpen && <PreviewModal project={project} onClose={() => setPreviewOpen(false)} />}
    {draftSaveOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setDraftSaveOpen(false); }}><div className="draft-save-dialog" role="dialog" aria-modal="true" aria-labelledby="draft-save-title"><h2 id="draft-save-title">Готовы к запуску?</h2><p>Редактирование и предпросмотр бесплатны. Этот черновик хранится отдельно на вашем устройстве.</p><p>Для запуска сохраним его новым проектом в аккаунте, затем откроем настройку хостинга. Существующий проект не заменяется. Если лимит облачных проектов занят, пробная копия всё равно останется доступна.</p><p className="muted">Запуск этого формата — {priceForKit(project.kit ?? "bot")} ₽/мес. 650 ₽ — либо три текстовых бота, либо один проект с Mini App и сайтом по желанию. Сейчас деньги не списываются.</p><button className="primary-button" disabled={busy} onClick={() => void saveDraftToAccount()}>{hasSession() ? "Сохранить и настроить запуск" : "Войти для сохранения"}</button><button className="outline-button" disabled={busy} onClick={() => setDraftSaveOpen(false)}>Продолжить бесплатно</button></div></div>}
    {busy && <div className="global-busy" role="status">Сохраняем…</div>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </>;
}
function messageFrom(reason: unknown, fallback: string) { return reason instanceof Error ? reason.message : fallback; }
