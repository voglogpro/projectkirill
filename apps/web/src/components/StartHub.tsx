import { ArrowRight, Bot, Check, Globe, LayoutGrid, MessageSquareText, MousePointerClick, Rocket, Smartphone } from "lucide-react";
import type { FlowTemplateId } from "../flow-store";
import type { ProductKit } from "../types";
import { KindRail } from "./KindRail";

/**
 * The screen behind the door: after registration and after every login the
 * owner first says what they are building, and only then lands in a tool.
 */
type Kit = { id: ProductKit; icon: typeof Bot; title: string; text: string; price: string; parts: string[]; best?: boolean };

const kits: Kit[] = [
  { id: "bot", icon: MessageSquareText, title: "Текстовый бот", text: "Разговор в Telegram: сообщения, кнопки, вопросы, развилки. Заявки складываются в кабинет.", price: "350 ₽ / мес", parts: ["Бот"] },
  { id: "bot-app", icon: Smartphone, title: "Бот и Mini App", text: "К разговору добавляются экраны внутри Telegram: каталог, карточки, форма. Бот открывает их кнопкой.", price: "650 ₽ / мес", parts: ["Бот", "Mini App"] },
  { id: "bot-app-site", icon: LayoutGrid, title: "Бот, Mini App и сайт", text: "Всё вместе: те же экраны ещё и по обычной ссылке — для тех, кто не в Telegram.", price: "650 ₽ / мес", parts: ["Бот", "Mini App", "Сайт"], best: true },
  { id: "site", icon: Globe, title: "Только сайт", text: "Страница по обычной ссылке без Telegram-бота. Собирается теми же блоками.", price: "350 ₽ / мес", parts: ["Сайт"] },
];

const guides = [
  {
    icon: MessageSquareText, title: "Как собирается текстовый бот", accent: "a",
    steps: ["Берёте готовый сценарий — заявки, запись, магазин, поддержка.", "На холсте правите карточки: карточка — это сообщение, стрелка — переход.", "Добавляете кнопки в сообщение, и от каждой кнопки тянется своя стрелка.", "Жмёте «Проверить в чате», а потом «Запустить» — токен и хостинг берём мы."],
  },
  {
    icon: Smartphone, title: "Как собирается Mini App", accent: "b",
    steps: ["Экран собирается блоками: заголовок, текст, картинка, кнопка, товар, форма.", "Блоки складываются сверху вниз, порядок меняется стрелками.", "Справа настраиваются свойства выбранного блока — текст, цвет кнопки, поля формы.", "После публикации бот открывает Mini App кнопкой меню."],
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
      <div className="hub-heading">
        <span>С ЧЕГО НАЧНЁМ</span>
        <h1>Что собираем?</h1>
        <p>Выберите набор. Остальное добавляется потом в том же кабинете — переносить ничего не придётся.</p>
      </div>

      {projects.length > 0 && <div className="hub-resume">
        <div><b>Уже начатое</b><small>Вернуться к проекту, который вы собирали</small></div>
        <div className="hub-resume-list">
          {projects.slice(0, 4).map((project) => <button key={project.id} onClick={() => onOpenProject(project.id)}>{project.name} <ArrowRight size={14} /></button>)}
        </div>
      </div>}

      <ol className="kit-grid">
        {kits.map(({ id, icon: Icon, title, text, price, parts, best }) => <li key={id}>
          <button className={`kit-card kit-${id} ${best ? "best" : ""}`} onClick={() => onPick(id)}>
            {best && <span className="kit-flag">ЧАЩЕ ВСЕГО БЕРУТ</span>}
            <span className="kit-icon"><Icon /></span>
            <b>{title}</b>
            <p>{text}</p>
            <span className="kit-parts">{parts.map((part) => <em key={part}>{part}</em>)}</span>
            <span className="kit-foot"><i>{price}</i><span className="kit-go">Собрать <ArrowRight size={14} /></span></span>
          </button>
        </li>)}
      </ol>

      <div className="hub-price">
        <div><b>350 ₽ в месяц</b><small>один продукт — бот или сайт</small></div>
        <div><b>650 ₽ в месяц</b><small>до трёх — бот, Mini App и сайт</small></div>
        <div className="hub-price-note"><Check size={14} />Собрать и проверить — бесплатно и без карты. Платят, только когда продукт идёт к клиентам.</div>
      </div>

      <h2 className="hub-subhead">Что можно собрать</h2>
      <p className="hub-lead">Листайте вбок — под каждой задачей уже лежит готовый сценарий. Нажмите, и он откроется на холсте.</p>
      <div className="hub-rail"><KindRail onPick={onTemplate} /></div>

      <h2 className="hub-subhead">Как это собирается</h2>
      <div className="guide-grid">
        {guides.map(({ icon: Icon, title, steps, accent }) => <article key={title} className={`guide-card accent-${accent}`}>
          <span className="guide-icon"><Icon /></span>
          <b>{title}</b>
          <ol>{steps.map((step, index) => <li key={step}><i>{index + 1}</i><span>{step}</span></li>)}</ol>
        </article>)}
      </div>

      <p className="hub-foot"><Rocket size={15} /> Всё это — один проект в одном кабинете. Не понравился выбор — поменяете, ничего не потеряв.</p>
      <p className="hub-hint"><MousePointerClick size={14} /> Эта страница всегда открывается из раздела «Помощь».</p>
    </section>
  </main>;
}
