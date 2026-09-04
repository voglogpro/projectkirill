import { ArrowRight, Bot, Check, ChevronLeft, ChevronRight, Globe, LayoutGrid, MessageSquareText, Rocket, Smartphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FlowTemplateId } from "../flow-store";
import type { ProductKit } from "../types";
import { KindRail } from "./KindRail";

/**
 * The screen behind the door. It reads top-down the way the owner works:
 * what you already started, what you can build now, what is half-ready to
 * take, and only then how any of it is put together.
 */
type Kit = {
  id: ProductKit; icon: typeof Bot; title: string; text: string;
  gain: string; price: string; note: string; parts: string[]; best?: boolean;
};

const kits: Kit[] = [
  {
    id: "bot", icon: MessageSquareText, title: "Текстовый бот",
    text: "Разговор в Telegram: сообщения, кнопки, вопросы, развилки.",
    gain: "Отвечает ночью и в выходные, а заявки не теряются в переписке — они складываются в кабинет.",
    price: "350 ₽", note: "в месяц", parts: ["Бот"],
  },
  {
    id: "bot-app", icon: Smartphone, title: "Бот и Mini App",
    text: "К разговору добавляются экраны внутри Telegram: каталог, карточки, форма.",
    gain: "Клиент видит витрину и оформляет заказ, не выходя из чата. Каталог больше не рассылают скриншотами.",
    price: "650 ₽", note: "в месяц", parts: ["Бот", "Mini App"],
  },
  {
    id: "bot-app-site", icon: LayoutGrid, title: "Бот, Mini App и сайт",
    text: "Всё вместе: те же экраны ещё и по обычной ссылке.",
    gain: "Одна витрина работает и в Telegram, и в браузере. Поменяли цену один раз — поменялась везде.",
    price: "650 ₽", note: "в месяц", parts: ["Бот", "Mini App", "Сайт"], best: true,
  },
  {
    id: "site", icon: Globe, title: "Только сайт",
    text: "Страница по обычной ссылке без Telegram-бота. Собирается теми же блоками.",
    gain: "Визитка, которую можно поправить за минуту самому — без верстальщика и без хостинга на стороне.",
    price: "350 ₽", note: "в месяц", parts: ["Сайт"],
  },
];

const guides = [
  {
    icon: MessageSquareText, title: "Как собирается текстовый бот", accent: "a",
    steps: ["Берёте готовый сценарий — заявки, запись, магазин, поддержка.", "На холсте правите карточки: карточка — это сообщение, стрелка — переход.", "Добавляете кнопки в сообщение, и от каждой кнопки тянется своя стрелка.", "Жмёте «Проверить в чате», а потом «Запустить» — токен и хостинг берём мы."],
  },
  {
    icon: Smartphone, title: "Как собирается Mini App", accent: "b",
    steps: ["Экран собирается блоками: заголовок, текст, картинка, кнопка, товар, форма.", "Блоки складываются сверху вниз, порядок меняется стрелками.", "Рядом настраиваются свойства выбранного блока — текст, цвет кнопки, поля формы.", "После публикации бот открывает Mini App кнопкой меню."],
  },
  {
    icon: Globe, title: "Как собирается сайт", accent: "c",
    steps: ["Сайт — те же страницы и те же блоки, что и Mini App.", "Отдельно верстать ничего не нужно: контент один.", "Ссылка вида /s/ваш-проект открывается в любом браузере.", "Поменяли текст в кабинете и опубликовали — обновилось и в Telegram, и на сайте."],
  },
];

