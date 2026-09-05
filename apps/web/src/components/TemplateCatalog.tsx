import { ArrowLeft, ArrowRight, ArrowUpRight, Bot, Check, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { BotFlowDocument } from "../../../../src/domain/bot-flow";
import { createFlowFromTemplate, type FlowTemplateId } from "../flow-store";
import { filterScenarios, scenarioCards, scenarioCategories, type ScenarioCard, type ScenarioCategory } from "../template-catalog";
import { FlowSimulator } from "./FlowSimulator";
import { SolutionArtwork } from "./ProductArtwork";
import "../template-catalog.css";

interface Props { onPick: (id: FlowTemplateId) => void; pending?: boolean; showHeading?: boolean }

const RAIL_GAP = 16;

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
  const [active, setActive] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const rail = useRef<HTMLDivElement>(null);
  const settle = useRef<number>(undefined);
  const centred = useRef(0);
  const adjusting = useRef(false);
  const filtered = useMemo(() => filterScenarios(query, category), [query, category]);
  // Three identical copies make the rail endless: once the scroll settles we
  // jump a whole copy back or forward, so it never reaches an end either way.
  const copies = filtered.length >= 3 ? 3 : 1;

  const metrics = () => {
    const element = rail.current;
    const card = element?.firstElementChild as HTMLElement | null;
    if (element == null || card == null || card.offsetWidth === 0 || filtered.length === 0) return null;
    const step = card.offsetWidth + RAIL_GAP;
    return { element, step, set: step * filtered.length };
  };

  const recenter = () => {
    const found = metrics();
    if (found === null || copies === 1) return;
    const { element, set } = found;
    if (element.scrollLeft < set * 0.5) element.scrollLeft += set;
    else if (element.scrollLeft > set * 1.5) element.scrollLeft -= set;
  };

  const sync = () => {
    if (adjusting.current) return; // a correction of our own, not the reader scrolling
    const found = metrics();
    if (found === null) return;
    const { element, step } = found;
    const centre = element.scrollLeft + element.clientWidth / 2;
    const index = Math.round((centre - step / 2) / step);
    centred.current = ((index % filtered.length) + filtered.length) % filtered.length;
    setActive(centred.current);
    clearTimeout(settle.current);
    settle.current = window.setTimeout(recenter, 160);
  };

  /** Where the rail must stand for card `index` of `base` copy to sit in the middle. */
  const offsetFor = (element: HTMLElement, step: number, base: number, index: number) =>
    base + index * step + step / 2 - element.clientWidth / 2;

  // A new filter rebuilds the rail, so the scroll goes back to the middle copy.
  useEffect(() => {
    const found = metrics();
    if (found !== null) found.element.scrollLeft = offsetFor(found.element, found.step, copies === 1 ? 0 : found.set, 0);
    centred.current = 0;
    setActive(0);
    return () => clearTimeout(settle.current);
  }, [query, category, showAll]);

  // A resize — rotation, a window drag, a browser re-snapping after a layout
  // change — moves the middle of the viewport, so the rail is re-aimed at the
  // card that was centred before it.
  useEffect(() => {
    const element = rail.current;
    if (element === null) return;
    // The browser re-snaps after its own layout pass, so the correction is
    // applied again on the next frame to land after it.
    const reaim = () => {
      const apply = () => {
        const found = metrics();
        if (found === null) return;
        // Always land back in the middle copy: the loop then still runs both ways.
        element.scrollLeft = offsetFor(element, found.step, copies === 1 ? 0 : found.set, centred.current);
      };
      adjusting.current = true;
      apply();
      requestAnimationFrame(() => { apply(); requestAnimationFrame(() => { adjusting.current = false; }); });
    };
    const observer = new ResizeObserver(reaim);
    observer.observe(element);
    addEventListener("resize", reaim);
    return () => { observer.disconnect(); removeEventListener("resize", reaim); };
  }, [copies, showAll]);

  function shift(direction: -1 | 1) {
    const found = metrics();
    if (found === null) return;
    found.element.scrollBy({ left: found.step * direction, behavior: "smooth" });
  }

  function jumpTo(index: number) {
    const found = metrics();
    if (found === null) return;
    const { element, step, set } = found;
    const base = copies === 1 ? 0 : Math.floor((element.scrollLeft + element.clientWidth / 2) / set) * set;
    element.scrollTo({ left: offsetFor(element, step, base, index), behavior: "smooth" });
  }

  function reset() { setQuery(""); setCategory("all"); setShowAll(false); }

  function renderCard(card: ScenarioCard, focused: boolean) {
    return <article className={`tcard tcard--${card.accent}${focused ? " is-focused" : ""}`}>
      <button type="button" className="tcard-preview-button" onClick={() => setPreview(createFlowFromTemplate(card.id, card.title))} aria-label={`Посмотреть сценарий «${card.title}»`}><ScenarioThumbnail card={card} /><span className="tcard-preview-hint">Проверить в чате <ArrowUpRight size={14} /></span></button>
      <div className="tcard-content"><span className="tcard-format"><Bot size={13} /> Готовый бот <span>{card.nodeCount} шагов</span></span><h3>{card.title}</h3><p className="tcard-outcome">{card.outcome}</p><p>{card.description}</p><div className="tcard-tags">{card.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><details className="tcard-setup"><summary>Что настроить под себя</summary><p className="tcard-details-description">{card.description}</p><ul>{card.setup.map((item) => <li key={item}>{item}</li>)}</ul></details><div className="tcard-actions"><button className="tcard-look" type="button" onClick={() => setPreview(createFlowFromTemplate(card.id, card.title))}>Посмотреть</button><button className="tcard-use" type="button" disabled={pending} onClick={() => onPick(card.id)}>Использовать <ArrowUpRight size={15} /></button></div></div>
    </article>;
  }

  return <section className="tcatalog" id="scenarios" aria-labelledby={showHeading ? "tcatalog-title" : undefined} aria-label={showHeading ? undefined : "Каталог готовых сценариев"}>
    {showHeading && <header className="tcatalog-heading"><div><span className="tcatalog-eyebrow">Готовые решения</span><h2 id="tcatalog-title">Выберите бота под свою задачу</h2><p>Ветвления, вопросы и ответы уже собраны. Проверьте решение в чате, замените тексты и контакты — и переходите к запуску.</p></div><span className="tcatalog-free"><Check size={14} /> Без Premium</span></header>}
    <div className="tcatalog-tools">
      <label className="tcatalog-search"><Search size={18} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти сценарий: запись, заявки…" aria-label="Поиск готовых сценариев" />{query !== "" && <button type="button" onClick={() => setQuery("")} aria-label="Очистить поиск"><X size={16} /></button>}</label>
      <div className="tcatalog-filters" aria-label="Категории сценариев">{scenarioCategories.map((item) => <button key={item.id} type="button" aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.title}<span>{item.id === "all" ? scenarioCards.length : scenarioCards.filter((card) => card.category === item.id).length}</span></button>)}</div>
    </div>
    <div className="tcatalog-toolbar"><p className="tcatalog-results" role="status">{showAll ? `Показаны все: ${filtered.length}` : `${active + 1} / ${filtered.length}`}{filtered.length !== scenarioCards.length ? ` · Всего решений: ${scenarioCards.length}` : ""}</p>
    {filtered.length > 1 && <div className="tcatalog-pagination">
      {!showAll && <><button type="button" className="tcatalog-arrow" onClick={() => shift(-1)} aria-label="Предыдущее решение" aria-controls="scenario-cards"><ArrowLeft size={18} /></button><button type="button" className="tcatalog-arrow" onClick={() => shift(1)} aria-label="Следующее решение" aria-controls="scenario-cards"><ArrowRight size={18} /></button></>}
      <button type="button" onClick={() => setShowAll((value) => !value)} aria-expanded={showAll} aria-controls="scenario-cards">{showAll ? "Вернуть ленту" : `Посмотреть все (${filtered.length})`}</button>
    </div>}</div>
    {filtered.length === 0 ? <div className="tcatalog-empty"><Search size={28} /><h3>Пока ничего не нашлось</h3><p>Попробуйте другое слово или посмотрите все решения.</p><button type="button" onClick={reset}>Сбросить фильтры</button></div> : showAll
      ? <div className="tcatalog-window"><div className="tcatalog-grid" id="scenario-cards">{filtered.map((card) => <div className="tcard-slot" data-id={card.id} key={card.id}>{renderCard(card, true)}</div>)}</div></div>
      : <div className="tcatalog-rail-wrap">
          <div className="tcatalog-rail" ref={rail} onScroll={sync} tabIndex={0} role="group" aria-label="Готовые сценарии" id="scenario-cards">
            {Array.from({ length: copies }).flatMap((_, copy) => filtered.map((card, index) => (
              <div className="tcard-slot" data-id={`${copy}-${card.id}`} key={`${copy}-${card.id}`} aria-hidden={copies > 1 && copy !== 1} inert={copies > 1 && copy !== 1 ? true : undefined}>
                {renderCard(card, index === active)}
              </div>
            )))}
          </div>
          <div className="tcatalog-dots">{filtered.map((card, index) => <button key={card.id} type="button" className={index === active ? "on" : ""} onClick={() => jumpTo(index)} aria-label={card.title} />)}</div>
        </div>}
    <p className="tcatalog-note">Решения состоят из настоящих редактируемых цепочек KIRA. Обложки объясняют задачу, а кнопка «Посмотреть» запускает рабочий диалог. Записи, заказы и заявки подтверждает ваша команда — без обещаний неподключённых оплат, CRM и автоматических рассылок.</p>
    {preview !== null && <ScenarioPreview flow={preview} onClose={() => setPreview(null)} />}
  </section>;
}
