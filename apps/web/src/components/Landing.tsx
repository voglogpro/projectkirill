import { ArrowRight, Bot, Check, Globe, MessageSquareText, Rocket, Smartphone, Sparkles, Wrench } from "lucide-react";
import { useEffect } from "react";
import type { FlowTemplateId } from "../flow-store";
import { TemplateCatalog } from "./TemplateCatalog";
import type { PaidBillingPlanCode } from "../pricing";
import { PriceSummary } from "./PriceSummary";
import { InstructionVideo } from "./InstructionVideo";
import "../landing-layout.css";

type StartIntent = { mode?: "register" | "login"; templateId?: FlowTemplateId; plan?: PaidBillingPlanCode };

/**
 * Three products, one cabinet — the part people miss on the first read, so it
 * gets its own section right under the hero.
 */
const pieces = [
  { icon: MessageSquareText, tag: "ОСНОВА", title: "Текстовый бот", text: "Сообщения, кнопки и развилки. Принимает заявки прямо в чате Telegram.", note: "Сборка и проверка бесплатны" },
  { icon: Smartphone, tag: "ЭКРАНЫ", title: "Mini App", text: "Каталог, карточки и формы внутри Telegram. Открывается кнопкой бота.", note: "Собирается из блоков" },
  { icon: Globe, tag: "ССЫЛКА", title: "Сайт", text: "Ваши страницы по обычной ссылке. Контент общий с Mini App.", note: "Доступен после публикации" },
];

const steps = [
  { title: "Собираете разговор", text: "Карточка-сообщение, кнопки, вопрос, развилка. Мышкой, без кода." },
  { title: "Проверяете в чате", text: "Тот же движок, что в Telegram: жмёте кнопки как клиент." },
  { title: "Нажимаете «Запустить»", text: "Подключаете токен из @BotFather, выбираете хостинг — мы настраиваем меню бота." },
];

