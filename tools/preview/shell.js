/*
 * Live preview shell: boots the production console bundle and the production
 * Mini App renderer side by side against the in-browser backend, plus a
 * Telegram client stand-in so the whole customer journey is visible at once.
 */
const assets = JSON.parse(document.getElementById("preview-assets").textContent);
const decode = (value) => new TextDecoder().decode(Uint8Array.from(atob(value), (character) => character.codePointAt(0)));
const WEB_JS = decode(assets.webJs), WEB_CSS = decode(assets.webCss);
const MINI_JS = decode(assets.miniJs), MINI_CSS = decode(assets.miniCss);

let snapshot = { project: undefined };
const backend = createBackend((next) => { snapshot = next; render(); });
snapshot = backend.snapshot();

const view = { phone: "telegram", source: "draft", theme: "light" };
const chat = [];
let seenBotId;

const el = (id) => document.getElementById(id);
const consoleFrame = el("console-frame");
const miniFrame = el("mini-frame");

/* ---------------------------------------------------------------- console */

function mountConsole() {
  const frame = write(consoleFrame, '<div id="root"></div>', WEB_CSS);
  const win = consoleFrame.contentWindow;
  installFetch(win);
  softenHistory(win);
  win.open = (url) => { openExternal(String(url ?? "")); return null; };
  try { win.sessionStorage.setItem("tma-studio-session", JSON.stringify(backend.sessionFor())); } catch { /* preview still works signed out */ }
  run(frame, WEB_JS, "module");
}

/* ---------------------------------------------------------------- mini app */

let mountedSignature;
function mountMiniApp(force = false) {
  const manifest = view.source === "published" ? snapshot.published : snapshot.draft;
  const signature = `${view.source}|${view.theme}|${JSON.stringify(manifest ?? null)}`;
  if (!force && signature === mountedSignature) return;
  mountedSignature = signature;
  el("mini-empty").hidden = manifest !== undefined && manifest.pages.length > 0;
  el("mini-empty-text").textContent = view.source === "published"
    ? "Приложение ещё не опубликовано. Пройдите мастер запуска в конструкторе."
    : "В черновике пока нет страниц. Добавьте блоки в конструкторе слева.";
  el("mini-tag").textContent = view.source === "published"
    ? snapshot.published ? `релиз v${snapshot.published.release.version}` : "нет релиза"
    : "черновик";
  if (manifest === undefined || manifest.pages.length === 0) { write(miniFrame, '<div id="app"></div>', MINI_CSS); return; }

  const frame = write(miniFrame, '<div id="app"></div>', MINI_CSS);
  const win = miniFrame.contentWindow;
  installFetch(win);
  installTelegram(win);
  run(frame, MINI_JS, "text/javascript");
  const boot = frame.createElement("script");
  boot.textContent = `window.__renderMiniApp(document.getElementById("app"), ${JSON.stringify(manifest)});`;
  frame.body.append(boot);
}

/** Minimal Telegram.WebApp so the shipped renderer takes its real code paths. */
function installTelegram(win) {
  const themeParams = view.theme === "dark"
    ? { bg_color: "#17212b", text_color: "#f5f5f5", hint_color: "#708499", button_color: "#c4162a", secondary_bg_color: "#232e3c" }
    : { bg_color: "#ffffff", text_color: "#1a1c19", hint_color: "#707a6c", button_color: "#c4162a", secondary_bg_color: "#f3f4f0" };
  win.Telegram = { WebApp: {
    version: "7.0", isVersionAtLeast: () => true, initData: "preview", colorScheme: view.theme, themeParams,
    ready() {}, expand() {},
    openLink: (url) => openExternal(String(url)),
    openTelegramLink: (url) => openExternal(String(url)),
    onEvent() {},
    HapticFeedback: { impactOccurred: () => buzz(), notificationOccurred: () => buzz() },
    BackButton: {
      show: () => { el("mini-back").hidden = false; },
      hide: () => { el("mini-back").hidden = true; },
      onClick: (callback) => { el("mini-back").onclick = callback; },
      offClick: () => { el("mini-back").onclick = null; },
    },
  } };
}

