import { Bot, Check, ChevronRight, Copy, ExternalLink, Lock, Rocket, X } from "lucide-react";
import { useEffect, useState } from "react";
import { activateBot, createCheckout, getEntitlement, publishProject, validateBot } from "../api";

type Plan = "solo" | "trio";

export function LaunchModal({ projectId, initialPlan = "solo", onClose, onLaunched }: { projectId: string; initialPlan?: Plan; onClose: () => void; onLaunched: (result: { plan: Plan; botUsername?: string; miniAppUrl: string }) => void }) {
  const [step, setStep] = useState(1);
  const [token, setToken] = useState("");
  const [plan, setPlan] = useState<Plan>(initialPlan);
  const [bot, setBot] = useState<{ firstName: string; username?: string }>();
  const [launchUrl, setLaunchUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { const overflow = document.body.style.overflow; const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !pending) onClose(); }; document.body.style.overflow = "hidden"; addEventListener("keydown", close); return () => { document.body.style.overflow = overflow; removeEventListener("keydown", close); }; }, [onClose, pending]);
  useEffect(() => { let channel: BroadcastChannel | undefined; try { channel = new BroadcastChannel("tma-studio-payment"); channel.onmessage = (event) => { if ((event.data as { type?: string })?.type === "payment-return") void checkPayment(); }; } catch { /* Manual payment check remains available. */ } return () => channel?.close(); }, []);

  async function checkBot() {
    setPending(true); setError(undefined);
    try {
      const [found, entitlement] = await Promise.all([validateBot(projectId, token), getEntitlement()]);
      setBot(found); setStep(entitlement.canPublish ? 3 : 2);
    } catch (reason) { setError(messageFrom(reason, "Не удалось проверить бота")); }
    finally { setPending(false); }
  }

  async function pay() {
    setPending(true); setError(undefined);
    try {
      const checkout = await createCheckout(plan);
      if (checkout.confirmationUrl) { window.open(checkout.confirmationUrl, "tma-payment", "noopener,noreferrer"); setStep(5); return; }
      if (checkout.status === "succeeded") { setStep(3); return; }
      setError("Платёж создан. После подтверждения оплаты вернитесь в этот мастер запуска.");
    } catch (reason) { setError(messageFrom(reason, "Не удалось создать платёж")); }
    finally { setPending(false); }
  }

  async function checkPayment() {
    setPending(true); setError(undefined);
    try { const entitlement = await getEntitlement(); if (entitlement.canPublish) setStep(3); else setError("Платёж ещё не подтверждён. Подождите несколько секунд и проверьте снова."); }
    catch (reason) { setError(messageFrom(reason, "Не удалось проверить оплату")); }
    finally { setPending(false); }
  }

  async function copyCommand() { try { await navigator.clipboard.writeText("/newbot"); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { setError("Не удалось скопировать автоматически. Скопируйте команду /newbot вручную."); } }

  async function launch() {
    setPending(true); setError(undefined);
    try {
      await publishProject(projectId);
      const connected = await activateBot(projectId, token);
      setToken(""); setLaunchUrl(connected.miniAppUrl); setStep(4);
    } catch (reason) { setError(messageFrom(reason, "Не удалось запустить приложение")); }
    finally { setPending(false); }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}><div className="launch-modal" role="dialog" aria-modal="true" aria-label="Мастер запуска">
    <button className="modal-close" onClick={onClose} aria-label="Закрыть"><X /></button>
    <div className="launch-progress"><span className={step >= 1 ? "active" : ""}>1</span><i className={step >= 2 ? "active" : ""} /><span className={step >= 2 ? "active" : ""}>2</span><i className={step >= 3 ? "active" : ""} /><span className={step >= 3 ? "active" : ""}>3</span></div>

    {step === 1 && <>
      <div className="modal-icon"><Bot /></div><h2 id="launch-title">Подключите Telegram-бота</h2>
      <p>Создайте бота у @BotFather и вставьте полученный токен. Мы проверим его, а после оплаты безопасно сохраним и настроим Mini App.</p>
      <ol><li><span>1</span>Откройте <b>@BotFather</b> в Telegram <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" aria-label="Открыть BotFather"><ExternalLink /></a></li><li><span>2</span>Отправьте команду <b>/newbot</b><button onClick={() => void copyCommand()} aria-label="Скопировать команду /newbot"><Copy /></button></li><li><span>3</span>Скопируйте API-токен</li></ol>
      {copied && <div className="inline-success">Команда /newbot скопирована</div>}
      <label className="token-field"><span>Bot Token</span><input type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value.trim())} placeholder="1234567890:AAH..." /><small><Lock />Токен будет зашифрован перед сохранением</small></label>
      {error && <div className="auth-error">{error}</div>}
      <button className="primary-button modal-action" disabled={token.length < 20 || pending} onClick={() => void checkBot()}>{pending ? "Проверяем…" : "Проверить и продолжить"} <ChevronRight /></button>
    </>}

    {step === 2 && <>
      <div className="modal-icon green"><Check /></div><h2>Бот найден</h2><BotCard bot={bot} />
      <h3 className="choose-title">Выберите тариф</h3>
      <PlanOption code="solo" current={plan} onSelect={setPlan} title="Один бот" subtitle="Для одного проекта" price="350 ₽" />
      <PlanOption code="trio" current={plan} onSelect={setPlan} title="Три бота" subtitle="Для нескольких проектов" price="650 ₽" badge="Выгодно" />
      {error && <div className="auth-error">{error}</div>}
      <button className="primary-button modal-action" disabled={pending} onClick={() => void pay()}>{pending ? "Создаём платёж…" : "Перейти к оплате"} <ChevronRight /></button>
      <button className="back-link" onClick={() => setStep(1)}>Назад</button>
    </>}

    {step === 3 && <>
      <div className="modal-icon purple"><Rocket /></div><h2>Всё готово к запуску</h2><BotCard bot={bot} />
      <p>Опубликуем текущую версию, зашифруем токен, установим кнопку меню и защищённый webhook. Обычно это занимает несколько секунд.</p>
      {error && <div className="auth-error">{error}</div>}
      <button className="primary-button modal-action" disabled={pending} onClick={() => void launch()}>{pending ? "Настраиваем Telegram…" : "Опубликовать и запустить"} <Rocket /></button>
      <button className="back-link" onClick={() => setStep(1)}>Проверить другой токен</button>
    </>}

    {step === 4 && <>
      <div className="modal-icon green"><Check /></div><h2>Mini App запущен</h2>
      <p>Кнопка меню и webhook настроены. Пользователи уже могут открыть приложение внутри Telegram.</p>
      {launchUrl && <a className="primary-button modal-action" href={launchUrl} target="_blank" rel="noreferrer">Открыть Mini App <ChevronRight /></a>}
      <button className="back-link" onClick={() => onLaunched({ plan, botUsername: bot?.username, miniAppUrl: launchUrl ?? "" })}>Перейти в кабинет</button>
    </>}
    {step === 5 && <><div className="modal-icon purple"><Lock /></div><h2>Завершите оплату</h2><p>Страница оплаты открылась в новой вкладке. После подтверждения вернитесь сюда — токен останется только в этой защищённой сессии.</p>{error && <div className="auth-error">{error}</div>}<button className="primary-button modal-action" disabled={pending} onClick={() => void checkPayment()}>{pending ? "Проверяем…" : "Я оплатил — проверить"}<ChevronRight /></button><button className="back-link" onClick={() => setStep(2)}>Выбрать другой тариф</button></>}
  </div></div>;
}

function BotCard({ bot }: { bot?: { firstName: string; username?: string } }) {
  return <div className="found-bot"><span className="avatar">{bot?.firstName?.slice(0, 1).toUpperCase() ?? "B"}</span><div><b>{bot?.firstName ?? "Telegram-бот"}</b><span>{bot?.username ? `@${bot.username}` : "Без username"}</span></div><Check /></div>;
}

function PlanOption({ code, current, onSelect, title, subtitle, price, badge }: { code: Plan; current: Plan; onSelect: (plan: Plan) => void; title: string; subtitle: string; price: string; badge?: string }) {
  return <button className={`plan-option ${current === code ? "active" : ""}`} onClick={() => onSelect(code)}><span className="radio" /><span><b>{title} {badge && <em>{badge}</em>}</b><small>{subtitle}</small></span><strong>{price}<small>/мес</small></strong></button>;
}

function messageFrom(reason: unknown, fallback: string): string { return reason instanceof Error ? reason.message : fallback; }
