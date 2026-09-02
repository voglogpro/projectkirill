export type HapticStyle = "light" | "medium" | "heavy";

interface TelegramWebApp {
  version?: string;
  isVersionAtLeast?(version: string): boolean;
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
  BackButton?: { show(): void; hide(): void; onClick(callback: () => void): void; offClick(callback: () => void): void };
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
  haptic(style: HapticStyle = "light"): void { const app = window.Telegram?.WebApp; if (supports(app, "6.1")) app?.HapticFeedback?.impactOccurred(style); },
  success(): void { const app = window.Telegram?.WebApp; if (supports(app, "6.1")) app?.HapticFeedback?.notificationOccurred("success"); },
  error(): void { const app = window.Telegram?.WebApp; if (supports(app, "6.1")) app?.HapticFeedback?.notificationOccurred("error"); },
  open(url: string): void {
    if (url.startsWith("tg://") || url.startsWith("https://t.me/")) window.Telegram?.WebApp.openTelegramLink(url);
    else if (window.Telegram?.WebApp) window.Telegram.WebApp.openLink(url);
    else window.open(url, "_blank", "noopener,noreferrer");
  },
  setBackHandler(callback?: () => void): void {
    const app = window.Telegram?.WebApp;
    const button = supports(app, "6.1") ? app?.BackButton : undefined;
    if (!button) return;
    const previous = backHandler;
    if (previous) button.offClick(previous);
    backHandler = callback;
    if (callback) { button.onClick(callback); button.show(); } else button.hide();
  },
};
let backHandler: (() => void) | undefined;
function supports(app: TelegramWebApp | undefined, version: string): boolean { return app?.isVersionAtLeast?.(version) ?? true; }

function applyTheme(app: TelegramWebApp): void {
  document.documentElement.dataset.theme = app.colorScheme;
  for (const [key, value] of Object.entries(app.themeParams)) {
    if (/^#[0-9a-f]{6}$/i.test(value)) document.documentElement.style.setProperty(`--tg-theme-${key.replaceAll("_", "-")}`, value);
  }
}
