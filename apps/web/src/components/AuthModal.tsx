import { Bot, ChevronRight, Eye, EyeOff, Lock, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { loginAccount, registerAccount } from "../api";

export function AuthModal({ initialMode = "register", onClose, onAuthenticated, onDemo }: { initialMode?: "register" | "login"; onClose: () => void; onAuthenticated: (mode: "register" | "login") => Promise<void>; onDemo: () => void }) {
  const [mode, setMode] = useState<"register" | "login">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      if (mode === "register") await registerAccount({ displayName: name, email, password });
      else await loginAccount({ email, password });
      await onAuthenticated(mode);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось войти");
    } finally {
      setPending(false);
    }
  }

  return <div className="modal-backdrop auth-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}>
    <form className="auth-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="auth-title" autoComplete="on">
      <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть окно"><X /></button>
      <div className="auth-side">
        <div className="brand auth-brand"><span className="brand-mark"><Bot /></span>KIRA</div>
        <h3>Что будет дальше</h3>
        <ol className="auth-steps">
          <li><i>1</i><span><b>Выберете задачу</b><small>Заявки, запись, магазин, поддержка — сценарий уже собран.</small></span></li>
          <li><i>2</i><span><b>Поменяете тексты</b><small>На холсте, мышкой. Рядом чат — сразу видно, что ответит бот.</small></span></li>
          <li><i>3</i><span><b>Нажмёте «Запустить»</b><small>Бота, токен и хостинг подключим мы. Обычно это десять минут.</small></span></li>
        </ol>
        <p className="auth-side-note"><Sparkles size={14} /> Собрать и проверить можно бесплатно. Платить нужно только чтобы бот заработал у клиентов.</p>
      </div>
      <div className="auth-main">
      <div className="auth-heading">
        <h2 id="auth-title">{mode === "register" ? "Создайте аккаунт" : "С возвращением"}</h2>
        <p>{mode === "register" ? "Собирайте проект бесплатно. Оплата понадобится только перед публикацией." : "Войдите, чтобы продолжить работу."}</p>
      </div>
      <div className="auth-fields">
        {mode === "register" && <label><span>Ваше имя</span><input autoFocus required name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></label>}
        <label><span>Email</span><input autoFocus={mode === "login"} required name="email" autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
        <label><span>Пароль</span><div className="password-control"><input required name="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={8} type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Минимум 8 символов" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}>{showPassword ? <EyeOff /> : <Eye />}</button></div><small><Lock />Мы не храним пароль в открытом виде</small></label>
      </div>
      {mode === "register" && <label className="legal-check"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>Я принимаю <a href="/terms" target="_blank">условия сервиса</a> и <a href="/privacy" target="_blank">политику конфиденциальности</a></span></label>}
      {error && <div className="auth-error" role="alert">{error}</div>}
      <button className="primary-button auth-submit" disabled={pending || (mode === "register" && !accepted)}>{pending ? "Подождите…" : mode === "register" ? "Создать бесплатно" : "Войти"}<ChevronRight /></button>
      <button type="button" className="auth-switch" onClick={() => { setError(undefined); setMode(mode === "register" ? "login" : "register"); }}>{mode === "register" ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться"}</button>
      {mode === "login" && <a className="auth-help" href="mailto:support@tmastudio.ru?subject=Восстановление доступа">Не получается войти? Написать в поддержку</a>}
      <div className="demo-divider"><span>или</span></div>
      <button type="button" className="outline-button demo-button" onClick={onDemo}>Открыть демо без регистрации</button>
      </div>
    </form>
  </div>;
}