export function StartHub({ projects, onPick, onTemplate, onOpenProject, onSkip }: {
  projects: Array<{ id: string; name: string }>;
  onPick: (kit: ProductKit) => void;
  onTemplate: (template: FlowTemplateId) => void;
  onOpenProject: (id: string) => void;
  onSkip: () => void;
}) {
  return <main className="hub">
    <header>
      <span className="brand bare"><span className="brand-mark"><Bot /></span>KIRA</span>
      <button className="back-link" onClick={onSkip}>В кабинет <ArrowRight /></button>
    </header>

    <section>
      {projects.length > 0 && <div className="hub-block hub-projects">
        <div className="hub-caption"><span>ВАШИ ПРОЕКТЫ</span><h2>Продолжить начатое</h2></div>
        <div className="project-cards">
          {projects.map((project) => <button key={project.id} onClick={() => onOpenProject(project.id)}>
            <span className="project-mark">{project.name.slice(0, 1).toUpperCase()}</span>
            <b>{project.name}</b>
            <span className="project-go">Открыть <ArrowRight size={15} /></span>
          </button>)}
        </div>
      </div>}

      <div className="hub-block">
        <div className="hub-caption"><span>С ЧЕГО НАЧНЁМ</span><h2>Что собираем?</h2><p>Листайте вбок. Остальное добавляется потом в том же кабинете — переносить ничего не придётся.</p></div>
        <KitRail onPick={onPick} />
        <p className="hub-free"><Check size={15} />Собрать и проверить — бесплатно и без карты. Платят, только когда продукт идёт к клиентам.</p>
      </div>

      <div className="hub-block">
        <div className="hub-caption"><span>ПОЛУГОТОВОЕ</span><h2>Возьмите сценарий и доработайте</h2><p>Каждый уже собран целиком — останется поменять слова под своё дело.</p></div>
        <div className="hub-rail"><KindRail onPick={onTemplate} /></div>
      </div>

      <div className="hub-block">
        <div className="hub-caption"><span>ИНСТРУКЦИЯ</span><h2>Как это собирается</h2><p>Три части продукта, и у каждой свой короткий путь от пустого экрана до запуска.</p></div>
        <div className="guide-grid">
          {guides.map(({ icon: Icon, title, steps, accent }) => <article key={title} className={`guide-card accent-${accent}`}>
            <span className="guide-icon"><Icon /></span>
            <b>{title}</b>
            <ol>{steps.map((step, index) => <li key={step}><i>{index + 1}</i><span>{step}</span></li>)}</ol>
          </article>)}
        </div>
        <p className="hub-foot"><Rocket size={16} /> Всё это — один проект в одном кабинете. Не понравился выбор — поменяете, ничего не потеряв. Эта страница всегда открывается из раздела «Помощь».</p>
      </div>
    </section>
  </main>;
}

/** The kits ride the same swipeable rail as the deck of tasks on the cover. */
function KitRail({ onPick }: { onPick: (kit: ProductKit) => void }) {
  const rail = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const metrics = () => {
    const element = rail.current;
    const card = element?.firstElementChild as HTMLElement | null;
    if (element == null || card == null || card.offsetWidth === 0) return null;
    return { element, step: card.offsetWidth + 16 };
  };

  const sync = () => {
    const found = metrics();
    if (found === null) return;
    setActive(Math.min(kits.length - 1, Math.max(0, Math.round(found.element.scrollLeft / found.step))));
  };
  useEffect(sync, []);

  const jumpTo = (index: number) => {
    const found = metrics();
    if (found === null) return;
    found.element.scrollTo({ left: index * found.step, behavior: "smooth" });
  };

  return <div className="kit-rail-wrap">
    <div className="kit-rail" ref={rail} onScroll={sync} tabIndex={0} role="group" aria-label="Что собираем">
      {kits.map(({ id, icon: Icon, title, text, gain, price, note, parts, best }) => (
        <button key={id} className={`kit-card kit-${id} ${best ? "best" : ""}`} onClick={() => onPick(id)}>
          {best && <span className="kit-flag">ЧАЩЕ ВСЕГО БЕРУТ</span>}
          <span className="kit-icon"><Icon /></span>
          <b>{title}</b>
          <p>{text}</p>
          <span className="kit-gain"><em>ЧТО ЭТО ДАЁТ</em>{gain}</span>
          <span className="kit-parts">{parts.map((part) => <em key={part}>{part}</em>)}</span>
          <span className="kit-foot"><i>{price}<small>{note}</small></i><span className="kit-go">Собрать <ArrowRight size={15} /></span></span>
        </button>
      ))}
    </div>
    <div className="kind-nav">
      <button className="rail-arrow" onClick={() => jumpTo(Math.max(0, active - 1))} aria-label="Предыдущий набор"><ChevronLeft size={18} /></button>
      <div className="rail-dots">{kits.map((kit, index) => <button key={kit.id} className={index === active ? "on" : ""} onClick={() => jumpTo(index)} aria-label={kit.title} />)}</div>
      <button className="rail-arrow" onClick={() => jumpTo(Math.min(kits.length - 1, active + 1))} aria-label="Следующий набор"><ChevronRight size={18} /></button>
    </div>
  </div>;
}
