import { ArrowRight, Bot, CheckCircle2, ChevronRight, Circle, Eye, FileText, GitBranch, Globe, HelpCircle, LayoutDashboard, LogOut, MessageSquare, MoreHorizontal, Paintbrush, Plus, Rocket, Settings, Smartphone, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchLeads, getCurrentUser, hasSession, listRemoteProjects, logout, renameRemoteProject, updateRemoteProjectKit } from "../api";
import type { DashboardSection, Lead, ProjectState } from "../types";
import { PhonePreview } from "./PhonePreview";
import { kitName, priceForKit } from "../pricing";
import type { ProductKit } from "../types";
import { BILLING_PLANS } from "../../../../src/billing/plans";
import "../mobile-workspace.css";

interface Props { project: ProjectState; onProjectChange: (project: ProjectState) => void; onEdit: () => void; onEditFlow: () => void; onPreview: () => void; onLaunch: () => void; onReconnect: () => void; onHome: () => void; onNewProject: () => void; onOpenProject: (id: string) => Promise<void>; onGuide: () => void; onMessage: (message: string) => void }
const nav: Array<{ id: DashboardSection; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "Главная", icon: LayoutDashboard }, { id: "flow", label: "Сценарий", icon: GitBranch }, { id: "bot", label: "Бот", icon: MessageSquare }, { id: "leads", label: "Заявки", icon: Users }, { id: "design", label: "Mini App", icon: Smartphone }, { id: "settings", label: "Настройки", icon: Settings }, { id: "help", label: "Помощь", icon: HelpCircle },
];

/** The kit chosen on the start screen decides which sections exist at all. */
function sectionsFor(kit: ProjectState["kit"]): typeof nav {
  if (kit === "site") return nav.filter((item) => item.id !== "flow" && item.id !== "bot" && item.id !== "design");
  if (kit === "bot") return nav.filter((item) => item.id !== "design");
  return nav;
}

/** The published page document is also served as a public site. */
function siteUrlOf(miniAppUrl: string): string { return miniAppUrl.replace("/app/", "/s/"); }

