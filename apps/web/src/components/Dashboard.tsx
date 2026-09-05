import { ArrowRight, Bot, CheckCircle2, ChevronRight, Circle, Eye, GitBranch, Globe, Inbox, Rocket, Smartphone, TriangleAlert, Users, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchLeads, hasSession, renameRemoteProject, updateRemoteProjectKit } from "../api";
import type { DashboardSection, Lead, ProductKit, ProjectState } from "../types";
import { PhonePreview } from "./PhonePreview";
import { kitName } from "../pricing";
import "../workspace-crm.css";

interface Props {
  project: ProjectState;
  section: DashboardSection;
  onSelect: (section: DashboardSection) => void;
  onProjectChange: (project: ProjectState) => void;
  onEdit: () => void;
  onEditFlow: () => void;
  onPreview: () => void;
  onLaunch: () => void;
  onReconnect: () => void;
  onGuide: () => void;
  onMessage: (message: string) => void;
}

/** The published page document is also served as a public site. */
function siteUrlOf(miniAppUrl: string): string { return miniAppUrl.replace("/app/", "/s/"); }

export function Dashboard(props: Props) {
  const { project, section, onSelect, onProjectChange, onEdit, onEditFlow, onPreview, onLaunch, onReconnect, onGuide, onMessage } = props;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [name, setName] = useState(project.name);
  const [format, setFormat] = useState<ProductKit>(project.kit ?? "bot");
  const [formatPending, setFormatPending] = useState(false);
  useEffect(() => { setFormat(project.kit ?? "bot"); setName(project.name); }, [project.id, project.kit, project.name]);

  // The inbox is the cabinet's headline number, so it loads for the overview too.
  useEffect(() => {
    if (section !== "leads" && section !== "overview") return;
    if (!hasSession()) { setLeads([]); return; }
    setLoadingLeads(true);
    void fetchLeads(project.id).then(setLeads).catch(() => undefined).finally(() => setLoadingLeads(false));
  }, [section, project.id]);

  async function changeFormat() {
    if (project.status === "active" && !confirm("Изменится формат публикации. Прежние публичные ссылки могут стать недоступны. После изменения обновите подключение Telegram в мастере запуска. Продолжить?")) return;
    setFormatPending(true);
    try { if (hasSession()) await updateRemoteProjectKit(project.id, format); onProjectChange({ ...project, kit: format, legacyFullAccessUntil: undefined }); onMessage("Формат сохранён. Перед запуском проверьте тариф и обновите подключение Telegram."); }
    catch (reason) { onMessage(reason instanceof Error ? reason.message : "Не удалось изменить формат"); }
    finally { setFormatPending(false); }
  }

  const page = project.pages.find((item) => item.id === project.activePageId) ?? project.pages[0];
  const hasForm = project.pages.some((item) => item.blocks.some((block) => block.type === "form"));
  const hasPaidAccess = project.status === "active" && project.plan !== "free";
  const botConnected = project.botStatus === "active";
  const connectionNeedsAttention = hasPaidAccess && !botConnected;
  const isLive = hasPaidAccess && botConnected;
  const hasPendingChanges = hasPaidAccess && Boolean(project.hasPendingChanges);
  const isSite = project.kit === "site";
  const built = isSite ? project.pages.some((item) => item.blocks.length >= 2) : project.pages.some((item) => item.blocks.length >= 1);
  const steps = [true, built, Boolean(project.previewed), botConnected, isLive];
  const completed = steps.filter(Boolean).length;
  const statusLabel = connectionNeedsAttention ? "Переподключите Telegram-бота" : hasPendingChanges ? "Есть неопубликованные изменения" : isLive ? "Опубликован" : project.status === "active" ? "Требует продления" : built ? "Готовится к запуску" : "Пустой черновик";
  const openEditor = isSite ? onEdit : onEditFlow;

  return <main className="dashboard">
    {section === "overview" && <Overview
      project={project} page={page} leads={leads} loadingLeads={loadingLeads} completed={completed} steps={steps}
      statusLabel={statusLabel} isLive={isLive} hasPendingChanges={hasPendingChanges} connectionNeedsAttention={connectionNeedsAttention}
      hasForm={hasForm} isSite={isSite}
      onEditor={openEditor} onEdit={onEdit} onPreview={onPreview} onLaunch={onLaunch} onSelect={onSelect} onGuide={onGuide}
    />}

    {section === "bot" && <BotPanel project={project} isLive={isLive} botConnected={botConnected} hasPendingChanges={hasPendingChanges} connectionNeedsAttention={connectionNeedsAttention} onLaunch={onLaunch} onReconnect={onReconnect} onEditFlow={onEditFlow} />}

    {section === "leads" && <LeadsPanel leads={leads} loading={loadingLeads} onTest={onPreview} />}

    {section === "settings" && <section className="panel settings-panel">
      <span>ПРОЕКТ</span><h2>Настройки проекта</h2>
      <label><span>Название</span><input name="project-name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} /></label>
      <button className="primary-button" disabled={name.trim().length === 0 || name === project.name} onClick={() => {
        const nextName = name.trim();
        if (!hasSession()) { onProjectChange({ ...project, name: nextName }); onMessage("Название сохранено на этом устройстве"); return; }
        void renameRemoteProject(project.id, nextName).then(() => { onProjectChange({ ...project, name: nextName }); onMessage("Название проекта сохранено"); }).catch((reason) => onMessage(reason instanceof Error ? reason.message : "Не удалось сохранить"));
      }}>Сохранить</button>
      <label><span>Формат публикации</span><select value={format} onChange={(event) => setFormat(event.target.value as ProductKit)}>{(Object.keys(kitName) as ProductKit[]).map((kit) => <option key={kit} value={kit}>{kitName[kit]}</option>)}</select></label>
      <p className="muted">Редактировать можно бесплатно. Mini App публикуется на тарифе «Студия»: 650 ₽ за один проект. Смена формата не удаляет страницы или сценарий.</p>
      <button className="outline-button" disabled={format === project.kit || formatPending} onClick={() => void changeFormat()}>{formatPending ? "Сохраняем…" : "Сохранить формат"}</button>
      <div className="settings-meta"><span>Статус: <b>{statusLabel}</b></span><span>Страниц: <b>{project.pages.length}</b></span></div>
    </section>}

    {section === "help" && <section className="panel help-center">
      <span>БЫСТРЫЙ СТАРТ</span><h2>Запуск без технических настроек</h2>
      <ol>
        <li><b>Не поняли, из чего состоит проект?</b><p>Бот, Mini App и сайт — три части одного проекта. Короткая инструкция объясняет, как они связаны.</p><button onClick={onGuide}>Открыть инструкцию <ArrowRight /></button></li>
        <li><b>Соберите сценарий или страницу.</b><p>Конструктор открывается рядом с этим меню — разделы кабинета остаются на месте.</p><button onClick={openEditor}>Открыть конструктор <ArrowRight /></button></li>
        <li><b>Проверьте путь клиента.</b><p>Кнопки, переходы и формы работают в интерактивном preview.</p><button onClick={onPreview}>Открыть preview <ArrowRight /></button></li>
        <li><b>Подключите Telegram-бота.</b><p>Понадобится токен от @BotFather. Он хранится только в зашифрованном виде.</p><button onClick={onLaunch}>Открыть мастер запуска <ArrowRight /></button></li>
      </ol>
      <a href="mailto:support@tmastudio.ru">Написать в поддержку</a>
    </section>}
  </main>;
}

