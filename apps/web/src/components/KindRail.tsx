import { ArrowRight, Bot, CalendarDays, ChevronLeft, ChevronRight, GraduationCap, Lock, MessageSquareText, ShoppingBag, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FlowTemplateId } from "../flow-store";

/**
 * The product is a constructor for any bot, not a support desk — so the page
 * leads with what people build, and every kind carries its own colour.
 */
type Kind = {
  id: string; icon: typeof Bot; title: string; text: string; problem: string;
  demo: [string, string]; ready: boolean; template: FlowTemplateId;
};

export const kinds: Kind[] = [
  { id: "leads", icon: Users, title: "Заявки и лиды", text: "Спросит имя и телефон, проверит ответ и сложит контакты в кабинет.", problem: "Заявки теряются в переписке и в заметках на телефоне", demo: ["Оставьте телефон — перезвоним в течение часа", "+7 900 123-45-67"], ready: true, template: "leads" },
  { id: "booking", icon: CalendarDays, title: "Онлайн-запись", text: "Клиент выбирает услугу и время кнопками — вы только подтверждаете.", problem: "Запись съедает вечер: созвоны, переносы, «а когда свободно?»", demo: ["На какую услугу записать?", "Стрижка, завтра в 15:00"], ready: true, template: "booking" },
  { id: "shop", icon: ShoppingBag, title: "Магазин и витрина", text: "Разделы, цены, карточки товаров и переход к заказу прямо в чате.", problem: "Каталог рассылаете скриншотами, а цены — по одной", demo: ["Что показать: цены или доставку?", "Цены"], ready: true, template: "catalog" },
  { id: "support", icon: MessageSquareText, title: "Поддержка и вопросы", text: "Частые вопросы кнопками, сложные — живому оператору.", problem: "Каждый день отвечаете на одни и те же пять вопросов", demo: ["Часы работы, цены или позвать человека?", "Часы работы"], ready: true, template: "faq" },
  { id: "course", icon: GraduationCap, title: "Курс и обучение", text: "Уроки по расписанию, проверка заданий, доступ после оплаты.", problem: "Ученики теряются между уроками, а материалы — в чате", demo: ["Урок 3 открыт. Готовы продолжить?", "Да, поехали"], ready: false, template: "blank" },
  { id: "club", icon: Lock, title: "Закрытый клуб", text: "Заявки в канал, анкета на входе и доступ только своим.", problem: "В канал лезут случайные люди, а проверять некому", demo: ["Пара вопросов — и мы вас впустим", "Готов ответить"], ready: false, template: "blank" },
];

/** Kinds of bot, swiped sideways like an endless deck of cards. */
const RAIL_GAP = 16;
const COPIES = 3;

export function KindRail({ onPick }: { onPick: (template: FlowTemplateId) => void }) {
  const rail = useRef<HTMLDivElement>(null);
  const settle = useRef<number>(undefined);
  const [active, setActive] = useState(0);

  const metrics = () => {
    const element = rail.current;
    const card = element?.firstElementChild as HTMLElement | null;
    if (element == null || card == null || card.offsetWidth === 0) return null;
    const step = card.offsetWidth + RAIL_GAP;
    return { element, step, set: step * kinds.length };
  };

  // Three identical copies of the deck; once the scroll settles we jump a whole
  // copy back or forward, so the rail never reaches an end in either direction.
  const recenter = () => {
    const found = metrics();
    if (found === null) return;
    const { element, set } = found;
    if (element.scrollLeft < set * 0.5) element.scrollLeft += set;
    else if (element.scrollLeft > set * 1.5) element.scrollLeft -= set;
  };

  const sync = () => {
    const found = metrics();
    if (found === null) return;
    const { element, step } = found;
    const centre = element.scrollLeft + element.clientWidth / 2;
    const index = Math.round((centre - step / 2) / step);
    setActive(((index % kinds.length) + kinds.length) % kinds.length);
    clearTimeout(settle.current);
    settle.current = window.setTimeout(recenter, 160);
  };

  useEffect(() => {
    const found = metrics();
    if (found !== null) found.element.scrollLeft = found.set;
    sync();
    return () => clearTimeout(settle.current);
  }, []);

  const nudge = (direction: 1 | -1) => {
    const found = metrics();
    if (found === null) return;
    found.element.scrollBy({ left: found.step * direction, behavior: "smooth" });
  };

  const jumpTo = (index: number) => {
    const found = metrics();
    if (found === null) return;
    const { element, step, set } = found;
    const base = Math.floor(element.scrollLeft / set) * set;
    element.scrollTo({ left: base + index * step, behavior: "smooth" });
  };

  return <div className="kind-rail-wrap">
    <div className="kind-rail" ref={rail} onScroll={sync} tabIndex={0} role="group" aria-label="Что можно собрать">
      {Array.from({ length: COPIES }).flatMap((_, copy) => kinds.map(({ id, icon: Icon, title, text, problem, demo, ready, template }, index) => (
        <button
          key={`${copy}-${id}`}
          className={`kind kind-${id} ${index === active ? "is-active" : ""}`}
          aria-hidden={copy !== 1}
          tabIndex={copy === 1 ? 0 : -1}
          onClick={() => onPick(template)}
        >
          <span className="kind-icon"><Icon /></span>
          <b>{title}</b>
          <p>{text}</p>
          <p className="kind-problem"><em>Закрывает</em>{problem}</p>
          <span className="kind-demo">
            <span className="bot">{demo[0]}</span>
            <span className="me">{demo[1]}</span>
          </span>
          <span className="kind-go">{ready ? "Взять сценарий" : "Собрать с нуля"} <ArrowRight size={14} /></span>
        </button>
      )))}
    </div>

    <div className="kind-nav">
      <button className="rail-arrow" onClick={() => nudge(-1)} aria-label="Предыдущая задача"><ChevronLeft size={18} /></button>
      <div className="rail-dots">{kinds.map((kind, index) => <button key={kind.id} className={index === active ? "on" : ""} onClick={() => jumpTo(index)} aria-label={kind.title} />)}</div>
      <button className="rail-arrow" onClick={() => nudge(1)} aria-label="Следующая задача"><ChevronRight size={18} /></button>
    </div>
  </div>;
}

