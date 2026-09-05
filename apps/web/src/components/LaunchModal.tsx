import { Bot, Check, ChevronRight, Copy, ExternalLink, Lock, Rocket, X } from "lucide-react";
import { useEffect, useState } from "react";
import { activateBot, createCheckout, getEntitlement, loadRemoteFlow, publishProject, publishRemoteFlow, validateBot } from "../api";
import { kitName, planFitsKit, requiresMiniApp, suggestedPlan, type PaidBillingPlanCode } from "../pricing";
import type { ProductKit } from "../types";
import "../pricing.css";

type Plan = PaidBillingPlanCode;

export function LaunchModal({ projectId, projectKit = "bot", legacyFullAccessUntil, initialPlan, existingBot, onClose, onLaunched }: { projectId: string; projectKit?: ProductKit; legacyFullAccessUntil?: string; initialPlan?: Plan; existingBot?: { username: string; miniAppUrl?: string }; onClose: () => void; onLaunched: (result: { plan: Plan; botUsername?: string; miniAppUrl: string }) => void }) {
  const [step, setStep] = useState(existingBot ? 2 : 1);
  const [token, setToken] = useState("");
  const [plan, setPlan] = useState<Plan>(() => initialPlan && planFitsKit(initialPlan, projectKit) ? initialPlan : suggestedPlan(projectKit));
  const [bot, setBot] = useState<{ firstName: string; username?: string } | undefined>(existingBot ? { firstName: existingBot.username, username: existingBot.username } : undefined);
  const [launchUrl, setLaunchUrl] = useState<string | undefined>(existingBot?.miniAppUrl);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string>();
  const [reconfigure, setReconfigure] = useState(false);
  const canUse = (entitlement: Awaited<ReturnType<typeof getEntitlement>>) => entitlement.canPublish && (planFitsKit(entitlement.planCode, projectKit) || Boolean(legacyFullAccessUntil && Date.parse(legacyFullAccessUntil) > Date.now()));

  useEffect(() => { const overflow = document.body.style.overflow; const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !pending) onClose(); }; document.body.style.overflow = "hidden"; addEventListener("keydown", close); return () => { document.body.style.overflow = overflow; removeEventListener("keydown", close); }; }, [onClose, pending]);
  useEffect(() => { let channel: BroadcastChannel | undefined; try { channel = new BroadcastChannel("tma-studio-payment"); channel.onmessage = (event) => { if ((event.data as { type?: string })?.type === "payment-return") void checkPayment(); }; } catch { /* Manual payment check remains available. */ } return () => channel?.close(); }, []);

  async function checkBot() {
    setPending(true); setError(undefined);
    try {
      const [found, entitlement] = await Promise.all([validateBot(projectId, token), getEntitlement()]);
      setBot(found); if (canUse(entitlement) && entitlement.planCode !== "free") setPlan(entitlement.planCode); setStep(canUse(entitlement) ? 3 : 2);
    } catch (reason) { setError(messageFrom(reason, "Не удалось проверить бота")); }
    finally { setPending(false); }
  }

  async function pay() {
    // Open synchronously while the click still has transient user activation.
    // On slow mobile networks a popup opened only after the API response can be blocked.
    const paymentWindow = window.open("about:blank", "tma-payment");
    if (paymentWindow) paymentWindow.opener = null;
    setPending(true); setError(undefined);
    try {
      const checkout = await createCheckout(plan);
      if (checkout.confirmationUrl) {
        setCheckoutUrl(checkout.confirmationUrl);
        if (paymentWindow) paymentWindow.location.replace(checkout.confirmationUrl);
        else setError("Браузер заблокировал новую вкладку. Откройте страницу оплаты кнопкой ниже.");
        setStep(5);
        return;
      }
      paymentWindow?.close();
      if (checkout.status === "succeeded") { await checkPayment(); return; }
      setError("Платёж создан. После подтверждения оплаты вернитесь в этот мастер запуска.");
    } catch (reason) { paymentWindow?.close(); setError(messageFrom(reason, "Не удалось создать платёж")); }
    finally { setPending(false); }
  }

  async function checkPayment() {
    setPending(true); setError(undefined);
    try { const entitlement = await getEntitlement(); if (canUse(entitlement)) { if (entitlement.planCode !== "free") setPlan(entitlement.planCode); setStep(3); } else setError("Оплата подходящего тарифа ещё не подтверждена. Для Mini App нужен тариф «Студия», а не пакет текстовых ботов."); }
    catch (reason) { setError(messageFrom(reason, "Не удалось проверить оплату")); }
    finally { setPending(false); }
  }

  async function copyCommand() { try { await navigator.clipboard.writeText("/newbot"); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { setError("Не удалось скопировать автоматически. Скопируйте команду /newbot вручную."); } }

  async function launch() {
    setPending(true); setError(undefined);
    try {
      const publication = await publishProject(projectId);
      // A promoted local preview has a saved draft but no published scenario yet.
      // Publish it before activation so the worker serves the selected template.
      await loadRemoteFlow(projectId); // Also materializes a draft for legacy page-only projects.
      await publishRemoteFlow(projectId);
      if (existingBot && !reconfigure) { const result = { plan, botUsername: existingBot.username, miniAppUrl: projectKit === "site" ? `${location.origin}/s/${publication.project.publicId}` : existingBot.miniAppUrl ?? "" }; setLaunchUrl(result.miniAppUrl); onLaunched(result); setStep(4); return; }
      const connected = await activateBot(projectId, token);
      const result = { plan, botUsername: connected.botUsername ?? bot?.username, miniAppUrl: projectKit === "site" ? `${location.origin}/s/${publication.project.publicId}` : connected.miniAppUrl };
      setToken(""); setLaunchUrl(result.miniAppUrl); onLaunched(result); setStep(4);
    } catch (reason) { setError(messageFrom(reason, "Не удалось запустить приложение")); }
    finally { setPending(false); }
  }

  return <div className="modal-backdrop launch-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}><div className="launch-modal" role="dialog" aria-modal="true" aria-label="Мастер запуска">
    <button className="modal-close" onClick={onClose} aria-label="Закрыть"><X /></button>
    <div className="launch-progress"><span className={step >= 1 ? "active" : ""}>1</span><i className={step >= 2 ? "active" : ""} /><span className={step >= 2 ? "active" : ""}>2</span><i className={step >= 3 ? "active" : ""} /><span className={step >= 3 ? "active" : ""}>3</span></div>

    {step === 1 && <>
      <div className="modal-icon"><Bot /></div><h2 id="launch-title">Подключите Telegram-бота</h2>
      <p>Формат: {kitName[projectKit]}. Создайте бота у @BotFather и вставьте токен. Мы проверим его, безопасно сохраним и подключим после выбора подходящего тарифа.</p>
      <ol><li><span>1</span>Откройте <b>@BotFather</b> в Telegram <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" aria-label="Открыть BotFather"><ExternalLink /></a></li><li><span>2</span>Отправьте команду <b>/newbot</b><button onClick={() => void copyCommand()} aria-label="Скопировать команду /newbot"><Copy /></button></li><li><span>3</span>Скопируйте API-токен</li></ol>
      {copied && <div className="inline-success">Команда /newbot скопирована</div>}
      <label className="token-field"><span>Bot Token</span><input name="bot-token" type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value.trim())} placeholder="1234567890:AAH..." /><small><Lock />Токен будет зашифрован перед сохранением</small></label>
      {error && <div className="auth-error">{error}</div>}
      <button className="primary-button modal-action" disabled={token.length < 20 || pending} onClick={() => void checkBot()}>{pending ? "Проверяем…" : "Проверить и продолжить"} <ChevronRight /></button>
    </>}

    {step === 2 && <>
      <div className="modal-icon green"><Check /></div><h2>{existingBot ? "Бот уже подключён" : "Бот найден"}</h2><BotCard bot={bot} />
      <h3 className="choose-title">Выберите тариф</h3>
      <p>Вы запускаете: {kitName[projectKit]}. Редактирование и предпросмотр остаются бесплатными.</p>
      {!requiresMiniApp(projectKit) && <PlanOption code="solo" current={plan} onSelect={setPlan} title={projectKit === "site" ? "Один сайт" : "Один текстовый бот"} subtitle="Один проект · без Mini App" price="350 ₽" />}
      {projectKit === "bot" && <PlanOption code="trio" current={plan} onSelect={setPlan} title="Три текстовых бота" subtitle="До трёх ботов · Mini App не входит" price="650 ₽" />}
      {requiresMiniApp(projectKit) && <PlanOption code="studio" current={plan} onSelect={setPlan} title="Студия" subtitle="Один бот + Mini App · сайт по желанию" price="650 ₽" />}
      <p className="muted">Подписка действует на аккаунт. Смена тарифа не добавляет второй пакет к текущему; ограничения выбранного тарифа заменят прежние.</p>
      {existingBot && <button className="outline-button modal-action" disabled={pending} onClick={() => void checkPayment()}>Проверить действующую подписку</button>}
      {existingBot && <button className="back-link" onClick={() => { setReconfigure(true); setStep(1); }}>Обновить токен и кнопку меню</button>}
      {error && <div className="auth-error">{error}</div>}
      <button className="primary-button modal-action" disabled={pending} onClick={() => void pay()}>{pending ? "Создаём платёж…" : "Перейти к оплате"} <ChevronRight /></button>
      {!existingBot && <button className="back-link" onClick={() => setStep(1)}>Назад</button>}
    </>}

    {step === 3 && <>
      <div className="modal-icon info"><Rocket /></div><h2>Всё готово к запуску</h2><BotCard bot={bot} />
      <p>{projectKit === "bot" ? "Опубликуем текстовый сценарий и подключим защищённый webhook. Кнопка Mini App в этом формате не создаётся." : "Опубликуем страницы и сценарий, настроим защищённое подключение Telegram. Подключение бота и размещение входят в тариф."}</p>
      {error && <div className="auth-error">{error}</div>}
      <button className="primary-button modal-action" disabled={pending} onClick={() => void launch()}>{pending ? existingBot ? "Публикуем…" : "Настраиваем Telegram…" : existingBot ? "Опубликовать новую версию" : "Опубликовать и запустить"} <Rocket /></button>
      <button className="back-link" onClick={() => setStep(existingBot ? 2 : 1)}>{existingBot ? "Назад к тарифу" : "Проверить другой токен"}</button>
      {existingBot && <button className="back-link" onClick={() => { setReconfigure(true); setStep(1); }}>Обновить подключение после смены формата</button>}
    </>}

    {step === 4 && <>
      <div className="modal-icon green"><Check /></div><h2>{projectKit === "bot" ? "Бот запущен" : projectKit === "site" ? "Сайт опубликован" : "Mini App запущен"}</h2>
      <p>{projectKit === "bot" ? "Сценарий опубликован. Откройте своего бота и отправьте /start." : "Проект опубликован. Проверьте путь клиента по ссылке ниже."}</p>
      {bot?.username && <a className="primary-button modal-action" href={`https://t.me/${bot.username}`} target="_blank" rel="noreferrer">Открыть @{bot.username} в Telegram <ChevronRight /></a>}
      {launchUrl && projectKit !== "bot" && <a className="outline-button modal-action" href={projectKit === "site" ? launchUrl.replace("/app/", "/s/") : launchUrl} target="_blank" rel="noreferrer">{projectKit === "site" ? "Открыть сайт" : "Проверить Mini App в браузере"}</a>}
      <button className="back-link" onClick={onClose}>Перейти в кабинет</button>
    </>}
    {step === 5 && <><div className="modal-icon info"><Lock /></div><h2>Завершите оплату</h2><p>Страница оплаты открывается в новой вкладке. После подтверждения вернитесь сюда — токен останется только в этой защищённой сессии.</p>{error && <div className="auth-error">{error}</div>}{checkoutUrl && <a className="outline-button modal-action" href={checkoutUrl} target="_blank" rel="noreferrer">Открыть страницу оплаты <ExternalLink /></a>}<button className="primary-button modal-action" disabled={pending} onClick={() => void checkPayment()}>{pending ? "Проверяем…" : "Я оплатил — проверить"}<ChevronRight /></button><button className="back-link" onClick={() => setStep(2)}>Выбрать другой тариф</button></>}
  </div></div>;
}

function BotCard({ bot }: { bot?: { firstName: string; username?: string } }) {
  return <div className="found-bot"><span className="avatar">{bot?.firstName?.slice(0, 1).toUpperCase() ?? "B"}</span><div><b>{bot?.firstName ?? "Telegram-бот"}</b><span>{bot?.username ? `@${bot.username}` : "Без username"}</span></div><Check /></div>;
}

function PlanOption({ code, current, onSelect, title, subtitle, price, badge }: { code: Plan; current: Plan; onSelect: (plan: Plan) => void; title: string; subtitle: string; price: string; badge?: string }) {
  return <button className={`plan-option ${current === code ? "active" : ""}`} onClick={() => onSelect(code)}><span className="radio" /><span><b>{title} {badge && <em>{badge}</em>}</b><small>{subtitle}</small></span><strong>{price}<small>/мес</small></strong></button>;
}

function messageFrom(reason: unknown, fallback: string): string { return reason instanceof Error ? reason.message : fallback; }
