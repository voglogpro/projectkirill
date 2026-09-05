import type { AppManifest } from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "";

export async function loadManifest(publicId: string, previewToken?: string): Promise<AppManifest> {
  if (publicId === "demo") return demoManifest;
  const url = previewToken
    ? new URL(`${API_URL}/preview/v1/${encodeURIComponent(previewToken)}`, location.origin)
    : new URL(`${API_URL}/v1/public/apps/${encodeURIComponent(publicId)}`, location.origin);
  if (!previewToken && location.pathname.startsWith("/s/")) url.searchParams.set("surface", "site");
  const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(response.status === 404 ? "Приложение не найдено" : "Не удалось загрузить приложение");
  const body = await response.json() as { data: AppManifest | BackendManifest | PreviewManifest };
  return normalizeManifest(body.data);
}

export async function submitForm(publicId: string, pageId: string, formKey: string, values: Record<string, string | boolean>): Promise<void> {
  if (publicId === "demo") { await new Promise((resolve) => setTimeout(resolve, 350)); return; }
  const surface = location.pathname.startsWith("/s/") ? "?surface=site" : "";
  const response = await fetch(`${API_URL}/v1/public/apps/${encodeURIComponent(publicId)}/forms${surface}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-idempotency-key": crypto.randomUUID(), "x-telegram-init-data": window.Telegram?.WebApp.initData ?? "" },
    body: JSON.stringify({ pageId, formKey, values }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("Не удалось отправить форму");
}

const demoManifest: AppManifest = {
  project: { publicId: "demo", name: "Studio Nova" }, release: { id: "demo-v1", version: 1 }, entryPageId: "home",
  pages: [{ id: "home", slug: "home", title: "Главная", blocks: [
    { id: "cover", version: 1, type: "section", props: { surface: "accent", padding: "lg", gap: "sm" }, children: [
      { id: "title", version: 1, type: "heading", props: { text: "Время для себя", level: 1, align: "start" } },
      { id: "lead", version: 1, type: "text", props: { markdown: "Выберите услугу и удобное время — мы подтвердим запись в Telegram.", tone: "secondary" } },
    ] },
    { id: "product", version: 1, type: "product", props: { title: "Маникюр с покрытием", description: "Снятие, уход и стойкое покрытие", price: { amountMinor: 190000, currency: "RUB" }, cta: { label: "Выбрать", action: { kind: "url", url: "https://t.me" } } } },
    { id: "form", version: 1, type: "form", props: { formKey: "booking", fields: [{ id: "name", kind: "text", label: "Ваше имя", required: true }, { id: "phone", kind: "phone", label: "Телефон", required: true }], submitLabel: "Записаться", successMessage: "Готово! Мы скоро подтвердим запись." } },
  ] }],
};

interface BackendManifest {
  project: { publicId: string; name: string; entryPageId: string };
  release: { id: string; version: number };
  pages: Array<{ id: string; slug: string; title: string; document: { blocks: AppManifest["pages"][number]["blocks"] } }>;
}

interface PreviewManifest {
  project: { publicId: string; name: string; entryPageId: string };
  pages: Array<{ id: string; slug: string; title: string; document: { blocks: AppManifest["pages"][number]["blocks"] } }>;
}

export function normalizeManifest(value: AppManifest | BackendManifest | PreviewManifest): AppManifest {
  if (value.pages.every((page) => "blocks" in page)) return value as AppManifest;
  if (!("release" in value)) return { project: { publicId: value.project.publicId, name: value.project.name }, release: { id: "preview", version: 0 }, entryPageId: value.project.entryPageId, pages: value.pages.map((page) => ({ id: page.id, slug: page.slug, title: page.title, blocks: page.document.blocks })) };
  const backend = value as BackendManifest;
  return {
    project: { publicId: backend.project.publicId, name: backend.project.name },
    release: { id: backend.release.id, version: backend.release.version },
    entryPageId: backend.project.entryPageId,
    pages: backend.pages.map((page) => ({ id: page.id, slug: page.slug, title: page.title, blocks: page.document.blocks })),
  };
}