export function Landing({ onStart, onService }: { onStart: (intent?: StartIntent) => void; onService: () => void }) {
  useEffect(() => {
    const scrollToHash = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      if (id === "") return;
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
    };
    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, []);

  return <div className="landing">
    <header className="landing-nav">
      <a className="brand" href="#top"><span className="brand-mark"><Bot size={19} /></span><span>KIRA<small>Конструктор ботов миниаппов сайтов</small></span></a>
      <nav aria-label="Навигация по странице">
        <a href="#pieces">Что входит</a>
        <a href="#kinds">Готовые решения</a>
        <a href="#pricing">Тарифы</a>
        <a href="#faq">Вопросы</a>
        <button className="nav-service" onClick={onService}><Wrench size={15} /> Бот под ключ</button>
      </nav>
      <div className="nav-actions">
        <button className="nav-login" onClick={() => onStart({ mode: "login" })}>Войти</button>
        <button className="primary-button" onClick={() => onStart()}>Создать бота</button>
      </div>
    </header>

    <main>
      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={15} /> KIRA · КОНСТРУКТОР БЕЗ КОДА</div>
          <h1>Боты, Mini App<br /><em>и сайты без кода</em></h1>
          <p>Выберите основу, настройте под себя и запустите. Всё в одном кабинете — без программирования.</p>
          <div className="hero-mobile-price"><span>Один бот <strong>350 ₽/мес</strong></span><span>С Mini App <strong>650 ₽/мес</strong></span><a href="#pricing">Все тарифы →</a></div>
          <div className="hero-actions">
            <button className="primary-button large" onClick={() => onStart()}>Создать бота бесплатно <ArrowRight size={17} /></button>
            <a className="text-link" href="#intro-video">Как это работает · 21 сек</a>
          </div>
          <ul className="hero-chips">
            <li><Check size={14} /> Сборка и проверка — бесплатно</li>
            <li><Check size={14} /> Оплата только за запуск</li>
          </ul>
        </div>
        <InstructionVideo id="intro-video" />
        <PriceSummary href="#pricing" />
      </section>

      <section className="pieces" id="pieces">
        <div className="section-heading"><span>ЧТО ВХОДИТ</span><h2>Три части, и все работают как одно</h2><p>Начните с текстового бота. Mini App и сайт добавляются позже, в том же кабинете — переносить ничего не придётся.</p></div>
        <ol className="piece-grid">
          {pieces.map(({ icon: Icon, tag, title, text, note }, index) => <li key={title} className={`piece piece-${index + 1}`}>
            <span className="piece-icon"><Icon /></span>
            <span className="piece-tag">{tag}</span>
            <b>{title}</b>
            <p>{text}</p>
            <small><Check size={13} />{note}</small>
          </li>)}
        </ol>
        <p className="piece-link"><Rocket size={15} /> Связаны между собой: бот открывает Mini App кнопкой меню, а сайт — те же экраны по ссылке. Поменяли текст в кабинете — поменялось везде.</p>
      </section>


      <section className="how" id="how">
        <div className="section-heading"><span>КАК ЭТО РАБОТАЕТ</span><h2>Три шага до бота в Telegram</h2></div>
        <ol className="how-rail">
          {steps.map((step, index) => <li key={step.title}><i>{index + 1}</i><b>{step.title}</b><small>{step.text}</small></li>)}
        </ol>
        <div className="how-cta"><button className="primary-button large" onClick={() => onStart()}>Собрать так же <ArrowRight size={17} /></button></div>
      </section>

      <section className="pricing" id="pricing">
        <div className="section-heading"><span>ТАРИФЫ</span><h2>Платите за то, что собрали</h2><p>Не за подписчиков: один сервер обслуживает всех, поэтому цена не растёт вместе с вами.</p></div>
        <div className="price-grid">
          <Price name="Черновик" price="0 ₽" description="Собрать и проверить" items={["Все четыре конструктора", "Проверка бота и страниц", "Один облачный проект", "Пробные копии на устройстве"]} action="Собрать бесплатно" onClick={() => onStart()} />
          <Price name="Один текстовый бот" price="350 ₽" suffix="/ месяц" description="Один бот без Mini App" items={["Сообщения и развилки", "Заявки в кабинете", "Хостинг включён", "Mini App не входит"]} action="Собрать бота" onClick={() => onStart({ plan: "solo" })} />
          <Price name="Три текстовых бота" price="650 ₽" suffix="/ месяц" description="До трёх ботов без Mini App" items={["Три независимых сценария", "Общий кабинет", "Хостинг включён", "Mini App не входит"]} action="Выбрать пакет" onClick={() => onStart({ plan: "trio" })} />
          <Price featured name="Студия" price="650 ₽" suffix="/ месяц" description="Один бот с Mini App" items={["Бот + Mini App", "Сайт по желанию", "Один проект, не три бота", "Хостинг и HTTPS"]} action="Создать Mini App" onClick={() => onStart({ plan: "studio" })} />
        </div>
      </section>

      <section className="service-band" aria-label="Бот под ключ">
        <div>
          <span>НЕКОГДА СОБИРАТЬ САМИ?</span>
          <h2>Соберём бота за вас — от 4 900 ₽</h2>
          <p>Вы рассказываете про своё дело, мы пишем сценарий, собираем и запускаем. Кабинет остаётся вам.</p>
        </div>
        <button className="cta-light" onClick={onService}>Посмотреть, что входит <ArrowRight /></button>
      </section>

      <section className="kinds" id="kinds">
        <div className="section-heading"><span>ГОТОВЫЕ СЦЕНАРИИ</span><h2>Выберите задачу для своего бота</h2><p>Посмотрите, как отвечает бот, и возьмите сценарий за основу бесплатно.</p></div>
        <TemplateCatalog showHeading={false} onPick={(template) => onStart({ templateId: template })} />
      </section>

      <section className="faq" id="faq">
        <div className="section-heading"><span>ЧАСТЫЕ ВОПРОСЫ</span><h2>Коротко о главном</h2></div>
        <div className="faq-list">
          <Faq title="Нужно ли уметь программировать?">Нет. Диалог собирается мышкой: карточка-сообщение, кнопки, вопрос, развилка. Код видеть не придётся ни разу.</Faq>
          <Faq title="Откуда возьмётся сам бот в Telegram?">Из вашего аккаунта. Мы показываем, как получить бота, забираем токен, шифруем его и подключаем — от вас одно нажатие.</Faq>
          <Faq title="Что можно сделать бесплатно?">Собрать и проверить бота, Mini App или сайт. Пробные копии сохраняются в браузере на этом устройстве, отдельно от облачных проектов. Платить нужно за публикацию и хостинг.</Faq>
          <Faq title="Что будет, если клиентов станет много?">Ничего. Тариф считает продукты, а не подписчиков: хоть сто человек в день, хоть десять тысяч — цена та же.</Faq>
          <Faq title="Можно поменять сценарий после запуска?">Да, в любой момент. Правите текст на холсте, нажимаете «Опубликовать» — бот отвечает по-новому со следующего сообщения.</Faq>
          <Faq title="А если я не хочу возиться сам?">Соберём за вас: от 4 900 ₽ разово. Подробности — <button className="link-button" onClick={onService}>на странице «Бот под ключ»</button>.</Faq>
        </div>
      </section>

      <section className="final-cta">
        <div><span>ГОТОВЫ НАЧАТЬ?</span><h2>Соберите своего бота прямо сейчас</h2><p>Бесплатно, без карты и без установки чего-либо.</p></div>
        <button className="cta-light" onClick={() => onStart()}>Создать бота <ArrowRight /></button>
      </section>
    </main>

    <footer>
      <a className="brand" href="#top"><span className="brand-mark"><Bot size={19} /></span><span>KIRA<small>Конструктор ботов миниаппов сайтов</small></span></a>
      <div className="footer-links">
        <a href="#pieces">Что входит</a><a href="#kinds">Что можно собрать</a><a href="#pricing">Тарифы</a>
        <button onClick={onService}>Бот под ключ</button>
        <a href="mailto:support@tmastudio.ru">Поддержка</a><a href="/privacy">Конфиденциальность</a><a href="/terms">Условия</a>
      </div>
      <span>© 2026. Маленькая студия для дела в Telegram.</span>
    </footer>
  </div>;
}


function Price({ name, price, suffix, description, items, action, featured, onClick }: { name: string; price: string; suffix?: string; description: string; items: string[]; action: string; featured?: boolean; onClick: () => void }) {
  return <article className={`price-card ${featured ? "featured" : ""}`}>{featured && <div className="popular">ПОПУЛЯРНЫЙ</div>}<h3>{name}</h3><div className="price">{price}<small>{suffix}</small></div><p>{description}</p><ul>{items.map((item) => <li key={item}><Check />{item}</li>)}</ul><button className={featured ? "primary-button" : "outline-button"} onClick={onClick}>{action}</button></article>;
}

function Faq({ title, children }: { title: string; children: React.ReactNode }) {
  return <details><summary>{title}<span>+</span></summary><p>{children}</p></details>;
}
