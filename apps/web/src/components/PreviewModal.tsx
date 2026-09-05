import { X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ProjectState } from "../types";
import { PhonePreview } from "./PhonePreview";

export function PreviewModal({ project, onClose }: { project: ProjectState; onClose: () => void }) {
  const [pageId, setPageId] = useState(project.activePageId ?? project.pages[0]?.id);
  const [mode, setMode] = useState<"miniapp" | "site">(project.kit === "site" ? "site" : "miniapp");
  const page = project.pages.find((item) => item.id === pageId) ?? project.pages[0];
  useEffect(() => { const overflow = document.body.style.overflow; const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; document.body.style.overflow = "hidden"; addEventListener("keydown", close); return () => { document.body.style.overflow = overflow; removeEventListener("keydown", close); }; }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className={`preview-modal ${mode === "site" ? "preview-modal-site" : ""}`} role="dialog" aria-modal="true" aria-label="Предпросмотр приложения"><button className="modal-close" onClick={onClose} aria-label="Закрыть"><X /></button><div className="preview-modal-head"><div><span>БЕСПЛАТНЫЙ ПРЕДПРОСМОТР</span><h2>{project.name}</h2></div><select aria-label="Страница предпросмотра" name="preview-page" value={pageId} onChange={(event) => setPageId(event.target.value)}>{project.pages.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div><div className="preview-mode-switch"><button aria-pressed={mode === "miniapp"} onClick={() => setMode("miniapp")}>Mini App</button><button aria-pressed={mode === "site"} onClick={() => setMode("site")}>Сайт</button></div>{page ? <PhonePreview page={page} projectName={project.name} selectedId={undefined} onSelect={() => undefined} interactive onNavigate={setPageId} mode={mode} /> : <p>Добавьте первую страницу.</p>}</div></div>;
}
