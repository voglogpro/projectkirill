import { ArrowRight, Bot, Check, Globe, LayoutGrid, MessageSquareText, Smartphone } from "lucide-react";
import type { FlowTemplateId } from "../flow-store";
import type { ProductKit } from "../types";
import { TemplateCatalog } from "./TemplateCatalog";
import { ConstructorArtwork } from "./ProductArtwork";
import { PriceSummary } from "./PriceSummary";
import { InstructionVideo } from "./InstructionVideo";
import "../start-hub.css";

type Kit = { id: ProductKit; icon: typeof Bot; title: string; description: string; hosting: string; price: 350 | 650 };

const hostingPlans: ReadonlyArray<{ kit: ProductKit; plan: "solo" | "trio" | "studio"; title: string; price: number; detail: string; icon: typeof Bot }> = [
  { kit: "bot", plan: "solo", title: "Один текстовый бот", price: 350, detail: "1 бот · сообщения и цепочки", icon: MessageSquareText },
  { kit: "bot", plan: "trio", title: "Три текстовых бота", price: 650, detail: "До 3 ботов · один тариф", icon: Bot },
  { kit: "bot-app", plan: "studio", title: "Бот и Mini App", price: 650, detail: "1 бот + приложение", icon: Smartphone },
  { kit: "bot-app-site", plan: "studio", title: "Бот, Mini App и сайт", price: 650, detail: "1 бот + приложение + сайт", icon: LayoutGrid },
];

const kits: readonly Kit[] = [
  { id: "bot", icon: MessageSquareText, title: "Текстовый бот", description: "Сообщения, кнопки и цепочки действий на холсте.", hosting: "Сценарий в Telegram", price: 350 },
  { id: "bot-app", icon: Smartphone, title: "Бот и Mini App", description: "Бот и приложение с каталогом, карточками и формами.", hosting: "Бот + приложение", price: 650 },
  { id: "bot-app-site", icon: LayoutGrid, title: "Бот, Mini App и сайт", description: "Один проект в Telegram и по ссылке в браузере.", hosting: "Бот + приложение + сайт", price: 650 },
  { id: "site", icon: Globe, title: "Только сайт", description: "Страница из блоков с предпросмотром в браузере.", hosting: "Страница проекта", price: 350 },
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
        <div className="hub-v2-intro">
          <div className="hub-v2-heading">
            <span className="hub-v2-eyebrow">KIRA · КОНСТРУКТОР БЕЗ КОДА</span>
            <h1 id="hub-guide-title">Создайте бота,<br />Mini App или сайт</h1>
            <p>{userName ? `${userName}, соберите` : "Соберите"} и проверьте бесплатно. Оплата — только за запуск для клиентов.</p>
          </div>
          <PriceSummary href="#hub-pricing" />
          <div className="hub-v2-intro-actions">
            <a className="hub-v2-start" href="#hub-constructors">Выбрать конструктор <ArrowRight size={17} /></a>
            <a href="#hub-video">Как это работает · 21 сек</a>
          </div>
        </div>
        <InstructionVideo id="hub-video" />
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
          <h2 id="hub-constructors-title">Что хотите создать?</h2>
          <p>Нажмите на вариант — откроется бесплатный редактор.</p>
        </div>
        <div className="hub-v2-kit-grid">
          {kits.map(({ id, title, description, price }) => <button type="button" className={`hub-v2-kit hub-v2-kit-${id}`} key={id} onClick={() => onPick(id)} disabled={pending}>
            <span className="hub-v2-kit-top"><span>Бесплатный редактор</span></span>
            <ConstructorArtwork kit={id} />
            <h3>{title}</h3><p>{description}</p>
            <small className="hub-v2-kit-hosting">Запуск — {price} ₽/мес</small>
            <span className="hub-v2-kit-cta">Собрать бесплатно <ArrowRight size={17} /></span>
          </button>)}
        </div>
        <p className="hub-v2-free"><Check size={16} />Карта и Premium не нужны. Оплата — только за запуск и хостинг.</p>
        {pending && <p className="hub-v2-status" role="status">Открываем конструктор…</p>}
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
      <section className="hub-v2-section" id="hub-templates" aria-labelledby="hub-templates-title">
        <div className="hub-v2-heading">
          <span className="hub-v2-eyebrow">ГОТОВЫЕ РЕШЕНИЯ</span>
          <h2 id="hub-templates-title">Начните с готового решения</h2>
          <p>Листайте, проверяйте в чате и выбирайте «Использовать».</p>
        </div>
        <TemplateCatalog onPick={onTemplate} pending={pending} showHeading={false} />
      </section>

      <footer className="hub-v2-footer">KIRA · От идеи до работающего проекта</footer>
    </div>
  </main>;
}
