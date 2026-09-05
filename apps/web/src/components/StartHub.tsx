import { ArrowRight, Bot, Check, Globe, LayoutGrid, MessageSquareText, Smartphone } from "lucide-react";
import type { FlowTemplateId } from "../flow-store";
import type { ProductKit } from "../types";
import { TemplateCatalog } from "./TemplateCatalog";
import { ConstructorArtwork } from "./ProductArtwork";
import { PriceSummary } from "./PriceSummary";
import "../start-hub.css";

type Kit = { id: ProductKit; icon: typeof Bot; title: string; description: string; hosting: string };

const hostingPlans: ReadonlyArray<{ kit: ProductKit; plan: "solo" | "trio" | "studio"; title: string; price: number; detail: string; icon: typeof Bot }> = [
  { kit: "bot", plan: "solo", title: "Один текстовый бот", price: 350, detail: "1 бот · сообщения и цепочки", icon: MessageSquareText },
  { kit: "bot", plan: "trio", title: "Три текстовых бота", price: 650, detail: "До 3 ботов · один тариф", icon: Bot },
  { kit: "bot-app", plan: "studio", title: "Бот и Mini App", price: 650, detail: "1 бот + приложение", icon: Smartphone },
  { kit: "bot-app-site", plan: "studio", title: "Бот, Mini App и сайт", price: 650, detail: "1 бот + приложение + сайт", icon: LayoutGrid },
];

const kits: readonly Kit[] = [
  { id: "bot", icon: MessageSquareText, title: "Текстовый бот", description: "Сообщения, кнопки и цепочки действий на холсте.", hosting: "Сценарий в Telegram" },
  { id: "bot-app", icon: Smartphone, title: "Бот и Mini App", description: "Бот и приложение с каталогом, карточками и формами.", hosting: "Бот + приложение" },
  { id: "bot-app-site", icon: LayoutGrid, title: "Бот, Mini App и сайт", description: "Один проект в Telegram и по ссылке в браузере.", hosting: "Бот + приложение + сайт" },
  { id: "site", icon: Globe, title: "Только сайт", description: "Страница из блоков с предпросмотром в браузере.", hosting: "Страница проекта" },
];

type StartHubProps = {
  projects: Array<{ id: string; name: string }>;
  onPick: (kit: ProductKit, plan?: "solo" | "trio" | "studio") => void;
  onTemplate: (template: FlowTemplateId) => void;
  onOpenProject: (id: string) => void;
  onSkip: () => void;
  pending?: boolean;
  userName?: string;
};