export function Dashboard(props: Props) {
  const { project, onProjectChange, onEdit, onEditFlow, onPreview, onLaunch, onReconnect, onHome, onNewProject, onOpenProject, onGuide, onMessage } = props;
  const [section, setSection] = useState<DashboardSection>("overview");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: string; name: string; status?: ProjectState["status"] }>>([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const mobileMenu = useRef<HTMLDialogElement>(null);
  const mobileMenuTrigger = useRef<HTMLButtonElement>(null);
  const [name, setName] = useState(project.name);
  const [format, setFormat] = useState<ProductKit>(project.kit ?? "bot");
  const [formatPending, setFormatPending] = useState(false);
  useEffect(() => { setFormat(project.kit ?? "bot"); }, [project.id, project.kit]);
  async function changeFormat() {
    if (project.status === "active" && !confirm("Изменится формат публикации. Прежние публичные ссылки могут стать недоступны. После изменения обновите подключение Telegram в мастере запуска. Продолжить?")) return;
    setFormatPending(true);
    try { if (hasSession()) await updateRemoteProjectKit(project.id, format); onProjectChange({ ...project, kit: format, legacyFullAccessUntil: undefined }); onMessage("Формат сохранён. Перед запуском проверьте тариф и обновите подключение Telegram."); }
    catch (reason) { onMessage(reason instanceof Error ? reason.message : "Не удалось изменить формат"); }
    finally { setFormatPending(false); }
  }
  const user = getCurrentUser();
  const page = project.pages.find((item) => item.id === project.activePageId) ?? project.pages[0];
  const hasForm = project.pages.some((item) => item.blocks.some((block) => block.type === "form"));
  const hasPaidAccess = project.status === "active" && project.plan !== "free";
  const botConnected = project.botStatus === "active";
  const connectionNeedsAttention = hasPaidAccess && !botConnected;
  const isLive = hasPaidAccess && botConnected;
  const hasPendingChanges = hasPaidAccess && Boolean(project.hasPendingChanges);
  const progress = [true, project.pages.some((item) => item.blocks.length >= 2), Boolean(project.previewed), botConnected, isLive];
  const completed = progress.filter(Boolean).length;
  const activeBots = projects.filter((item) => item.status === "active").length || (isLive ? 1 : 0);
  const statusLabel = connectionNeedsAttention ? "Переподключите Telegram-бота" : hasPendingChanges ? "Есть неопубликованные изменения" : isLive ? "Опубликован" : project.status === "active" ? "Требует продления" : project.pages.some((item) => item.blocks.length > 0) ? "Готовится к запуску" : "Пустой черновик";
  const primaryAction = isLive && !hasPendingChanges ? onPreview : onLaunch;
  const primaryLabel = connectionNeedsAttention ? "Переподключить" : isLive ? hasPendingChanges ? "Опубликовать" : "Проверить приложение" : project.status === "active" ? "Продлить" : "Запустить";

  useEffect(() => { setName(project.name); if (!hasSession()) { setProjects([{ id: project.id, name: project.name }]); return; } void listRemoteProjects().then(setProjects).catch(() => undefined); }, [project.id, project.name]);
  useEffect(() => {
    if (section !== "leads") return;
    if (!hasSession()) { setLeads([]); return; }
    setLoadingLeads(true); void fetchLeads(project.id).then(setLeads).catch((reason) => onMessage(reason instanceof Error ? reason.message : "Не удалось загрузить заявки")).finally(() => setLoadingLeads(false));
  }, [section, project.id, onMessage]);

  const title = useMemo(() => nav.find((item) => item.id === section)?.label ?? "Главная", [section]);
  function openSection(next: DashboardSection) { mobileMenu.current?.close(); if (next === "flow") { onEditFlow(); return; } if (next === "design") { onEdit(); return; } setSection(next); window.scrollTo(0, 0); }
  const openEditor = project.kit === "site" ? onEdit : onEditFlow;

  return <div className="workspace"><aside className="app-sidebar">
    <button className="brand bare" onClick={onHome}><span className="brand-mark"><Bot size={19} /></span>KIRA</button>
    <div className="project-picker"><select name="desktop-project" value={project.id} aria-label="Текущий проект" onChange={(event) => void onOpenProject(event.target.value)}>{projects.length === 0 && <option value={project.id}>{project.name}</option>}{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button onClick={onNewProject} aria-label="Создать проект"><Plus /></button></div>
    <nav>{sectionsFor(project.kit).map(({ id, label, icon: Icon }) => <button key={id} className={section === id ? "active" : ""} onClick={() => openSection(id)}><Icon />{label}</button>)}</nav>
    <div className="sidebar-plan"><span>{project.plan === "free" ? "Бесплатный конструктор" : `Тариф: ${BILLING_PLANS[project.plan].name}`}</span><small>{project.plan === "free" ? `${projects.length || 1} ${projects.length === 1 ? "проект" : "проекта"}` : `Активные боты: ${activeBots} из ${project.plan === "trio" ? 3 : 1}`}</small><button onClick={primaryAction}>{connectionNeedsAttention ? "Переподключить бота" : isLive ? hasPendingChanges ? "Опубликовать изменения" : "Открыть preview" : project.status === "active" ? "Продлить доступ" : `Запустить за ${priceForKit(project.kit ?? "bot")} ₽`}</button></div>
    <button className="profile" onClick={() => setProfileOpen((value) => !value)}><span>{user?.displayName?.slice(0, 1).toUpperCase() ?? "Д"}</span><div><b>{user?.displayName ?? "Демо"}</b><small>{user?.email ?? "данные на этом устройстве"}</small></div><ChevronRight /></button>
    {profileOpen && <div className="profile-menu"><button onClick={() => { logout(); onHome(); }}><LogOut />Выйти</button></div>}
  </aside>
  <div className="mobile-workspace-bar">
    <label><span className="project-dot">{project.name.slice(0, 1).toUpperCase()}</span><select name="mobile-project" value={project.id} aria-label="Текущий проект" onChange={(event) => void onOpenProject(event.target.value)}>{projects.length === 0 && <option value={project.id}>{project.name}</option>}{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <button onClick={onNewProject} aria-label="Создать проект"><Plus /><span>Новый</span></button>
  </div>
  <main className="dashboard"><header><div><span className="muted">{project.name} /</span><h1>{title}</h1></div>{section !== "settings" && <button className="primary-button" onClick={primaryAction}>{isLive && !hasPendingChanges ? <Eye /> : <Rocket />}{primaryLabel}</button>}</header>
    {section === "overview" && <Overview project={project} page={page} onEditFlow={openEditor} completed={completed} progress={progress} statusLabel={statusLabel} hasForm={hasForm} onEdit={onEdit} onPreview={onPreview} onLaunch={onLaunch} onHelp={() => setSection("help")} />}
    {section === "bot" && <SimplePanel icon={<Bot />} title={botConnected && project.botUsername ? `@${project.botUsername} подключён` : connectionNeedsAttention ? "Telegram-бот требует переподключения" : "Бот ещё не подключён"} text={botConnected ? project.kit === "bot" ? "Текстовый сценарий работает в чате. Mini App в этом формате не публикуется." : "Кнопка меню ведёт в актуальную опубликованную версию Mini App." : connectionNeedsAttention ? "Подключение Telegram не завершено или было отозвано. Вставьте актуальный токен — мастер безопасно восстановит Menu Button и webhook." : "Создайте бота через @BotFather. Мастер проверит токен, зашифрует его и настроит Menu Button автоматически."} action={connectionNeedsAttention ? "Переподключить бота" : project.botUsername ? !isLive ? "Продлить доступ" : hasPendingChanges ? "Опубликовать изменения" : "Открыть бота в Telegram" : "Подключить бота"} onAction={project.botUsername && isLive && !hasPendingChanges ? () => window.open(`https://t.me/${project.botUsername}`, "_blank", "noopener,noreferrer") : onLaunch}><button className="outline-button" onClick={onEditFlow}>Собрать сценарий бота</button><button className="outline-button" onClick={onReconnect}>Обновить подключение</button>{project.miniAppUrl && <a className="outline-button" href={project.miniAppUrl} target="_blank" rel="noreferrer">Проверить Mini App в браузере</a>}{project.miniAppUrl && project.kit !== "bot-app" && <a className="outline-button" href={siteUrlOf(project.miniAppUrl)} target="_blank" rel="noreferrer"><Globe />Открыть сайт</a>}</SimplePanel>}
    {section === "leads" && <LeadsPanel leads={leads} loading={loadingLeads} onTest={onPreview} />}
    {section === "settings" && <section className="panel settings-panel"><span>ПРОЕКТ</span><h2>Настройки проекта</h2><label><span>Название</span><input name="project-name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} /></label><button className="primary-button" disabled={name.trim().length === 0 || name === project.name} onClick={() => { const nextName = name.trim(); if (!hasSession()) { onProjectChange({ ...project, name: nextName }); onMessage("Название сохранено на этом устройстве"); return; } void renameRemoteProject(project.id, nextName).then(() => { onProjectChange({ ...project, name: nextName }); onMessage("Название проекта сохранено"); }).catch((reason) => onMessage(reason instanceof Error ? reason.message : "Не удалось сохранить")); }}>Сохранить</button><label><span>Формат публикации</span><select value={format} onChange={(event) => setFormat(event.target.value as ProductKit)}>{(Object.keys(kitName) as ProductKit[]).map((kit) => <option key={kit} value={kit}>{kitName[kit]}</option>)}</select></label><p className="muted">Редактировать можно бесплатно. Mini App публикуется на тарифе «Студия»: 650 ₽ за один проект. Смена формата не удаляет страницы или сценарий.</p><button className="outline-button" disabled={format === project.kit || formatPending} onClick={() => void changeFormat()}>{formatPending ? "Сохраняем…" : "Сохранить формат"}</button><div className="settings-meta"><span>Статус: <b>{statusLabel}</b></span><span>Страниц: <b>{project.pages.length}</b></span></div></section>}
    {section === "help" && <section className="panel help-center"><span>БЫСТРЫЙ СТАРТ</span><h2>Запуск без технических настроек</h2><ol><li><b>Не поняли, из чего состоит проект?</b><p>Бот, Mini App и сайт — три части одного проекта. Короткая инструкция объясняет, как они связаны.</p><button onClick={onGuide}>Открыть инструкцию <ArrowRight /></button></li><li><b>Выберите сценарий и замените тексты.</b><p>Добавляйте блоки слева, меняйте их свойства справа.</p><button onClick={onEdit}>Открыть редактор <ArrowRight /></button></li><li><b>Проверьте путь клиента.</b><p>Кнопки, переходы и формы работают в интерактивном preview.</p><button onClick={onPreview}>Открыть preview <ArrowRight /></button></li><li><b>Подключите Telegram-бота.</b><p>Понадобится токен от @BotFather. Он хранится только в зашифрованном виде.</p><button onClick={onLaunch}>Открыть мастер запуска <ArrowRight /></button></li></ol><a href="mailto:support@tmastudio.ru">Написать в поддержку</a></section>}
  </main>
  <nav className="mobile-nav" aria-label="Разделы проекта">
    <button className={section === "overview" ? "active" : ""} aria-current={section === "overview" ? "page" : undefined} onClick={() => openSection("overview")}><LayoutDashboard /><span>Главная</span></button>
    <button onClick={openEditor}>{project.kit === "site" ? <Globe /> : <GitBranch />}<span>Редактор</span></button>
    <button className={section === "leads" ? "active" : ""} aria-current={section === "leads" ? "page" : undefined} onClick={() => openSection("leads")}><Users /><span>Заявки</span></button>
    <button ref={mobileMenuTrigger} className={["settings", "help", "bot"].includes(section) ? "active" : ""} aria-haspopup="dialog" onClick={() => mobileMenu.current?.showModal()}><MoreHorizontal /><span>Ещё</span></button>
  </nav>
  {/* Native modal focus management keeps the sheet usable in Safari and with a keyboard. */}
  <dialog ref={mobileMenu} className="mobile-workspace-menu" aria-labelledby="workspace-menu-title" onClose={() => mobileMenuTrigger.current?.focus({ preventScroll: true })} onClick={(event) => { if (event.target === event.currentTarget) mobileMenu.current?.close(); }}>
    <div className="mobile-workspace-menu-content">
      <header><div><h2 id="workspace-menu-title">Ваш проект</h2><p>{project.name}</p></div><button className="icon-button" aria-label="Закрыть меню проекта" onClick={() => mobileMenu.current?.close()}><X /></button></header>
      <nav aria-label="Все разделы проекта">{sectionsFor(project.kit).map(({ id, label, icon: Icon }) => <button key={id} onClick={() => openSection(id)}><Icon /><span>{label}</span><ChevronRight /></button>)}</nav>
      <button onClick={() => { mobileMenu.current?.close(); onNewProject(); }}><Plus /><span>Проекты и конструкторы</span><ArrowRight /></button>
      <button className="workspace-signout" onClick={() => { mobileMenu.current?.close(); logout(); onHome(); }}><LogOut /><span>Выйти из аккаунта</span></button>
    </div>
  </dialog>
  </div>;
}

function Overview({ project, page, completed, progress, statusLabel, hasForm, onEdit, onEditFlow, onPreview, onLaunch, onHelp }: { project: ProjectState; page?: ProjectState["pages"][number]; completed: number; progress: boolean[]; statusLabel: string; hasForm: boolean; onEdit: () => void; onEditFlow: () => void; onPreview: () => void; onLaunch: () => void; onHelp: () => void }) {
  const percent = completed * 20;
  const isPublished = statusLabel === "Опубликован";
  const hasChanges = statusLabel === "Есть неопубликованные изменения";
  const needsReconnect = statusLabel === "Переподключите Telegram-бота";
  const statusClass = isPublished ? "published" : needsReconnect ? "connection-error" : statusLabel === "Требует продления" ? "expired" : hasChanges ? "pending" : "draft";
  return <><div className={`status-banner ${statusClass}`}><div className="status-icon"><CheckCircle2 /></div><div><b>{statusLabel}</b><p>{isPublished ? "Приложение работает. Изменения можно внести в любое время." : needsReconnect ? "Публичная версия сохранена, но Telegram-подключение нужно восстановить актуальным токеном бота." : hasChanges ? "Черновик сохранён. Опубликуйте новую версию, когда будете готовы показать её клиентам." : statusLabel === "Требует продления" ? "Оплаченный период закончился. Черновик сохранён, возобновите тариф для публичного доступа." : `Готово ${completed} из 5 шагов. Следующий шаг отмечен в чек-листе.`}</p></div><button onClick={needsReconnect || hasChanges ? onLaunch : isPublished ? onPreview : onEditFlow}>{needsReconnect ? "Переподключить" : hasChanges ? "Опубликовать" : isPublished ? "Проверить" : "Продолжить"}<ArrowRight /></button></div>
  <section className="dashboard-grid"><div className="panel checklist"><div className="panel-title"><div><span>ГОТОВНОСТЬ К ЗАПУСКУ</span><h2>{completed} из 5 шагов</h2></div><div className="progress-ring" style={{ background: `conic-gradient(var(--green) ${percent}%, #e7eadf 0)` }}>{percent}%</div></div><div className="progress-line"><i style={{ width: `${percent}%` }} /></div><Task done={progress[0]} title="Проект создан" text="Название и главная страница готовы" /><Task done={progress[1]} title={project.kit === "site" ? "Страница собрана" : "Сценарий бота собран"} text={project.kit === "site" ? "Тексты, изображения и формы" : "Сообщения, кнопки и вопросы на холсте"} action="Редактор" onClick={onEditFlow} /><Task done={progress[2]} title="Предпросмотр" text="Проверьте кнопки и форму как клиент" action="Проверить" onClick={onPreview} /><Task done={progress[3]} title="Telegram-бот подключён" text="Понадобится токен от @BotFather" action={progress[3] ? undefined : "Подключить"} onClick={onLaunch} /><Task done={progress[4]} title="Оплачено и опубликовано" text="Хостинг включится после запуска" action={progress[4] ? undefined : "Запустить"} onClick={onLaunch} /></div>
  <div className="right-column"><div className="panel preview-card"><div className="panel-title"><div><span>ВАШЕ ПРИЛОЖЕНИЕ</span><h2>{page?.title ?? "Главная"}</h2></div><span className={`draft-pill ${isPublished ? "live" : hasChanges ? "pending" : ""}`}>{isPublished ? "Опубликовано" : hasChanges ? "Новая версия" : "Черновик"}</span></div><div className="dashboard-phone">{page && <PhonePreview page={page} projectName={project.name} selectedId={undefined} onSelect={() => undefined} />}</div><div className="preview-actions"><button className="outline-button" onClick={onPreview}><Eye />Предпросмотр</button><button className="outline-button" onClick={onEdit}>Редактировать</button></div></div><div className="panel help-card"><span className="help-avatar">✦</span><div><b>{hasForm ? "Форма готова принимать заявки" : "Добавьте форму заявки"}</b><p>{hasForm ? "После запуска новые обращения появятся в разделе «Заявки»." : "Форма поможет превратить просмотр приложения в обращение клиента."}</p><button onClick={hasForm ? onHelp : onEdit}>{hasForm ? "Как проверить запуск" : "Добавить форму"}</button></div></div></div></section></>;
}
function Task({ done, title, text, action, onClick }: { done: boolean; title: string; text: string; action?: string; onClick?: () => void }) { return <div className={`task ${done ? "done" : ""}`}>{done ? <CheckCircle2 /> : <Circle />}<div><b>{title}</b><p>{text}</p></div>{action && <button onClick={onClick}>{action}<ChevronRight /></button>}</div>; }
function SimplePanel({ icon, title, text, action, onAction, children }: { icon: React.ReactNode; title: string; text: string; action: string; onAction: () => void; children?: React.ReactNode }) { return <section className="panel empty-section"><span>{icon}</span><h2>{title}</h2><p>{text}</p><div><button className="primary-button" onClick={onAction}>{action}</button>{children}</div></section>; }
function LeadsPanel({ leads, loading, onTest }: { leads: Lead[]; loading: boolean; onTest: () => void }) { if (loading) return <section className="panel empty-section"><h2>Загружаем заявки…</h2></section>; if (leads.length === 0) return <SimplePanel icon={<Users />} title="Заявок пока нет" text="После запуска отправьте тестовую заявку — она появится здесь с контактами клиента." action="Открыть preview" onAction={onTest} />; return <section className="panel leads-panel"><div className="panel-title"><div><span>ВХОДЯЩИЕ</span><h2>{leads.length} заявок</h2></div><button className="outline-button" onClick={() => downloadCsv(leads)}>Скачать CSV</button></div><div className="lead-list">{leads.map((lead) => <article key={lead.id}><div><b>{Object.values(lead.values).find((value) => typeof value === "string") || "Новая заявка"}</b><span>{lead.pageTitle} · {new Date(lead.createdAt).toLocaleString("ru-RU")}</span></div><dl>{Object.entries(lead.values).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl></article>)}</div></section>; }
function downloadCsv(leads: Lead[]) { const keys = [...new Set(leads.flatMap((lead) => Object.keys(lead.values)))]; const rows = [["date", "page", ...keys], ...leads.map((lead) => [lead.createdAt, lead.pageTitle, ...keys.map((key) => String(lead.values[key] ?? ""))])]; const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n"); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv" })); link.download = "tma-studio-leads.csv"; link.click(); URL.revokeObjectURL(link.href); }
