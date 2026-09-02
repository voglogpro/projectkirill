import { submitForm } from "./api";
import { telegram } from "./telegram";
import type { AppBlock, AppManifest, AppPage } from "./types";

export function renderApp(root: HTMLElement, manifest: AppManifest): void {
  let currentPageId = manifest.entryPageId;
  const draw = () => {
    const page = manifest.pages.find((item) => item.id === currentPageId) ?? manifest.pages[0];
    root.replaceChildren();
    if (page === undefined) { root.append(stateScreen("Страница не найдена")); return; }
    const shell = element("main", "app-shell");
    for (const block of page.blocks) shell.append(renderBlock(block, manifest.project.publicId, page, (id) => { currentPageId = id; draw(); }));
    const footer = element("footer"); footer.textContent = "Работает на TMA Studio"; shell.append(footer); root.append(shell);
  };
  draw();
}

function renderBlock(block: AppBlock, publicId: string, page: AppPage, navigate: (id: string) => void): HTMLElement {
  const p = block.props;
  if (block.type === "section") {
    const node = element("section", `section surface-${String(p.surface ?? "transparent")} pad-${String(p.padding ?? "md")} gap-${String(p.gap ?? "md")}`);
    for (const child of block.children ?? []) node.append(renderBlock(child, publicId, page, navigate));
    return node;
  }
  if (block.type === "heading") { const tag = Number(p.level) === 1 ? "h1" : Number(p.level) === 3 ? "h3" : "h2"; const node = element(tag, `align-${String(p.align ?? "start")}`); node.textContent = String(p.text ?? ""); return node; }
  if (block.type === "text") { const node = element("p", `text tone-${String(p.tone ?? "default")}`); node.textContent = String(p.markdown ?? ""); return node; }
  if (block.type === "media") { const node = element("div", "media"); node.role = "img"; node.ariaLabel = String(p.alt ?? "Изображение"); node.textContent = "Изображение"; return node; }
  if (block.type === "button") return actionButton(p, navigate);
  if (block.type === "product") return product(p);
  return form(publicId, page.id, p);
}

function actionButton(props: Record<string, unknown>, navigate: (id: string) => void): HTMLButtonElement {
  const action = props.action as { kind?: string; url?: string; pageId?: string } | undefined;
  const button = element("button", `action style-${String(props.style ?? "primary")}`); button.textContent = String(props.label ?? "Продолжить");
  button.addEventListener("click", () => { telegram.haptic(toHaptic(props.haptic)); if (action?.kind === "page" && action.pageId !== undefined) navigate(action.pageId); else if (action?.url !== undefined) telegram.open(action.url); });
  return button;
}

function product(props: Record<string, unknown>): HTMLElement {
  const price = props.price as { amountMinor?: number; currency?: string } | undefined;
  const cta = props.cta as { label?: string } | undefined;
  const article = element("article", "product"); article.append(element("div", "product-photo"));
  const body = element("div", "product-body"); const title = element("h3"); title.textContent = String(props.title ?? "Товар"); body.append(title);
  if (props.description !== undefined) { const description = element("p"); description.textContent = String(props.description); body.append(description); }
  const row = element("div"); const value = element("b"); value.textContent = formatMoney(price?.amountMinor ?? 0, price?.currency ?? "RUB"); const button = element("button"); button.textContent = cta?.label ?? "Выбрать"; button.addEventListener("click", () => telegram.haptic()); row.append(value, button); body.append(row); article.append(body); return article;
}

function form(publicId: string, pageId: string, props: Record<string, unknown>): HTMLFormElement {
  const fields = (props.fields ?? []) as Array<{ id: string; kind: string; label: string; required?: boolean; options?: Array<{ value: string; label: string }> }>;
  const values: Record<string, string | boolean> = {}; const node = element("form", "form"); const title = element("h3"); title.textContent = "Оставить заявку"; node.append(title);
  for (const field of fields) {
    const label = element("label"); label.append(document.createTextNode(field.label));
    if (field.kind === "select") { const select = element("select"); select.name = field.id; select.required = field.required ?? false; const placeholder = element("option"); placeholder.value = ""; placeholder.textContent = "Выберите"; select.append(placeholder); for (const option of field.options ?? []) { const item = element("option"); item.value = option.value; item.textContent = option.label; select.append(item); } select.addEventListener("change", () => { values[field.id] = select.value; }); label.append(select); }
    else if (field.kind === "checkbox") { const input = element("input"); input.name = field.id; input.type = "checkbox"; input.required = field.required ?? false; input.addEventListener("change", () => { values[field.id] = input.checked; }); label.append(input); }
    else { const input = element("input"); input.name = field.id; input.type = field.kind === "email" ? "email" : field.kind === "phone" ? "tel" : "text"; input.required = field.required ?? false; input.addEventListener("input", () => { values[field.id] = input.value; }); label.append(input); }
    node.append(label);
  }
  const error = element("p", "form-error"); error.role = "alert"; const submit = element("button", "action"); submit.type = "submit"; submit.textContent = String(props.submitLabel ?? "Отправить"); node.append(error, submit);
  node.addEventListener("submit", (event) => { event.preventDefault(); submit.disabled = true; submit.ariaBusy = "true"; submit.textContent = "Отправляем…"; error.textContent = ""; void submitForm(publicId, pageId, String(props.formKey ?? "form"), values).then(() => { telegram.success(); const success = element("div", "form-success"); success.role = "status"; const check = element("span"); check.textContent = "✓"; const heading = element("h3"); heading.textContent = "Заявка отправлена"; const message = element("p"); message.textContent = String(props.successMessage ?? "Спасибо! Мы скоро свяжемся."); success.append(check, heading, message); node.replaceWith(success); }).catch(() => { telegram.error(); error.textContent = "Не получилось отправить. Проверьте интернет и попробуйте ещё раз."; submit.disabled = false; submit.ariaBusy = "false"; submit.textContent = String(props.submitLabel ?? "Отправить"); }); });
  return node;
}

export function stateScreen(title: string, description?: string): HTMLElement { const node = element("main", "state-screen"); const heading = element("h1"); heading.textContent = title; node.append(heading); if (description !== undefined) { const text = element("p"); text.textContent = description; node.append(text); } return node; }
export function skeleton(): HTMLElement { const node = element("main", "skeleton"); node.ariaLabel = "Загрузка"; node.append(element("i"), element("i"), element("i"), element("i")); return node; }
function formatMoney(amountMinor: number, currency: string): string { return new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 0 }).format(amountMinor / 100); }
function toHaptic(value: unknown): "light" | "medium" | "heavy" { return value === "medium" || value === "heavy" ? value : "light"; }
function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] { const node = document.createElement(tag); if (className !== undefined) node.className = className; return node; }
