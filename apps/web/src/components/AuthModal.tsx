import { Bot, ChevronRight, Lock, X } from "lucide-react";
import { useEffect, useState } from "react";
import { loginAccount, registerAccount } from "../api";

export function AuthModal({ onClose, onAuthenticated, onDemo }: { onClose: () => void; onAuthenticated: () => Promise<void>; onDemo: () => void }) {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [name, setName] = useState("Кирилл");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

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
      await onAuthenticated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось войти");
    } finally {
      setPending(false);
    }
  }

  return <div className="modal-backdrop" role="presentation">
    <form className="auth-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="auth-title" autoComplete="on">
      <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть окно"><X /></button>
      <div className="brand auth-brand"><span className="brand-mark"><Bot /></span>TMA Studio</div>
      <div className="auth-heading">
        <h2 id="auth-title">{mode === "register" ? "Создайте первый проект" : "С возвращением"}</h2>
        <p>{mode === "register" ? "Конструктор бесплатный. Оплата понадобится только перед запуском." : "Войдите, чтобы продолжить работу."}</p>
      </div>
      <div className="auth-fields">
        {mode === "register" && <label><span>Ваше имя</span><input required name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></label>}
        <label><span>Email</span><input required name="email" autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
        <label><span>Пароль</span><input required name="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={12} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Минимум 12 символов" /><small><Lock />Пароль защищён scrypt-хешированием</small></label>
      </div>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <button className="primary-button auth-submit" disabled={pending}>{pending ? "Подождите…" : mode === "register" ? "Создать бесплатно" : "Войти"}<ChevronRight /></button>
      <button type="button" className="auth-switch" onClick={() => { setError(undefined); setMode(mode === "register" ? "login" : "register"); }}>{mode === "register" ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться"}</button>
      <div className="demo-divider"><span>или</span></div>
      <button type="button" className="outline-button demo-button" onClick={onDemo}>Открыть демо без регистрации</button>
    </form>
  </div>;
}
