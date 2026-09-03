import { useCallback, useEffect, useState } from "react";
import { createRemoteProject, ensureRemoteProject, getEntitlement, hasSession, listRemoteProjects, loadRemoteFlow, loadRemoteProject, publishProject, saveRemoteFlow, saveRemoteProject } from "./api";
import { AuthModal } from "./components/AuthModal";
import { Builder } from "./components/Builder";
import { Dashboard } from "./components/Dashboard";
import { Landing } from "./components/Landing";
import { LaunchModal } from "./components/LaunchModal";
import { LegalPage } from "./components/LegalPage";
import { Onboarding } from "./components/Onboarding";
import { PreviewModal } from "./components/PreviewModal";
import { FlowEditor } from "./components/FlowEditor";
import { createFlowFromTemplate, loadFlow, pageTemplateForFlow, saveFlow, type FlowTemplateId } from "./flow-store";
import { createProjectFromTemplate, loadProject, saveProject } from "./store";
import type { ProjectState } from "./types";

type Screen = "landing" | "onboarding" | "dashboard" | "builder" | "flow" | "legal";
type StartIntent = { mode?: "register" | "login"; templateId?: FlowTemplateId; plan?: "solo" | "trio" };
const routeFor: Record<Screen, string> = { landing: "/", onboarding: "/start", dashboard: "/workspace", builder: "/builder", flow: "/flow", legal: "/privacy" };
function screenFromPath(path: string): Screen { return path === "/privacy" || path === "/terms" ? "legal" : path.startsWith("/flow") ? "flow" : path.startsWith("/builder") ? "builder" : path.startsWith("/workspace") || path.startsWith("/billing/return") ? "dashboard" : path.startsWith("/start") ? "onboarding" : "landing"; }

