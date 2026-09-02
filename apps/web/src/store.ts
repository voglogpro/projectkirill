import type { BuilderBlock, ProjectState } from "./types";

const STORAGE_KEY = "tma-studio-project-v1";

export const starterProject: ProjectState = {
  id: crypto.randomUUID(),
  name: "Мой первый бот",
  status: "draft",
  plan: "free",
  pages: [
    {
      id: crypto.randomUUID(),
      title: "Главная",
      slug: "home",
      blocks: [
        { id: crypto.randomUUID(), version: 1, type: "heading", props: { text: "Добро пожаловать!", level: 1, align: "start" } },
        { id: crypto.randomUUID(), version: 1, type: "text", props: { markdown: "Расскажите клиентам, чем вы можете им помочь.", tone: "secondary" } },
        { id: crypto.randomUUID(), version: 1, type: "button", props: { label: "Оставить заявку", style: "primary", action: { kind: "url", url: "https://t.me" }, haptic: "light", fullWidth: true } },
      ],
    },
  ],
};

export function loadProject(): ProjectState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? starterProject : (JSON.parse(stored) as ProjectState);
  } catch {
    return starterProject;
  }
}

export function saveProject(project: ProjectState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
}

export function createBlock(type: BuilderBlock["type"]): BuilderBlock {
  const id = crypto.randomUUID();
  switch (type) {
    case "heading": return { id, version: 1, type, props: { text: "Новый заголовок", level: 2, align: "start" } };
    case "text": return { id, version: 1, type, props: { markdown: "Добавьте описание", tone: "default" } };
    case "button": return { id, version: 1, type, props: { label: "Нажать", style: "primary", action: { kind: "url", url: "https://t.me" }, haptic: "light", fullWidth: true } };
    case "product": return { id, version: 1, type, props: { productId: id, title: "Название товара", description: "Короткое описание", price: { amountMinor: 99000, currency: "RUB" }, cta: { label: "Заказать", action: { kind: "url", url: "https://t.me" } } } };
    case "form": return { id, version: 1, type, props: { formKey: `form-${id.slice(0, 6)}`, fields: [{ id: "name", kind: "text", label: "Ваше имя", required: true }, { id: "phone", kind: "phone", label: "Телефон", required: true }], submitLabel: "Отправить", successMessage: "Спасибо! Мы скоро свяжемся." } };
    case "media": return { id, version: 1, type, props: { kind: "image", alt: "Изображение", aspectRatio: "16:9" } };
  }
}
