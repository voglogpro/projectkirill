export type HapticStyle = "light" | "medium" | "heavy";

interface TelegramWebApp {
  initData: string;
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
  ready(): void;
  expand(): void;
  openLink(url: string): void;
  openTelegramLink(url: string): void;
  onEvent(event: "themeChanged", callback: () => void): void;
  HapticFeedback?: {
    impactOccurred(style: HapticStyle): void;
    notificationOccurred(type: "error" | "success" | "warning"): void;
  };
}

declare global {
  interface Window { Telegram?: { WebApp: TelegramWebApp } }
}

export const telegram = {
  get app() { return window.Telegram?.WebApp; },
  initialize(): void {
    const app = window.Telegram?.WebApp;
    if (!app) return;
    app.ready();
    app.expand();
    applyTheme(app);
    app.onEvent("themeChanged", () => applyTheme(app));
  },
  haptic(style: HapticStyle = "light"): void { window.Telegram?.WebApp.HapticFeedback?.impactOccurred(style); },
  success(): void { window.Telegram?.WebApp.HapticFeedback?.notificationOccurred("success"); },
  error(): void { window.Telegram?.WebApp.HapticFeedback?.notificationOccurred("error"); },
  open(url: string): void {
    if (url.startsWith("tg://") || url.startsWith("https://t.me/")) window.Telegram?.WebApp.openTelegramLink(url);
    else if (window.Telegram?.WebApp) window.Telegram.WebApp.openLink(url);
    else window.open(url, "_blank", "noopener,noreferrer");
  },
};

function applyTheme(app: TelegramWebApp): void {
  document.documentElement.dataset.theme = app.colorScheme;
  for (const [key, value] of Object.entries(app.themeParams)) {
    if (/^#[0-9a-f]{6}$/i.test(value)) document.documentElement.style.setProperty(`--tg-theme-${key.replaceAll("_", "-")}`, value);
  }
}
