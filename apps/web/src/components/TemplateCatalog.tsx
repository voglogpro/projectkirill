import { ArrowLeft, ArrowRight, ArrowUpRight, Bot, Check, Search, X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { BotFlowDocument } from "../../../../src/domain/bot-flow";
import { createFlowFromTemplate, type FlowTemplateId } from "../flow-store";
import { filterScenarios, scenarioCards, scenarioCategories, type ScenarioCard, type ScenarioCategory } from "../template-catalog";
import { FlowSimulator } from "./FlowSimulator";
import { SolutionArtwork } from "./ProductArtwork";
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

/** Recognizable task-specific artwork: explanatory diagrams, not invented product screenshots. */
function ScenarioThumbnail({ card }: { card: ScenarioCard }) {
  return <div className={`tcard-visual tcard-visual--${card.accent}`} aria-hidden="true">
    <SolutionArtwork kind={card.artwork} />
  </div>;
}

export function TemplateCatalog({ onPick, pending = false, showHeading = true }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ScenarioCategory>("all");
  const [preview, setPreview] = useState<BotFlowDocument | null>(null);
  const [position, setPosition] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [highlighted, setHighlighted] = useState<FlowTemplateId | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const track = useRef<HTMLDivElement>(null);
  const movement = useRef<{ positions: Map<string, number>; direction: number } | null>(null);
  const animations = useRef<Animation[]>([]);
  const filtered = useMemo(() => filterScenarios(query, category), [query, category]);
  const hasNeighbors = filtered.length >= 3;
  // Position always identifies the central solution, with its previous/next neighbours around it.
  const visible = showAll ? filtered : Array.from({ length: Math.min(3, filtered.length) }, (_, index) => filtered[(position + index - (hasNeighbors ? 1 : 0) + filtered.length) % filtered.length]!);
  const focusedId = highlighted ?? filtered[position]?.id;
  // FLIP preserves the two shared cards and slides the incoming card from beyond the edge.
  // Animate translate independently of the hover scale; reduced-motion gets an instant change.
  useLayoutEffect(() => {
    const change = movement.current;
    movement.current = null;
    if (!change || showAll || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const slots = Array.from(track.current?.querySelectorAll<HTMLElement>(".tcard-slot") ?? []);
    const step = slots.length > 1 ? slots[1]!.offsetLeft - slots[0]!.offsetLeft : 0;
    animations.current = slots.map((slot) => {
      const x = slot.getBoundingClientRect().left;
      const dx = (change.positions.get(slot.dataset.id!) ?? x + change.direction * step) - x;
      return slot.animate([{ translate: `${dx}px 0` }, { translate: "0px 0" }], { duration: 360, easing: "cubic-bezier(.22,.68,0,1)" });
    });
  }, [position, showAll, filtered]);
  useEffect(() => () => animations.current.forEach((animation) => animation.cancel()), []);
  function stopMovement() { movement.current = null; animations.current.forEach((animation) => animation.cancel()); }
  function resetView() { stopMovement(); setPosition(0); setShowAll(false); setHighlighted(null); }
  function reset() { setQuery(""); setCategory("all"); resetView(); }
  function shift(direction: -1 | 1) {
    if (filtered.length <= 1 || showAll) return;
    movement.current = { direction, positions: new Map(Array.from(track.current?.querySelectorAll<HTMLElement>(".tcard-slot") ?? []).map((slot) => [slot.dataset.id!, slot.getBoundingClientRect().left])) };
    animations.current.forEach((animation) => animation.cancel());
    setPosition((value) => (value + direction + filtered.length) % filtered.length);
    setHighlighted(null);
  }
  function toggleAll() {
    stopMovement();
    setShowAll((value) => !value);
    setHighlighted(null);
  }
  return <section className="tcatalog" id="scenarios" aria-labelledby={showHeading ? "tcatalog-title" : undefined} aria-label={showHeading ? undefined : "Каталог готовых сценариев"}>
    {showHeading && <header className="tcatalog-heading"><div><span className="tcatalog-eyebrow">Готовые решения</span><h2 id="tcatalog-title">Выберите бота под свою задачу</h2><p>Ветвления, вопросы и ответы уже собраны. Проверьте решение в чате, замените тексты и контакты — и переходите к запуску.</p></div><span className="tcatalog-free"><Check size={14} /> Без Premium</span></header>}
    <div className="tcatalog-tools">
      <label className="tcatalog-search"><Search size={18} /><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); resetView(); }} placeholder="Найти сценарий: запись, заявки…" aria-label="Поиск готовых сценариев" />{query !== "" && <button type="button" onClick={() => { setQuery(""); resetView(); }} aria-label="Очистить поиск"><X size={16} /></button>}</label>
      <div className="tcatalog-filters" aria-label="Категории сценариев">{scenarioCategories.map((item) => <button key={item.id} type="button" aria-pressed={category === item.id} onClick={() => { setCategory(item.id); resetView(); }}>{item.title}<span>{item.id === "all" ? scenarioCards.length : scenarioCards.filter((card) => card.category === item.id).length}</span></button>)}</div>
    </div>
    <div className="tcatalog-toolbar"><p className="tcatalog-results" role="status">Показано: {visible.length} из {filtered.length}{filtered.length !== scenarioCards.length ? ` · Всего решений: ${scenarioCards.length}` : ""}</p>
    {filtered.length > 1 && <div className="tcatalog-pagination">
      {!showAll && <><button type="button" className="tcatalog-arrow" onClick={() => shift(-1)} aria-label="Предыдущие решения" aria-controls="scenario-cards"><ArrowLeft size={18} /></button><span className="tcatalog-position" aria-live="polite">{position + 1} / {filtered.length}</span><button type="button" className="tcatalog-arrow" onClick={() => shift(1)} aria-label="Следующие решения" aria-controls="scenario-cards"><ArrowRight size={18} /></button></>}
      <button type="button" onClick={toggleAll} aria-expanded={showAll} aria-controls="scenario-cards">{showAll ? "Вернуть ленту" : `Посмотреть все (${filtered.length})`}</button>
    </div>}</div>
    {filtered.length === 0 ? <div className="tcatalog-empty"><Search size={28} /><h3>Пока ничего не нашлось</h3><p>Попробуйте другое слово или посмотрите все решения.</p><button type="button" onClick={reset}>Сбросить фильтры</button></div> : <div className={showAll ? "tcatalog-window" : "tcatalog-window is-carousel-window"}><div ref={track} className={`tcatalog-grid${showAll ? "" : ` is-carousel${hasNeighbors ? " has-neighbors" : ""}`}`} style={showAll ? undefined : { gridTemplateColumns: `repeat(${Math.min(3, filtered.length)}, minmax(0, 1fr))` }} id="scenario-cards"
      onPointerLeave={() => setHighlighted(null)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHighlighted(null); }}
      onTouchStart={(event) => { const touch = event.touches[0]; touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null; swiped.current = false; }}
      onTouchEnd={(event) => { const start = touchStart.current, end = event.changedTouches[0]; touchStart.current = null; if (!start || !end || showAll) return; const dx = end.clientX - start.x, dy = end.clientY - start.y; if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) { swiped.current = true; shift(dx < 0 ? 1 : -1); } }}
      onTouchCancel={() => { touchStart.current = null; }}
      onClickCapture={(event) => { if (swiped.current) { event.preventDefault(); event.stopPropagation(); swiped.current = false; } }}
    >{visible.map((card) => <div className="tcard-slot" data-id={card.id} key={card.id}><article className={`tcard tcard--${card.accent}${showAll || card.id === focusedId ? " is-focused" : ""}`}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setHighlighted(card.id); }}
      onPointerDown={() => setHighlighted(card.id)}
      onFocusCapture={() => setHighlighted(card.id)}
    >
      <button type="button" className="tcard-preview-button" onClick={() => setPreview(createFlowFromTemplate(card.id, card.title))} aria-label={`Посмотреть сценарий «${card.title}»`}><ScenarioThumbnail card={card} /><span className="tcard-preview-hint">Проверить в чате <ArrowUpRight size={14} /></span></button>
      <div className="tcard-content"><span className="tcard-format"><Bot size={13} /> Готовый бот <span>{card.nodeCount} шагов</span></span><h3>{card.title}</h3><p className="tcard-outcome">{card.outcome}</p><p>{card.description}</p><div className="tcard-tags">{card.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><details className="tcard-setup"><summary>Что настроить под себя</summary><p className="tcard-details-description">{card.description}</p><ul>{card.setup.map((item) => <li key={item}>{item}</li>)}</ul></details><div className="tcard-actions"><button className="tcard-look" type="button" onClick={() => setPreview(createFlowFromTemplate(card.id, card.title))}>Посмотреть</button><button className="tcard-use" type="button" disabled={pending} onClick={() => onPick(card.id)}>Использовать <ArrowUpRight size={15} /></button></div></div>
    </article></div>)}</div></div>}
    <p className="tcatalog-note">Решения состоят из настоящих редактируемых цепочек KIRA. Обложки объясняют задачу, а кнопка «Посмотреть» запускает рабочий диалог. Записи, заказы и заявки подтверждает ваша команда — без обещаний неподключённых оплат, CRM и автоматических рассылок.</p>
    {preview !== null && <ScenarioPreview flow={preview} onClose={() => setPreview(null)} />}
  </section>;
}
