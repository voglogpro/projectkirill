import { Bot, Check, ChevronRight, Copy, Lock, Rocket, X } from "lucide-react";
import { useState } from "react";
import { activateBot, createCheckout, getEntitlement, publishProject, validateBot } from "../api";

type Plan = "solo" | "trio";

export function LaunchModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [token, setToken] = useState("");
  const [plan, setPlan] = useState<Plan>("solo");
  const [bot, setBot] = useState<{ firstName: string; username?: string }>();
  const [launchUrl, setLaunchUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

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
      if (checkout.confirmationUrl) { location.assign(checkout.confirmationUrl); return; }
      if (checkout.status === "succeeded") { setStep(3); return; }
      setError("Платёж создан. После подтверждения оплаты вернитесь в этот мастер запуска.");
    } catch (reason) { setError(messageFrom(reason, "Не удалось создать платёж")); }
    finally { setPending(false); }
  }

  async function launch() {
    setPending(true); setError(undefined);
    try {
      await publishProject(projectId);
      const connected = await activateBot(projectId, token);
      setToken(""); setLaunchUrl(connected.miniAppUrl); setStep(4);
    } catch (reason) { setError(messageFrom(reason, "Не удалось запустить приложение")); }
    finally { setPending(false); }
  }

  return <div className="modal-backdrop"><div className="launch-modal">
    <button className="modal-close" onClick={onClose} aria-label="Закрыть"><X /></button>
    <div className="launch-progress"><span className={step >= 1 ? "active" : ""}>1</span><i className={step >= 2 ? "active" : ""} /><span className={step >= 2 ? "active" : ""}>2</span><i className={step >= 3 ? "active" : ""} /><span className={step >= 3 ? "active" : ""}>3</span></div>

    {step === 1 && <>
      <div className="modal-icon"><Bot /></div><h2>Подключите Telegram-бота</h2>
      <p>Создайте бота у @BotFather и вставьте полученный токен. Мы проверим его, а после оплаты безопасно сохраним и настроим Mini App.</p>
      <ol><li><span>1</span>Откройте <b>@BotFather</b> в Telegram <button aria-label="Скопировать"><Copy /></button></li><li><span>2</span>Отправьте команду <b>/newbot</b></li><li><span>3</span>Скопируйте API-токен</li></ol>
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
      <button className="back-link" onClick={onClose}>Готово</button>
    </>}
  </div></div>;
}

function BotCard({ bot }: { bot?: { firstName: string; username?: string } }) {
  return <div className="found-bot"><span className="avatar">{bot?.firstName?.slice(0, 1).toUpperCase() ?? "B"}</span><div><b>{bot?.firstName ?? "Telegram-бот"}</b><span>{bot?.username ? `@${bot.username}` : "Без username"}</span></div><Check /></div>;
}

function PlanOption({ code, current, onSelect, title, subtitle, price, badge }: { code: Plan; current: Plan; onSelect: (plan: Plan) => void; title: string; subtitle: string; price: string; badge?: string }) {
  return <button className={`plan-option ${current === code ? "active" : ""}`} onClick={() => onSelect(code)}><span className="radio" /><span><b>{title} {badge && <em>{badge}</em>}</b><small>{subtitle}</small></span><strong>{price}<small>/мес</small></strong></button>;
}

function messageFrom(reason: unknown, fallback: string): string { return reason instanceof Error ? reason.message : fallback; }