/** All editor formats are free to explore; hosting depends on the published format. */
export function StartHub({ projects, onPick, onTemplate, onOpenProject, onSkip, pending = false, userName }: StartHubProps) {
  return <main className="hub-v2">
    <header className="hub-v2-header">
      <span className="hub-v2-brand"><span><Bot size={21} /></span><b className="kira-wordmark">KIRA<small>Конструктор ботов миниаппов сайтов</small></b></span>
      <nav aria-label="Навигация по стартовому экрану">
        <a href="#hub-pricing">Тарифы</a>
        <button type="button" onClick={onSkip} disabled={pending}>В кабинет <ArrowRight size={16} /></button>
      </nav>
    </header>
    <div className="hub-v2-content">
      <section className="hub-v2-guide" aria-labelledby="hub-guide-title">
        <div className="hub-v2-heading">
          <span className="hub-v2-eyebrow">ВАШ ПУТЬ К ЗАПУСКУ</span>
          <h1 id="hub-guide-title">{userName ? `Привет, ${userName}!` : "Добро пожаловать в KIRA"}</h1>
          <p>Начните с конструктора или готового сценария. Собрать и проверить можно бесплатно.</p>
        </div>
        <PriceSummary href="#hub-pricing" />
        <ol className="hub-v2-steps">
          <li><span>01</span><div><h2>Выберите основу</h2><p>Текстовый бот, Mini App или сайт. Либо готовый сценарий ниже.</p></div></li>
          <li><span>02</span><div><h2>Соберите и проверьте</h2><p>Меняйте тексты и блоки, проверяйте результат в предпросмотре. Без Premium.</p></div></li>
          <li><span>03</span><div><h2>Запустите для клиентов</h2><p>Добавьте токен из <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">@BotFather</a>. Тариф понадобится при публикации.</p></div></li>
        </ol>
      </section>

      {projects.length > 0 && <section className="hub-v2-section" aria-labelledby="hub-projects-title">
        <div className="hub-v2-section-title"><h2 id="hub-projects-title">Продолжить работу</h2><span>Проектов: {projects.length}</span></div>
        <div className="hub-v2-projects">
          {projects.map((project) => <button type="button" key={project.id} onClick={() => onOpenProject(project.id)} disabled={pending}>
            <span className="hub-v2-project-icon">{project.name.slice(0, 1).toUpperCase()}</span>
            <span className="hub-v2-project-name"><strong>{project.name}</strong><small>Открыть проект</small></span>
            <ArrowRight size={18} />
          </button>)}
        </div>
      </section>}

      <section className="hub-v2-section" id="hub-constructors" aria-labelledby="hub-constructors-title">
        <div className="hub-v2-heading">
          <span className="hub-v2-eyebrow">КОНСТРУКТОРЫ</span>
          <h2 id="hub-constructors-title">Какой конструктор вы можете выбрать</h2>
          <p>Все четыре доступны бесплатно. Пробуйте — существующий проект не изменится.</p>
        </div>
        <div className="hub-v2-kit-grid">
          {kits.map(({ id, title, description }) => <button type="button" className={`hub-v2-kit hub-v2-kit-${id}`} key={id} onClick={() => onPick(id)} disabled={pending}>
            <span className="hub-v2-kit-top"><span>Бесплатный редактор</span></span>
            <ConstructorArtwork kit={id} />
            <h3>{title}</h3><p>{description}</p>
            <span className="hub-v2-kit-cta">Попробовать <ArrowRight size={17} /></span>
          </button>)}
        </div>
        <p className="hub-v2-free"><Check size={16} />Карта и Premium не нужны. Оплата — только за запуск и хостинг.</p>
        {pending && <p className="hub-v2-status" role="status">Открываем конструктор…</p>}
      </section>

      <section className="hub-v2-section" id="hub-templates" aria-labelledby="hub-templates-title">
        <div className="hub-v2-heading">
          <span className="hub-v2-eyebrow">ГОТОВЫЕ РЕШЕНИЯ</span>
          <h2 id="hub-templates-title">Ваш бизнес. Уже собранный бот.</h2>
          <p>Выберите задачу, проверьте бота в чате и поменяйте тексты под себя. Цепочки действий уже связаны — не нужно начинать с пустого холста.</p>
        </div>
        <TemplateCatalog onPick={onTemplate} pending={pending} showHeading={false} />
      </section>

      <section className="hub-v2-section hub-v2-pricing" id="hub-pricing" aria-labelledby="hub-pricing-title">
        <div className="hub-v2-heading">
          <span className="hub-v2-eyebrow">ОПЛАТА ПРИ ПУБЛИКАЦИИ</span>
          <h2 id="hub-pricing-title">Тарифы на запуск</h2>
          <p>Три текстовых бота или один бот с Mini App — 650 ₽/мес. Сборка и предпросмотр любого формата бесплатны.</p>
        </div>
        <div className="hub-v2-price-grid">
          {hostingPlans.map(({ kit, plan, icon: Icon, title, price, detail }, index) => <article className={`hub-v2-price hub-v2-price-${plan}`} key={`${kit}-${plan}`}>
            <span className="hub-v2-price-label">{index === 1 ? "ДЛЯ НЕСКОЛЬКИХ ЗАДАЧ" : index > 1 ? "ОДИН ПРОЕКТ" : "ПРОСТОЙ СТАРТ"}</span>
            <Icon size={22} /><h3>{title}</h3>
            <p className="hub-v2-price-value">{price} ₽<span>/ месяц</span></p>
            <p className="hub-v2-price-detail">{detail}<br />Хостинг включён</p>
            <button type="button" onClick={() => onPick(kit, plan)} disabled={pending}>Собрать бесплатно</button>
          </article>)}
        </div>
        <p className="hub-v2-pricing-note">Пакет за 650 ₽ для трёх ботов подходит только текстовым ботам. Mini App и полный комплект — 650 ₽ за один проект; добавление сайта к Mini App цену не меняет. Кнопки открывают редактор без списания денег.</p>
      </section>
      <footer className="hub-v2-footer">KIRA · От идеи до работающего проекта</footer>
    </div>
  </main>;
}
