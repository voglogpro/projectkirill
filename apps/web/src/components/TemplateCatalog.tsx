import { ArrowUpRight, Bot, Check, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const filtered = useMemo(() => filterScenarios(query, category), [query, category]);
  function reset() { setQuery(""); setCategory("all"); }
  return <section className="tcatalog" id="scenarios" aria-labelledby={showHeading ? "tcatalog-title" : undefined} aria-label={showHeading ? undefined : "Каталог готовых сценариев"}>
    {showHeading && <header className="tcatalog-heading"><div><span className="tcatalog-eyebrow">Готовые решения</span><h2 id="tcatalog-title">Выберите бота под свою задачу</h2><p>Ветвления, вопросы и ответы уже собраны. Проверьте решение в чате, замените тексты и контакты — и переходите к запуску.</p></div><span className="tcatalog-free"><Check size={14} /> Без Premium</span></header>}
    <div className="tcatalog-tools">
      <label className="tcatalog-search"><Search size={18} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти сценарий: запись, заявки…" aria-label="Поиск готовых сценариев" />{query !== "" && <button type="button" onClick={() => setQuery("")} aria-label="Очистить поиск"><X size={16} /></button>}</label>
      <div className="tcatalog-filters" aria-label="Категории сценариев">{scenarioCategories.map((item) => <button key={item.id} type="button" aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.title}<span>{item.id === "all" ? scenarioCards.length : scenarioCards.filter((card) => card.category === item.id).length}</span></button>)}</div>
    </div>
    <p className="tcatalog-results" role="status">Показано: {filtered.length} из {scenarioCards.length}</p>
    {filtered.length === 0 ? <div className="tcatalog-empty"><Search size={28} /><h3>Пока ничего не нашлось</h3><p>Попробуйте другое слово или посмотрите все решения.</p><button type="button" onClick={reset}>Сбросить фильтры</button></div> : <div className="tcatalog-grid">{filtered.map((card) => <article className={`tcard tcard--${card.accent}`} key={card.id}>
      <button type="button" className="tcard-preview-button" onClick={() => setPreview(createFlowFromTemplate(card.id, card.title))} aria-label={`Посмотреть сценарий «${card.title}»`}><ScenarioThumbnail card={card} /><span className="tcard-preview-hint">Проверить в чате <ArrowUpRight size={14} /></span></button>
      <div className="tcard-content"><span className="tcard-format"><Bot size={13} /> Готовый бот <span>{card.nodeCount} шагов</span></span><h3>{card.title}</h3><p className="tcard-outcome">{card.outcome}</p><p>{card.description}</p><div className="tcard-tags">{card.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><details className="tcard-setup"><summary>Что настроить под себя</summary><ul>{card.setup.map((item) => <li key={item}>{item}</li>)}</ul></details><div className="tcard-actions"><button className="tcard-look" type="button" onClick={() => setPreview(createFlowFromTemplate(card.id, card.title))}>Посмотреть</button><button className="tcard-use" type="button" disabled={pending} onClick={() => onPick(card.id)}>Использовать <ArrowUpRight size={15} /></button></div></div>
    </article>)}</div>}
    <p className="tcatalog-note">Решения состоят из настоящих редактируемых цепочек KIRA. Обложки объясняют задачу, а кнопка «Посмотреть» запускает рабочий диалог. Записи, заказы и заявки подтверждает ваша команда — без обещаний неподключённых оплат, CRM и автоматических рассылок.</p>
    {preview !== null && <ScenarioPreview flow={preview} onClose={() => setPreview(null)} />}
  </section>;
}
