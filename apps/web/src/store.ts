import type { BuilderBlock, ProjectState, TemplateId } from "./types";

const STORAGE_KEY = "tma-studio-project-v2";
const LEGACY_KEY = "tma-studio-project-v1";

const templateNames: Record<TemplateId, string> = {
  catalog: "Каталог товаров", booking: "Онлайн-запись", leads: "Сбор заявок", services: "Презентация услуг", blank: "Мой Mini App",
};

export function createProjectFromTemplate(templateId: TemplateId = "leads", projectName?: string): ProjectState {
  const pageId = crypto.randomUUID();
  const block = (value: Omit<BuilderBlock, "id" | "version">): BuilderBlock => ({ id: crypto.randomUUID(), version: 1, ...value } as BuilderBlock);
  const form = () => block({ type: "form", props: { formKey: "contact", fields: [
    { id: "name", kind: "text", label: "Ваше имя", required: true, multiline: false, maxLength: 120 },
    { id: "phone", kind: "phone", label: "Телефон", required: true },
  ], submitLabel: "Отправить заявку", successMessage: "Спасибо! Мы скоро свяжемся.", hapticOnSuccess: true } });
  const templates: Record<TemplateId, BuilderBlock[]> = {
    catalog: [block({ type: "heading", props: { text: "Новинки магазина", level: 1, align: "start" } }), block({ type: "text", props: { markdown: "Выберите товар и оформите заказ прямо в Telegram.", tone: "secondary" } }), block({ type: "product", props: { productId: "product-1", title: "Главный товар", description: "Коротко расскажите о пользе товара.", price: { amountMinor: 199000, currency: "RUB" }, badge: "Новинка", cta: { label: "Заказать", action: { kind: "url", url: "https://t.me" } } } }), form()],
    booking: [block({ type: "heading", props: { text: "Запишитесь онлайн", level: 1, align: "center" } }), block({ type: "text", props: { markdown: "Расскажите об услуге, свободных слотах и времени ответа.", tone: "secondary" } }), { ...form(), props: { ...form().props, formKey: "booking", submitLabel: "Записаться" } } as BuilderBlock],
    leads: [block({ type: "heading", props: { text: "Получите консультацию", level: 1, align: "start" } }), block({ type: "text", props: { markdown: "Опишите предложение и объясните, что произойдёт после отправки формы.", tone: "secondary" } }), form()],
    services: [block({ type: "heading", props: { text: "Помогаем вашему бизнесу", level: 1, align: "start" } }), block({ type: "text", props: { markdown: "Покажите услуги, преимущества и удобный способ связаться.", tone: "secondary" } }), block({ type: "button", props: { label: "Написать в Telegram", style: "primary", action: { kind: "url", url: "https://t.me" }, haptic: "light", fullWidth: true } })],
    blank: [],
  };
  return { id: crypto.randomUUID(), name: projectName?.trim() || templateNames[templateId], status: "draft", plan: "free", templateId, previewed: false, activePageId: pageId, pages: [{ id: pageId, title: "Главная", slug: "home", blocks: templates[templateId] }] };
}

export const starterProject = createProjectFromTemplate();

function scopedKey(): string {
  try { const session = JSON.parse(sessionStorage.getItem("tma-studio-session") ?? "null") as { user?: { id?: string } } | null; return `${STORAGE_KEY}:${session?.user?.id ?? "guest"}`; }
  catch { return `${STORAGE_KEY}:guest`; }
}

export function loadProject(): ProjectState {
  try {
    const stored = localStorage.getItem(scopedKey()) ?? localStorage.getItem(LEGACY_KEY);
    if (stored === null) return createProjectFromTemplate();
    const project = JSON.parse(stored) as ProjectState;
    return { ...project, status: project.status === "active" ? "active" : "draft", activePageId: project.activePageId ?? project.pages[0]?.id };
  } catch { return createProjectFromTemplate(); }
}
export function saveProject(project: ProjectState): void { localStorage.setItem(scopedKey(), JSON.stringify(project)); }
export function clearLocalProject(): void { localStorage.removeItem(scopedKey()); }

export function createBlock(type: BuilderBlock["type"]): BuilderBlock {
  const id = crypto.randomUUID();
  switch (type) {
    case "heading": return { id, version: 1, type, props: { text: "Новый заголовок", level: 2, align: "start" } };
    case "text": return { id, version: 1, type, props: { markdown: "Добавьте описание", tone: "default" } };
    case "button": return { id, version: 1, type, props: { label: "Нажать", style: "primary", action: { kind: "url", url: "https://t.me" }, haptic: "light", fullWidth: true } };
    case "product": return { id, version: 1, type, props: { productId: id, title: "Название товара", description: "Короткое описание", price: { amountMinor: 99000, currency: "RUB" }, cta: { label: "Заказать", action: { kind: "url", url: "https://t.me" } } } };
    case "form": return { id, version: 1, type, props: { formKey: `form-${id.slice(0, 6)}`, fields: [{ id: "name", kind: "text", label: "Ваше имя", required: true, multiline: false, maxLength: 120 }, { id: "phone", kind: "phone", label: "Телефон", required: true }], submitLabel: "Отправить", successMessage: "Спасибо! Мы скоро свяжемся.", hapticOnSuccess: true } };
    case "media": return { id, version: 1, type, props: { kind: "image", url: "https://placehold.co/1200x675/e9ece5/667066?text=Image", alt: "Изображение", aspectRatio: "16:9" } };
  }
}

export const templateOptions: Array<{ id: TemplateId; title: string; description: string }> = [
  { id: "catalog", title: "Каталог товаров", description: "Карточка товара, цена и форма заказа" }, { id: "booking", title: "Онлайн-запись", description: "Услуги и форма записи клиента" }, { id: "leads", title: "Сбор заявок", description: "Лендинг и контактная форма" }, { id: "services", title: "Презентация услуг", description: "О компании, услугах и контактах" }, { id: "blank", title: "Пустой проект", description: "Начните с чистого экрана" },
];
