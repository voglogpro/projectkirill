import { ArrowRight, Bot, ChevronRight, GitBranch, Globe, HelpCircle, LayoutDashboard, LogOut, MessageSquare, MoreHorizontal, Plus, Settings, Smartphone, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getCurrentUser, hasSession, listRemoteProjects, logout } from "../api";
import { priceForKit } from "../pricing";
import type { DashboardSection, ProjectState } from "../types";
import { BILLING_PLANS } from "../../../../src/billing/plans";
import "../mobile-workspace.css";
import "../workspace-shell.css";

const nav: Array<{ id: DashboardSection; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "Главная", icon: LayoutDashboard },
  { id: "flow", label: "Сценарий", icon: GitBranch },
  { id: "design", label: "Mini App", icon: Smartphone },
  { id: "bot", label: "Бот", icon: MessageSquare },
  { id: "leads", label: "Заявки", icon: Users },
  { id: "settings", label: "Настройки", icon: Settings },
  { id: "help", label: "Помощь", icon: HelpCircle },
];

/** The kit chosen on the start screen decides which sections exist at all. */
export function sectionsFor(kit: ProjectState["kit"]): typeof nav {
  if (kit === "site") return nav.filter((item) => item.id !== "flow" && item.id !== "bot").map((item) => item.id === "design" ? { ...item, label: "Сайт", icon: Globe } : item);
  if (kit === "bot") return nav.filter((item) => item.id !== "design");
  return nav;
}

interface Props {
  project: ProjectState;
  /** Which sidebar entry is lit — a cabinet panel, or the editor opened beside it. */
  active: DashboardSection;
  /** True while a constructor fills the work area: the phone hands its bar to the editor. */
  editing?: boolean;
  onSelect: (section: DashboardSection) => void;
  onNewProject: () => void;
  onOpenProject: (id: string) => Promise<void> | void;
  onHome: () => void;
  onPrimary: () => void;
  primaryLabel: string;
  children: React.ReactNode;
}

/**
 * One frame around the whole cabinet. The editors render inside it, so the
 * project's own navigation never disappears when a constructor opens.
 */
export function WorkspaceShell({ project, active, editing = false, onSelect, onNewProject, onOpenProject, onHome, onPrimary, primaryLabel, children }: Props) {
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const menu = useRef<HTMLDialogElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const user = getCurrentUser();
  const sections = sectionsFor(project.kit);

  useEffect(() => {
    if (!hasSession()) { setProjects([{ id: project.id, name: project.name }]); return; }
    void listRemoteProjects().then((items) => setProjects(items.map((item) => ({ id: item.id, name: item.name })))).catch(() => undefined);
  }, [project.id, project.name]);

  function pick(section: DashboardSection) { menu.current?.close(); onSelect(section); }
  const editorSection: DashboardSection = project.kit === "site" ? "design" : "flow";
  const quick = sections.filter((item) => ["overview", editorSection, "leads"].includes(item.id)).slice(0, 3);

  return <div className={`workspace ${editing ? "is-editing" : ""}`}>
    <aside className="app-sidebar">
      <button className="brand bare" onClick={onHome}><span className="brand-mark"><Bot size={19} /></span>KIRA</button>
      <div className="project-picker">
        <select name="desktop-project" value={project.id} aria-label="Текущий проект" onChange={(event) => void onOpenProject(event.target.value)}>
          {projects.length === 0 && <option value={project.id}>{project.name}</option>}
          {projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <button onClick={onNewProject} aria-label="Создать проект"><Plus /></button>
      </div>
      <nav>{sections.map(({ id, label, icon: Icon }) => <button key={id} className={active === id ? "active" : ""} aria-current={active === id ? "page" : undefined} onClick={() => pick(id)}><Icon />{label}</button>)}</nav>
      <div className="sidebar-plan">
        <span>{project.plan === "free" ? "Бесплатный конструктор" : `Тариф: ${BILLING_PLANS[project.plan].name}`}</span>
        <small>{project.plan === "free" ? "Публикация после оплаты" : `Проект: ${project.name}`}</small>
        <button onClick={onPrimary}>{project.plan === "free" ? `Запустить за ${priceForKit(project.kit ?? "bot")} ₽` : primaryLabel}</button>
      </div>
      <button className="profile" onClick={() => setProfileOpen((value) => !value)}><span>{user?.displayName?.slice(0, 1).toUpperCase() ?? "Д"}</span><div><b>{user?.displayName ?? "Демо"}</b><small>{user?.email ?? "данные на этом устройстве"}</small></div><ChevronRight /></button>
      {profileOpen && <div className="profile-menu"><button onClick={() => { logout(); onHome(); }}><LogOut />Выйти</button></div>}
    </aside>

    <div className="mobile-workspace-bar">
      <label><span className="project-dot">{project.name.slice(0, 1).toUpperCase()}</span><select name="mobile-project" value={project.id} aria-label="Текущий проект" onChange={(event) => void onOpenProject(event.target.value)}>{projects.length === 0 && <option value={project.id}>{project.name}</option>}{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <button onClick={onNewProject} aria-label="Создать проект"><Plus /><span>Новый</span></button>
    </div>

    <div className="workspace-main">{children}</div>

    {/* While a constructor is open the phone's bottom row belongs to its tools. */}
    <nav className="mobile-nav" aria-label="Разделы проекта">
      {quick.map(({ id, label, icon: Icon }) => <button key={id} className={active === id ? "active" : ""} aria-current={active === id ? "page" : undefined} onClick={() => pick(id)}><Icon /><span>{label}</span></button>)}
      <button ref={menuTrigger} className={quick.every((item) => item.id !== active) ? "active" : ""} aria-haspopup="dialog" onClick={() => menu.current?.showModal()}><MoreHorizontal /><span>Ещё</span></button>
    </nav>

    <dialog ref={menu} className="mobile-workspace-menu" aria-labelledby="workspace-menu-title" onClose={() => menuTrigger.current?.focus({ preventScroll: true })} onClick={(event) => { if (event.target === event.currentTarget) menu.current?.close(); }}>
      <div className="mobile-workspace-menu-content">
        <header><div><h2 id="workspace-menu-title">Ваш проект</h2><p>{project.name}</p></div><button className="icon-button" aria-label="Закрыть меню проекта" onClick={() => menu.current?.close()}><X /></button></header>
        <nav aria-label="Все разделы проекта">{sections.map(({ id, label, icon: Icon }) => <button key={id} className={active === id ? "active" : ""} onClick={() => pick(id)}><Icon /><span>{label}</span><ChevronRight /></button>)}</nav>
        <button onClick={() => { menu.current?.close(); onNewProject(); }}><Plus /><span>Проекты и конструкторы</span><ArrowRight /></button>
        <button className="workspace-signout" onClick={() => { menu.current?.close(); logout(); onHome(); }}><LogOut /><span>Выйти из аккаунта</span></button>
      </div>
    </dialog>
  </div>;
}
