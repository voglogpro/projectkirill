import { useCallback, useState } from "react";
import { ensureRemoteProject, hasSession, saveRemotePage } from "./api";
import { AuthModal } from "./components/AuthModal";
import { Builder } from "./components/Builder";
import { Dashboard } from "./components/Dashboard";
import { Landing } from "./components/Landing";
import { LaunchModal } from "./components/LaunchModal";
import { loadProject } from "./store";
import type { ProjectState } from "./types";

type Screen = "landing" | "dashboard" | "builder";

export function App() {
  const [screen, setScreen] = useState<Screen>(() => location.pathname.startsWith("/builder") ? "builder" : location.pathname.startsWith("/app") ? "dashboard" : "landing");
  const [project, setProject] = useState<ProjectState>(loadProject);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const navigate = useCallback((next: Screen) => { setScreen(next); history.pushState({}, "", next === "landing" ? "/" : next === "dashboard" ? "/app" : "/builder"); }, []);
  const updateProject = useCallback((next: ProjectState) => setProject(next), []);
  const start = () => { if (hasSession()) navigate("dashboard"); else setAuthOpen(true); };
  const launch = async (current: ProjectState = project) => {
    if (!hasSession()) { setAuthOpen(true); return; }
    const synced = await saveRemotePage(current);
    setProject(synced);
    setLaunchOpen(true);
  };
  return <>{screen === "landing" && <Landing onStart={start} />}{screen === "dashboard" && <Dashboard project={project} onEdit={() => navigate("builder")} onLaunch={() => void launch()} onHome={() => navigate("landing")} />}{screen === "builder" && <Builder initialProject={project} onChange={updateProject} onBack={() => navigate("dashboard")} onLaunch={(current) => void launch(current)} />}{authOpen && <AuthModal onClose={() => setAuthOpen(false)} onAuthenticated={async () => { const remote = await ensureRemoteProject(project); setProject(remote); setAuthOpen(false); navigate("dashboard"); }} onDemo={() => { setAuthOpen(false); navigate("dashboard"); }} />}{launchOpen && <LaunchModal projectId={project.id} onClose={() => setLaunchOpen(false)} />}</>;
}