export function App() {
  const [screen, setScreen] = useState<Screen>(() => screenFromPath(location.pathname));
  const [project, setProject] = useState<ProjectState>(loadProject);
  const [flow, setFlow] = useState(loadFlow);
  const [intent, setIntent] = useState<StartIntent>({});
  const [launchOpen, setLaunchOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resumeLaunch, setResumeLaunch] = useState(false);
  const [toast, setToast] = useState<string>();

  const navigate = useCallback((next: Screen, replace = false) => { setScreen(next); history[replace ? "replaceState" : "pushState"]({}, "", routeFor[next]); }, []);
  useEffect(() => { const pop = () => setScreen(screenFromPath(location.pathname)); addEventListener("popstate", pop); return () => removeEventListener("popstate", pop); }, []);
  useEffect(() => { if (!location.pathname.startsWith("/billing/return")) return; setToast("Возвращаемся в мастер и проверяем оплату…"); try { const channel = new BroadcastChannel("tma-studio-payment"); channel.postMessage({ type: "payment-return" }); channel.close(); } catch { /* The launch modal still has a manual status check. */ } }, []);
  useEffect(() => { if ((screen !== "dashboard" && screen !== "builder") || !hasSession()) return; let active = true; void loadRemoteProject(project.id).catch(() => ensureRemoteProject(project)).then((remote) => { if (active) updateProject(remote); }).catch((reason) => { if (active) setToast(messageFrom(reason, "Не удалось восстановить проект")); }); return () => { active = false; }; }, []); // restore the cloud draft after a direct URL reload
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(undefined), 4000); return () => clearTimeout(timer); }, [toast]);

  const updateProject = useCallback((next: ProjectState) => { setProject(next); saveProject(next); }, []);

  async function start(nextIntent: StartIntent = {}) {
    setIntent(nextIntent);
    if (!hasSession()) { setAuthOpen(true); return; }
    if (nextIntent.templateId) { navigate("onboarding"); return; }
    await openWorkspace();
  }

  async function openWorkspace() {
    setBusy(true);
    try { const remote = await ensureRemoteProject(project); updateProject(remote); navigate("dashboard"); }
    catch (reason) { setToast(messageFrom(reason, "Не удалось открыть проект")); }
    finally { setBusy(false); }
  }

  async function afterAuth() {
    setAuthOpen(false); setBusy(true);
    try {
      const projects = await listRemoteProjects();
      if (resumeLaunch) { const remote = projects.some((item) => item.id === project.id) ? await saveRemoteProject(project) : await createRemoteProject(project); updateProject(remote); setResumeLaunch(false); setLaunchOpen(true); navigate("builder"); }
      else if (intent.templateId) navigate("onboarding");
      else if (projects.length === 0) navigate("onboarding");
      else { const remote = await loadRemoteProject(projects[0]!.id); updateProject(remote); navigate("dashboard"); }
    } catch (reason) { setToast(messageFrom(reason, "Не удалось загрузить кабинет")); }
    finally { setBusy(false); }
  }

  async function finishOnboarding(templateId: FlowTemplateId, name: string) {
    setBusy(true);
    // The bot is the product; the Mini App page is seeded to match and waits
    // until the owner adds it as the second product.
    const local = createProjectFromTemplate(pageTemplateForFlow[templateId], name);
    const scenario = createFlowFromTemplate(templateId, name);
    try {
      const next = hasSession() ? await createRemoteProject(local) : local;
      // The project is created with an empty scenario, so the chosen one has to
      // reach the server before the editor opens and loads from it.
      if (hasSession()) {
        const seeded = await loadRemoteFlow(next.id);
        await saveRemoteFlow(next.id, scenario, seeded.revision);
      }
      updateProject(next); setFlow(scenario); saveFlow(scenario);
      navigate("flow"); setToast("Бот собран — поменяйте тексты и проверьте его в чате");
    } catch (reason) { setToast(messageFrom(reason, "Не удалось создать бота")); }
    finally { setBusy(false); }
  }

  async function launch(current: ProjectState = project) {
    if (!hasSession()) { setResumeLaunch(true); setAuthOpen(true); return; }
    setBusy(true);
    try {
      const synced = await saveRemoteProject(current);
      const entitlement = await getEntitlement();
      const ready = { ...synced, plan: entitlement.planCode };
      updateProject(ready);
      if (ready.botUsername && ready.botStatus === "active" && entitlement.canPublish) {
        await publishProject(ready.id);
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

  return <>
    {screen === "landing" && <Landing onStart={(value) => void start(value)} />}
    {screen === "legal" && <LegalPage kind={location.pathname === "/terms" ? "terms" : "privacy"} onBack={() => navigate("landing")} />}
    {screen === "onboarding" && <Onboarding initialTemplate={intent.templateId} pending={busy} onBack={() => navigate("landing")} onCreate={(templateId, name) => void finishOnboarding(templateId, name)} />}
    {screen === "dashboard" && <Dashboard project={project} onProjectChange={updateProject} onEdit={() => navigate("builder")} onEditFlow={() => navigate("flow")} onPreview={() => preview()} onLaunch={() => void launch()} onHome={() => navigate("landing")} onNewProject={() => navigate("onboarding")} onOpenProject={async (id) => { setBusy(true); try { updateProject(await loadRemoteProject(id)); } catch (reason) { setToast(messageFrom(reason, "Не удалось открыть проект")); } finally { setBusy(false); } }} onMessage={setToast} />}
    {screen === "flow" && <FlowEditor flow={flow} projectId={project.id} onChange={(next) => { setFlow(next); saveFlow(next); }} onBack={() => navigate("dashboard")} onLaunch={() => void launch()} onMessage={setToast} />}
    {screen === "builder" && <Builder initialProject={project} onChange={updateProject} onBack={() => navigate("dashboard")} onPreview={(current) => preview(current)} onLaunch={(current) => void launch(current)} onMessage={setToast} />}
    {authOpen && <AuthModal initialMode={intent.mode ?? "register"} onClose={() => setAuthOpen(false)} onAuthenticated={afterAuth} onDemo={() => { setAuthOpen(false); navigate("onboarding"); }} />}
    {launchOpen && <LaunchModal projectId={project.id} initialPlan={project.plan === "trio" ? "trio" : intent.plan} existingBot={project.botUsername && project.botStatus === "active" ? { username: project.botUsername, miniAppUrl: project.miniAppUrl } : undefined} onClose={() => setLaunchOpen(false)} onLaunched={(result) => { updateProject({ ...project, status: "active", plan: result.plan, botUsername: result.botUsername, miniAppUrl: result.miniAppUrl, botStatus: "active", previewed: true, hasPendingChanges: false }); setToast("Бот опубликован и готов принимать клиентов"); }} />}
    {previewOpen && <PreviewModal project={project} onClose={() => setPreviewOpen(false)} />}
    {busy && <div className="global-busy" role="status">Сохраняем…</div>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </>;
}
function messageFrom(reason: unknown, fallback: string) { return reason instanceof Error ? reason.message : fallback; }
