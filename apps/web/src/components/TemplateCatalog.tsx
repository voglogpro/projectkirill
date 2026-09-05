import { ArrowUpRight, Bot, Check, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { BotFlowDocument } from "../../../../src/domain/bot-flow";
import { createFlowFromTemplate, type FlowTemplateId } from "../flow-store";
import { filterScenarios, scenarioCards, scenarioCategories, type ScenarioCard, type ScenarioCategory } from "../template-catalog";
import { FlowSimulator } from "./FlowSimulator";
import "../template-catalog.css";

interface Props { onPick: (id: FlowTemplateId) => void; pending?: boolean; showHeading?: boolean }

function ScenarioPreview({ flow, onClose }: { flow: BotFlowDocument; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const siblings = Array.from(document.body.children).filter((node): node is HTMLElement => node instanceof HTMLElement && node !== root.current);
    const previousInert = siblings.map((node) => node.inert);
    siblings.forEach((node) => { node.inert = true; });
    root.current?.querySelector<HTMLElement>('button[aria-label="Закрыть"]')?.focus();
    function trapFocus(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const elements = Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]') ?? []).filter((element) => element.getClientRects().length > 0);
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && (document.activeElement === first || !root.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !root.current?.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", trapFocus);
    return () => {
      document.removeEventListener("keydown", trapFocus);
      document.body.style.overflow = previousOverflow;
      siblings.forEach((node, index) => { node.inert = previousInert[index] ?? false; });
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(<div ref={root} className="tcatalog-preview-root"><FlowSimulator flow={flow} onClose={onClose} /></div>, document.body);
}

/** A small illustration of the actual first message, not a fabricated product screenshot. */
function ScenarioThumbnail({ card }: { card: ScenarioCard }) {
  const flow = useMemo(() => createFlowFromTemplate(card.id, card.title), [card.id, card.title]);
  const greeting = flow.nodes.find((node) => node.type === "message");
  if (greeting?.type !== "message") return null;
  return <div className={`tcard-visual tcard-visual--${card.accent}`} aria-hidden="true">
    <div className="tcard-chat"><div className="tcard-chat-head"><span><Bot size={15} /></span><b>Ваш бот</b><i /></div>
      <div className="tcard-bubble">{greeting.props.text}</div>
      <div className="tcard-chat-buttons">{greeting.props.buttons.slice(0, 2).map((button) => <span key={button.id}>{button.label}</span>)}</div>
      <div className="tcard-chat-reply"><Check size={11} /> Сценарий готов к настройке</div>
    </div>
  </div>;
}

export function TemplateCatalog({ onPick, pending = false, showHeading = true }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ScenarioCategory>("all");
  const [preview, setPreview] = useState<BotFlowDocument | null>(null);
  const filtered = useMemo(() => filterScenarios(query, category), [query, category]);
  function reset() { setQuery(""); setCategory("all"); }
  return <section className="tcatalog" id="scenarios" aria-labelledby={showHeading ? "tcatalog-title" : undefined} aria-label={showHeading ? undefined : "Каталог готовых сценариев"}>
    {showHeading && <header className="tcatalog-heading"><div><span className="tcatalog-eyebrow">Готовые сценарии</span><h2 id="tcatalog-title">Выберите основу для своего бота</h2><p>Посмотрите, как бот отвечает, и откройте сценарий в конструкторе. Тексты и связи можно менять бесплатно.</p></div><span className="tcatalog-free"><Check size={14} /> Без Premium</span></header>}
    <div className="tcatalog-tools">
      <label className="tcatalog-search"><Search size={18} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти сценарий: запись, заявки…" aria-label="Поиск готовых сценариев" />{query !== "" && <button type="button" onClick={() => setQuery("")} aria-label="Очистить поиск"><X size={16} /></button>}</label>
      <div className="tcatalog-filters" aria-label="Категории сценариев">{scenarioCategories.map((item) => <button key={item.id} type="button" aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.title}<span>{item.id === "all" ? scenarioCards.length : scenarioCards.filter((card) => card.category === item.id).length}</span></button>)}</div>
    </div>
    <p className="tcatalog-results" role="status">Показано: {filtered.length} из {scenarioCards.length}</p>
    {filtered.length === 0 ? <div className="tcatalog-empty"><Search size={28} /><h3>Пока ничего не нашлось</h3><p>Попробуйте другое слово или посмотрите все сценарии.</p><button type="button" onClick={reset}>Сбросить фильтры</button></div> : <div className="tcatalog-grid">{filtered.map((card) => <article className="tcard" key={card.id}>
      <button type="button" className="tcard-preview-button" onClick={() => setPreview(createFlowFromTemplate(card.id, card.title))} aria-label={`Посмотреть сценарий «${card.title}»`}><ScenarioThumbnail card={card} /><span className="tcard-preview-hint">Проверить в чате <ArrowUpRight size={14} /></span></button>
      <div className="tcard-content"><span className="tcard-format"><Bot size={13} /> Telegram-бот</span><h3>{card.title}</h3><p>{card.description}</p><div className="tcard-tags">{card.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><div className="tcard-actions"><button className="tcard-look" type="button" onClick={() => setPreview(createFlowFromTemplate(card.id, card.title))}>Посмотреть</button><button className="tcard-use" type="button" disabled={pending} onClick={() => onPick(card.id)}>Использовать <ArrowUpRight size={15} /></button></div></div>
    </article>)}</div>}
    <p className="tcatalog-note">Это редактируемые сценарии KIRA, а не архивы сторонних программ. Для запуска: настройте тексты, подключите своего бота и выберите хостинг. Оплата нужна только при публикации.</p>
    {preview !== null && <ScenarioPreview flow={preview} onClose={() => setPreview(null)} />}
  </section>;
}
