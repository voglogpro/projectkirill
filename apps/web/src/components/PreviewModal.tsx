import { X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ProjectState } from "../types";
import { PhonePreview } from "./PhonePreview";

export function PreviewModal({ project, onClose }: { project: ProjectState; onClose: () => void }) {
  const [pageId, setPageId] = useState(project.activePageId ?? project.pages[0]?.id);
  const page = project.pages.find((item) => item.id === pageId) ?? project.pages[0];
  useEffect(() => { const overflow = document.body.style.overflow; const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; document.body.style.overflow = "hidden"; addEventListener("keydown", close); return () => { document.body.style.overflow = overflow; removeEventListener("keydown", close); }; }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="preview-modal" role="dialog" aria-modal="true" aria-label="Предпросмотр приложения"><button className="modal-close" onClick={onClose} aria-label="Закрыть"><X /></button><div className="preview-modal-head"><div><span>ИНТЕРАКТИВНЫЙ PREVIEW</span><h2>{project.name}</h2></div><select value={pageId} onChange={(event) => setPageId(event.target.value)}>{project.pages.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div>{page ? <PhonePreview page={page} projectName={project.name} selectedId={undefined} onSelect={() => undefined} interactive onNavigate={setPageId} /> : <p>Добавьте первую страницу.</p>}</div></div>;
}
