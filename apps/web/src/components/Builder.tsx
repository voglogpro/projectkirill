import { ArrowLeft, Box, ChevronDown, Eye, FileText, GripVertical, Heading1, Image, LayoutGrid, MessageSquareText, MousePointerClick, Plus, Redo2, Save, Send, ShoppingBag, Smartphone, Trash2, Undo2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createBlock, saveProject } from "../store";
import type { BuilderBlock, BlockType, ProjectState } from "../types";
import { PhonePreview } from "./PhonePreview";

const blockCatalog: { type: BlockType; title: string; icon: typeof Heading1 }[] = [
  { type: "heading", title: "Заголовок", icon: Heading1 }, { type: "text", title: "Текст", icon: MessageSquareText }, { type: "button", title: "Кнопка", icon: MousePointerClick }, { type: "media", title: "Изображение", icon: Image }, { type: "product", title: "Товар", icon: ShoppingBag }, { type: "form", title: "Форма", icon: Send },
];

export function Builder({ initialProject, onChange, onBack, onLaunch: launchProject }: { initialProject: ProjectState; onChange: (project: ProjectState) => void; onBack: () => void; onLaunch: (project: ProjectState) => void }) {
  const [project, setProject] = useState(initialProject);
  const [selectedId, setSelectedId] = useState<string | undefined>(project.pages[0]?.blocks[0]?.id);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const page = project.pages[0]!;
  const selected = page.blocks.find((block) => block.id === selectedId);
  const onLaunch = () => launchProject(project);
  useEffect(() => { const timer = setTimeout(() => { saveProject(project); onChange(project); }, 250); return () => clearTimeout(timer); }, [project, onChange]);
  const savedLabel = useMemo(() => "Все изменения сохранены", [project]);

  function setBlocks(blocks: BuilderBlock[]) { setProject((current) => ({ ...current, pages: current.pages.map((item, index) => index === 0 ? { ...item, blocks } : item) })); }
  function addBlock(type: BlockType) { const block = createBlock(type); setBlocks([...page.blocks, block]); setSelectedId(block.id); }
  function updateProp(key: string, value: unknown) { if (!selected) return; setBlocks(page.blocks.map((block) => block.id === selected.id ? { ...block, props: { ...block.props, [key]: value } } : block)); }
  function removeSelected() { if (!selected) return; setBlocks(page.blocks.filter((block) => block.id !== selected.id)); setSelectedId(undefined); }

  return <div className="builder"><header className="builder-top"><div><button className="icon-button" onClick={onBack}><ArrowLeft /></button><button className="project-switcher"><span className="project-dot">M</span><span><b>{project.name}</b><small>{savedLabel}</small></span><ChevronDown /></button></div><div className="history-buttons"><button disabled><Undo2 /></button><button disabled><Redo2 /></button><span /></div><div><button className="outline-button"><Eye />Предпросмотр</button><button className="primary-button" onClick={onLaunch}><RocketIcon />Запустить</button></div></header>
    <div className="builder-body"><aside className="builder-left"><div className="builder-tabs"><button className="active"><Plus />Добавить</button><button><FileText />Страницы</button><button><LayoutGrid />Секции</button></div><div className="block-library"><span className="label">БАЗОВЫЕ БЛОКИ</span><div className="block-grid">{blockCatalog.map(({ type, title, icon: Icon }) => <button key={type} onClick={() => addBlock(type)}><span><Icon /></span>{title}</button>)}</div><span className="label">СТРУКТУРА СТРАНИЦЫ</span><div className="layer-list">{page.blocks.map((block) => <button key={block.id} className={block.id === selectedId ? "active" : ""} onClick={() => setSelectedId(block.id)}><GripVertical /><span>{blockCatalog.find((x) => x.type === block.type)?.title}</span></button>)}</div></div></aside>
      <main className={`canvas ${theme}`}><div className="canvas-toolbar"><div><button className="active"><Smartphone />Телефон</button></div><div className="theme-toggle"><button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}>Светлая</button><button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}>Тёмная</button></div></div><PhonePreview page={page} selectedId={selectedId} onSelect={setSelectedId} /></main>
      <aside className="inspector">{selected ? <><div className="inspector-title"><div><span className="inspector-icon"><Box /></span><span><b>{blockCatalog.find((x) => x.type === selected.type)?.title}</b><small>Настройки блока</small></span></div><button className="icon-button danger" onClick={removeSelected}><Trash2 /></button></div><InspectorFields block={selected} update={updateProp} /><div className="inspector-tip"><span>✦</span><p><b>Совет</b>Короткий и конкретный текст лучше работает внутри Telegram.</p></div></> : <div className="empty-inspector"><MousePointerClick /><h3>Выберите блок</h3><p>Нажмите на элемент в телефоне, чтобы изменить его.</p></div>}</aside>
    </div></div>;
}

function InspectorFields({ block, update }: { block: BuilderBlock; update: (key: string, value: unknown) => void }) {
  const p = block.props;
  if (block.type === "heading") return <div className="fields"><Field label="Текст"><textarea value={String(p.text ?? "")} onChange={(e) => update("text", e.target.value)} /></Field><Field label="Размер"><select value={Number(p.level ?? 2)} onChange={(e) => update("level", Number(e.target.value))}><option value="1">Большой</option><option value="2">Средний</option><option value="3">Маленький</option></select></Field><Field label="Выравнивание"><div className="segmented"><button className={p.align === "start" ? "active" : ""} onClick={() => update("align", "start")}>Слева</button><button className={p.align === "center" ? "active" : ""} onClick={() => update("align", "center")}>Центр</button></div></Field></div>;
  if (block.type === "text") return <div className="fields"><Field label="Текст"><textarea rows={7} value={String(p.markdown ?? "")} onChange={(e) => update("markdown", e.target.value)} /></Field></div>;
  if (block.type === "button") return <div className="fields"><Field label="Текст кнопки"><input value={String(p.label ?? "")} onChange={(e) => update("label", e.target.value)} /></Field><Field label="Действие"><select><option>Открыть ссылку</option><option>Перейти на страницу</option><option>Открыть Telegram</option></select></Field></div>;
  if (block.type === "product") return <div className="fields"><Field label="Название"><input value={String(p.title ?? "")} onChange={(e) => update("title", e.target.value)} /></Field><Field label="Описание"><textarea value={String(p.description ?? "")} onChange={(e) => update("description", e.target.value)} /></Field></div>;
  if (block.type === "form") return <div className="fields"><Field label="Текст кнопки"><input value={String(p.submitLabel ?? "")} onChange={(e) => update("submitLabel", e.target.value)} /></Field><div className="form-fields-summary"><b>Поля формы</b><span>Имя</span><span>Телефон</span><button><Plus />Добавить поле</button></div></div>;
  return <div className="fields"><div className="upload-box"><Image /><b>Загрузите изображение</b><p>PNG, JPG или WebP до 10 МБ</p><button>Выбрать файл</button></div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
function RocketIcon() { return <Save size={17} />; }