/* ------------------------------------------------------------ frame plumbing */

function write(iframe, body, css) {
  const frame = iframe.contentDocument;
  frame.open();
  frame.write(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${body}</body></html>`);
  frame.close();
  const style = frame.createElement("style");
  style.textContent = css;
  frame.head.append(style);
  return frame;
}
function run(frame, code, type) {
  const script = frame.createElement("script");
  script.type = type;
  script.textContent = code;
  frame.body.append(script);
}
function installFetch(win) {
  win.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url ?? String(input);
    const options = typeof input === "object" && input !== null && !(input instanceof win.URL) ? { ...input, ...init } : init;
    const result = backend.handle(url, options);
    await new Promise((resolve) => setTimeout(resolve, 120)); // visible, honest latency
    return new win.Response(result.body === undefined ? null : JSON.stringify(result.body), {
      status: result.status,
      headers: { "content-type": "application/json" },
    });
  };
}
/** The console routes with history; a preview frame has no real path to push. */
function softenHistory(win) {
  for (const name of ["pushState", "replaceState"]) {
    const original = win.history[name].bind(win.history);
    win.history[name] = (...args) => { try { original(...args); } catch { /* preview keeps in-memory routing */ } };
  }
}

/* ------------------------------------------------------------------- telegram */

function botName() { return snapshot.bot?.username ? `@${snapshot.bot.username}` : "Бот не подключён"; }
function say(from, text, buttons) { chat.push({ from, text, buttons, at: new Date() }); renderChat(); }

/** The console saves the scenario here; the chat runs that exact document. */
function currentFlow() {
  try { const raw = localStorage.getItem("tma-studio-flow-v1"); return raw === null ? undefined : JSON.parse(raw); }
  catch { return undefined; }
}

let dialog = initialDialogState();

function send(text) {
  const value = text.trim();
  if (value === "") return;
  say("user", value);
  const isCommand = /^\/[A-Za-z0-9_]+(?:@[A-Za-z0-9_]+)?(?:\s|$)/.test(value);
  deliver(isCommand ? { kind: "command", command: value } : { kind: "text", text: value });
}

function deliver(event) {
  const bot = snapshot.bot;
  if (bot === undefined) { say("system", "Бот ещё не подключён. Пройдите мастер запуска в конструкторе."); return; }
  const flow = currentFlow();
  if (flow === undefined) {
    setTimeout(() => say("bot", "Приложение готово. Нажмите кнопку, чтобы открыть его.", [{ id: "app", kind: "miniapp", label: bot.menuButtonText ?? "Открыть приложение" }]), 350);
    return;
  }
  const step = runFlow(flow, dialog, event);
  dialog = step.state;
  if (step.messages.length === 0) {
    setTimeout(() => say("system", step.handled
      ? "Сценарий дошёл до конца этой ветки."
      : event.kind === "command" ? "Такой команды в сценарии нет." : "Бот сейчас ничего не ждёт — добавьте шаг «Вопрос»."), 350);
    return;
  }
  let wait = 350;
  for (const message of step.messages) {
    wait += Math.min(message.delaySeconds ?? 0, 3) * 1000;
    setTimeout(() => say("bot", message.text, message.buttons), wait);
  }
}

function press(button) {
  if (button.kind === "url") { openExternal(button.url ?? ""); return; }
  if (button.kind === "miniapp") { view.phone = "mini"; view.source = "published"; render(); return; }
  say("user", button.label);
  deliver({ kind: "press", handle: button.id });
}

function renderChat() {
  const list = el("chat-log");
  const active = chat.filter((message) => message.buttons && message.buttons.length > 0).at(-1);
  list.replaceChildren(...chat.map((message) => {
    const row = document.createElement("div");
    row.className = `msg ${message.from}`;
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = message.text;
    if (message === active) {
      for (const button of message.buttons) {
        const action = document.createElement("button");
        action.className = "webapp-button";
        action.textContent = button.kind === "url" ? `${button.label} \u2197` : button.label;
        action.onclick = () => press(button);
        bubble.append(action);
      }
    }
    if (message.from !== "system") {
      const time = document.createElement("i");
      time.textContent = message.at.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
      bubble.append(time);
    }
    row.append(bubble);
    return row;
  }));
  list.scrollTop = list.scrollHeight;
}

/* ---------------------------------------------------------------------- shell */

function openExternal(url) {
  if (url === "" || url === "about:blank") return; // the payment window the console opens before it has a URL
  if (url.includes("t.me/") || url.startsWith("tg://")) { view.phone = "telegram"; render(); say("system", `Ссылка открыла Telegram: ${url}`); return; }
  say("system", `Внешняя ссылка: ${url}`);
  view.phone = "telegram"; render();
}
function buzz() {
  const phone = el("phone");
  phone.classList.remove("buzz");
  void phone.offsetWidth;
  phone.classList.add("buzz");
}

function render() {
  const project = snapshot.project;
  el("status-project").textContent = project?.name ?? "проект не создан";
  el("status-state").textContent = project === undefined ? "—" : project.status === "active" ? "опубликован" : "черновик";
  el("status-state").dataset.live = String(project?.status === "active");
  el("status-bot").textContent = botName();
  el("status-version").textContent = snapshot.published ? `релиз v${snapshot.published.release.version}` : "нет релиза";
  el("status-leads").textContent = `${snapshot.submissions ?? 0} заявок`;

  el("chat-title").textContent = snapshot.bot?.firstName ?? "Ваш бот";
  el("chat-subtitle").textContent = snapshot.bot ? botName() : "ожидает подключения";
  el("chat-menu").textContent = snapshot.bot?.menuButtonText ?? "Меню";
  el("chat-menu").disabled = snapshot.bot === undefined || snapshot.published === undefined;

  for (const [name, node] of [["telegram", el("phone-telegram")], ["mini", el("phone-mini")]]) node.hidden = view.phone !== name;
  for (const button of document.querySelectorAll("[data-phone]")) button.classList.toggle("active", button.dataset.phone === view.phone);
  for (const button of document.querySelectorAll("[data-source]")) button.classList.toggle("active", button.dataset.source === view.source);
  el("phone").dataset.theme = view.theme;
  el("theme-toggle").textContent = view.theme === "light" ? "Тёмная тема" : "Светлая тема";

  if (snapshot.bot !== undefined && snapshot.bot.botId !== seenBotId) {
    seenBotId = snapshot.bot.botId;
    say("system", `Бот ${botName()} подключён: setChatMenuButton и setWebhook выполнены, токен зашифрован.`);
  }
  if (view.phone === "mini") mountMiniApp();
}

/* ------------------------------------------------------------------- wiring */

for (const button of document.querySelectorAll("[data-phone]")) button.onclick = () => { view.phone = button.dataset.phone; render(); };
for (const button of document.querySelectorAll("[data-source]")) button.onclick = () => { view.source = button.dataset.source; render(); };
el("theme-toggle").onclick = () => { view.theme = view.theme === "light" ? "dark" : "light"; render(); };
el("chat-form").onsubmit = (event) => { event.preventDefault(); const input = el("chat-input"); send(input.value); input.value = ""; };
el("chat-menu").onclick = () => { view.phone = "mini"; view.source = "published"; render(); };
el("start-button").onclick = () => { dialog = initialDialogState(); send("/start"); };
el("reset-button").onclick = () => { if (confirm("Сбросить демо-данные предпросмотра?")) backend.reset(); };
el("reload-console").onclick = () => { mountConsole(); mountedSignature = undefined; };
for (const button of document.querySelectorAll("[data-layout]")) {
  button.onclick = () => {
    document.body.dataset.layout = button.dataset.layout;
    for (const other of document.querySelectorAll("[data-layout]")) other.classList.toggle("active", other === button);
  };
}
document.querySelector(`[data-layout="${innerWidth >= 1080 ? "split" : "console"}"]`).click();

say("system", "Это имитация клиента Telegram: сообщения исполняет тот же интерпретатор сценария, что и worker в src/telegram/telegram-update-worker.ts.");
mountConsole();
render();