/* --------------------------------------------------------------- overview */

interface OverviewProps {
  project: ProjectState; page?: ProjectState["pages"][number]; leads: Lead[]; loadingLeads: boolean;
  completed: number; steps: boolean[]; statusLabel: string; isLive: boolean; hasPendingChanges: boolean;
  connectionNeedsAttention: boolean; hasForm: boolean; isSite: boolean;
  onEditor: () => void; onEdit: () => void; onPreview: () => void; onLaunch: () => void;
  onSelect: (section: DashboardSection) => void; onGuide: () => void;
}

/** The cabinet's front page reads like a CRM: numbers first, then the work. */
function Overview({ project, page, leads, loadingLeads, completed, steps, statusLabel, isLive, hasPendingChanges, connectionNeedsAttention, hasForm, isSite, onEditor, onEdit, onPreview, onLaunch, onSelect, onGuide }: OverviewProps) {
  const week = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const fresh = leads.filter((lead) => Date.parse(lead.createdAt) >= week).length;
  const tone = isLive && !hasPendingChanges ? "live" : connectionNeedsAttention ? "alert" : hasPendingChanges ? "pending" : "draft";
  const nextStep = steps.findIndex((done) => !done);
  const stepActions: Array<{ title: string; text: string; label: string; run: () => void }> = [
    { title: "Проект создан", text: "Название и главная страница готовы", label: "Открыть", run: () => onSelect("settings") },
    { title: isSite ? "Страница собрана" : "Сценарий бота собран", text: isSite ? "Тексты, изображения и формы" : "Сообщения, кнопки и вопросы на холсте", label: "Конструктор", run: onEditor },
    { title: "Предпросмотр пройден", text: "Проверьте кнопки и форму как клиент", label: "Проверить", run: onPreview },
    { title: "Telegram-бот подключён", text: "Понадобится токен от @BotFather", label: "Подключить", run: onLaunch },
    { title: "Оплачено и опубликовано", text: "Хостинг включится после запуска", label: "Запустить", run: onLaunch },
  ];

  return <>
    <header className="crm-head">
      <div>
        <span className={`crm-status crm-status--${tone}`}>{tone === "live" ? <CheckCircle2 size={14} /> : tone === "alert" ? <TriangleAlert size={14} /> : <Circle size={14} />}{statusLabel}</span>
        <h1>{project.name}</h1>
        <p>{isLive && !hasPendingChanges ? "Бот отвечает клиентам. Правки можно вносить в любое время — публикация отдельной кнопкой." : connectionNeedsAttention ? "Публичная версия сохранена, но Telegram-подключение нужно восстановить актуальным токеном." : hasPendingChanges ? "Черновик сохранён. Опубликуйте новую версию, когда будете готовы показать её клиентам." : `Готово ${completed} из 5 шагов до запуска. Следующий шаг подсвечен ниже.`}</p>
      </div>
      <div className="crm-head-actions">
        <button className="primary-button" onClick={isLive && !hasPendingChanges ? onPreview : onLaunch}>{isLive && !hasPendingChanges ? <Eye /> : <Rocket />}{connectionNeedsAttention ? "Переподключить" : isLive ? hasPendingChanges ? "Опубликовать" : "Проверить" : "Запустить"}</button>
        <button className="outline-button" onClick={onEditor}>{isSite ? <Globe /> : <GitBranch />}Конструктор</button>
      </div>
    </header>

    <section className="crm-metrics" aria-label="Показатели проекта">
      <button className="crm-metric" onClick={() => onSelect("leads")}>
        <span className="crm-metric-icon"><Inbox /></span>
        <b>{loadingLeads ? "…" : leads.length}</b>
        <small>Заявок всего</small>
        <em>{fresh > 0 ? `${fresh} за неделю` : "Новых нет"}</em>
      </button>
      <button className="crm-metric" onClick={() => onSelect("bot")}>
        <span className="crm-metric-icon"><Bot /></span>
        <b>{project.botUsername ? `@${project.botUsername}` : "Не подключён"}</b>
        <small>Telegram-бот</small>
        <em>{connectionNeedsAttention ? "Нужен новый токен" : project.botUsername ? "Подключён" : "Токен от @BotFather"}</em>
      </button>
      <button className="crm-metric" onClick={() => onSelect("settings")}>
        <span className="crm-metric-icon"><Wallet /></span>
        <b>{project.plan === "free" ? "Черновик" : project.plan === "trio" ? "Трио" : project.plan === "studio" ? "Студия" : "Соло"}</b>
        <small>Тариф</small>
        <em>{project.plan === "free" ? "Публикация после оплаты" : "Хостинг включён"}</em>
      </button>
      <button className="crm-metric" onClick={onEditor}>
        <span className="crm-metric-icon">{isSite ? <Globe /> : <Smartphone />}</span>
        <b>{completed} / 5</b>
        <small>Шагов до запуска</small>
        <em>{completed === 5 ? "Всё готово" : stepActions[nextStep]?.title ?? "Продолжить"}</em>
      </button>
    </section>

    <section className="crm-grid">
      <div className="panel crm-steps">
        <div className="panel-title"><div><span>ПУТЬ ДО ЗАПУСКА</span><h2>{completed} из 5 шагов</h2></div><div className="crm-progress" role="img" aria-label={`Готово ${completed} из 5`}><i style={{ width: `${completed * 20}%` }} /></div></div>
        {stepActions.map((step, index) => <div key={step.title} className={`task ${steps[index] ? "done" : ""} ${index === nextStep ? "next" : ""}`}>
          {steps[index] ? <CheckCircle2 /> : <Circle />}
          <div><b>{step.title}</b><p>{step.text}</p></div>
          {!steps[index] && <button onClick={step.run}>{step.label}<ChevronRight /></button>}
        </div>)}
      </div>

      <div className="panel crm-inbox">
        <div className="panel-title"><div><span>ПОСЛЕДНИЕ ЗАЯВКИ</span><h2>{leads.length === 0 ? "Пока пусто" : `${leads.length} всего`}</h2></div>{leads.length > 0 && <button className="crm-link" onClick={() => onSelect("leads")}>Все <ChevronRight size={15} /></button>}</div>
        {leads.length === 0
          ? <div className="crm-empty"><Users /><p>{hasForm ? "Форма готова принимать заявки. После запуска обращения появятся здесь." : "В проекте пока нет формы заявки — добавьте её, чтобы собирать контакты."}</p><button className="outline-button" onClick={hasForm ? onPreview : onEdit}>{hasForm ? "Отправить тестовую" : "Добавить форму"}</button></div>
          : <ul className="crm-lead-list">{leads.slice(0, 4).map((lead) => <li key={lead.id}>
              <b>{Object.values(lead.values).find((value) => typeof value === "string" && value.length > 0) ?? "Новая заявка"}</b>
              <span>{new Date(lead.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
            </li>)}</ul>}
      </div>

      <div className="panel crm-preview">
        <div className="panel-title"><div><span>ВАШЕ ПРИЛОЖЕНИЕ</span><h2>{page?.title ?? "Главная"}</h2></div><span className={`draft-pill ${isLive ? "live" : hasPendingChanges ? "pending" : ""}`}>{isLive ? "Опубликовано" : hasPendingChanges ? "Новая версия" : "Черновик"}</span></div>
        <div className="dashboard-phone">{page && <PhonePreview page={page} projectName={project.name} selectedId={undefined} onSelect={() => undefined} />}</div>
        <div className="preview-actions"><button className="outline-button" onClick={onPreview}><Eye />Предпросмотр</button><button className="outline-button" onClick={onEdit}>Редактировать</button></div>
      </div>

      <button className="panel crm-hint" onClick={onGuide}>
        <span>✦</span>
        <div><b>Как устроен проект</b><p>Бот, Mini App и сайт — три части одного кабинета. Короткая инструкция за минуту.</p></div>
        <ChevronRight />
      </button>
    </section>
  </>;
}

/* ------------------------------------------------------------------ panels */

function BotPanel({ project, isLive, botConnected, hasPendingChanges, connectionNeedsAttention, onLaunch, onReconnect, onEditFlow }: { project: ProjectState; isLive: boolean; botConnected: boolean; hasPendingChanges: boolean; connectionNeedsAttention: boolean; onLaunch: () => void; onReconnect: () => void; onEditFlow: () => void }) {
  const title = botConnected && project.botUsername ? `@${project.botUsername} подключён` : connectionNeedsAttention ? "Telegram-бот требует переподключения" : "Бот ещё не подключён";
  const text = botConnected
    ? project.kit === "bot" ? "Текстовый сценарий работает в чате. Mini App в этом формате не публикуется." : "Кнопка меню ведёт в актуальную опубликованную версию Mini App."
    : connectionNeedsAttention ? "Подключение Telegram не завершено или было отозвано. Вставьте актуальный токен — мастер безопасно восстановит Menu Button и webhook."
    : "Создайте бота через @BotFather. Мастер проверит токен, зашифрует его и настроит Menu Button автоматически.";
  const action = connectionNeedsAttention ? "Переподключить бота" : project.botUsername ? !isLive ? "Продлить доступ" : hasPendingChanges ? "Опубликовать изменения" : "Открыть бота в Telegram" : "Подключить бота";
  return <section className="panel empty-section">
    <span><Bot /></span><h2>{title}</h2><p>{text}</p>
    <div>
      <button className="primary-button" onClick={project.botUsername && isLive && !hasPendingChanges ? () => window.open(`https://t.me/${project.botUsername}`, "_blank", "noopener,noreferrer") : onLaunch}>{action}</button>
      <button className="outline-button" onClick={onEditFlow}>Собрать сценарий бота</button>
      <button className="outline-button" onClick={onReconnect}>Обновить подключение</button>
      {project.miniAppUrl && <a className="outline-button" href={project.miniAppUrl} target="_blank" rel="noreferrer">Проверить Mini App в браузере</a>}
      {project.miniAppUrl && project.kit !== "bot-app" && <a className="outline-button" href={siteUrlOf(project.miniAppUrl)} target="_blank" rel="noreferrer"><Globe />Открыть сайт</a>}
    </div>
  </section>;
}

function LeadsPanel({ leads, loading, onTest }: { leads: Lead[]; loading: boolean; onTest: () => void }) {
  if (loading) return <section className="panel empty-section"><h2>Загружаем заявки…</h2></section>;
  if (leads.length === 0) return <section className="panel empty-section"><span><Users /></span><h2>Заявок пока нет</h2><p>После запуска отправьте тестовую заявку — она появится здесь с контактами клиента.</p><div><button className="primary-button" onClick={onTest}>Открыть preview</button></div></section>;
  return <section className="panel leads-panel">
    <div className="panel-title"><div><span>ВХОДЯЩИЕ</span><h2>{leads.length} заявок</h2></div><button className="outline-button" onClick={() => downloadCsv(leads)}>Скачать CSV</button></div>
    <div className="lead-list">{leads.map((lead) => <article key={lead.id}>
      <div><b>{Object.values(lead.values).find((value) => typeof value === "string") || "Новая заявка"}</b><span>{lead.pageTitle} · {new Date(lead.createdAt).toLocaleString("ru-RU")}</span></div>
      <dl>{Object.entries(lead.values).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl>
    </article>)}</div>
  </section>;
}

function downloadCsv(leads: Lead[]) {
  const keys = [...new Set(leads.flatMap((lead) => Object.keys(lead.values)))];
  const rows = [["date", "page", ...keys], ...leads.map((lead) => [lead.createdAt, lead.pageTitle, ...keys.map((key) => String(lead.values[key] ?? ""))])];
  const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv" }));
  link.download = "tma-studio-leads.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}
