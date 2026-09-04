import {
  ArrowRight,
  Bot,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Check,
  GraduationCap,
  Lock,
  MessageSquareText,
  Rocket,
  ShoppingBag,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FlowTemplateId } from "../flow-store";

type StartIntent = { mode?: "register" | "login"; templateId?: FlowTemplateId; plan?: "solo" | "trio" };

/**
 * The product is a constructor for any bot, not a support desk — so the page
 * leads with what people build, and every kind carries its own colour.
 */
type Kind = {
  id: string; icon: typeof Bot; title: string; text: string; problem: string;
  demo: [string, string]; ready: boolean; template: FlowTemplateId;
};

const kinds: Kind[] = [
  { id: "leads", icon: Users, title: "Заявки и лиды", text: "Спросит имя и телефон, проверит ответ и сложит контакты в кабинет.", problem: "Заявки теряются в переписке и в заметках на телефоне", demo: ["Оставьте телефон — перезвоним в течение часа", "+7 900 123-45-67"], ready: true, template: "leads" },
  { id: "booking", icon: CalendarDays, title: "Онлайн-запись", text: "Клиент выбирает услугу и время кнопками — вы только подтверждаете.", problem: "Запись съедает вечер: созвоны, переносы, «а когда свободно?»", demo: ["На какую услугу записать?", "Стрижка, завтра в 15:00"], ready: true, template: "booking" },
  { id: "shop", icon: ShoppingBag, title: "Магазин и витрина", text: "Разделы, цены, карточки товаров и переход к заказу прямо в чате.", problem: "Каталог рассылаете скриншотами, а цены — по одной", demo: ["Что показать: цены или доставку?", "Цены"], ready: true, template: "catalog" },
  { id: "support", icon: MessageSquareText, title: "Поддержка и вопросы", text: "Частые вопросы кнопками, сложные — живому оператору.", problem: "Каждый день отвечаете на одни и те же пять вопросов", demo: ["Часы работы, цены или позвать человека?", "Часы работы"], ready: true, template: "faq" },
  { id: "course", icon: GraduationCap, title: "Курс и обучение", text: "Уроки по расписанию, проверка заданий, доступ после оплаты.", problem: "Ученики теряются между уроками, а материалы — в чате", demo: ["Урок 3 открыт. Готовы продолжить?", "Да, поехали"], ready: false, template: "blank" },
  { id: "club", icon: Lock, title: "Закрытый клуб", text: "Заявки в канал, анкета на входе и доступ только своим.", problem: "В канал лезут случайные люди, а проверять некому", demo: ["Пара вопросов — и мы вас впустим", "Готов ответить"], ready: false, template: "blank" },
];

const steps = [
  { title: "Собираете разговор", text: "Карточка-сообщение, кнопки, вопрос, развилка. Мышкой, без кода." },
  { title: "Проверяете в чате", text: "Тот же движок, что в Telegram: жмёте кнопки как клиент." },
  { title: "Нажимаете «Запустить»", text: "Бота, токен, меню и хостинг берём на себя." },
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
      <a className="brand" href="#top"><span className="brand-mark"><Bot size={19} /></span><span>KIRA<small>боты · Mini App · сайты</small></span></a>
      <nav aria-label="Навигация по странице">
        <a href="#kinds">Что можно собрать</a>
        <a href="#how">Как это работает</a>
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
          <div className="eyebrow"><Sparkles size={15} /> КОНСТРУКТОР TELEGRAM-БОТОВ</div>
          <h1>Любой бот<br /><em>за десять минут</em></h1>
          <p>Заявки, запись, магазин, обучение, закрытый клуб, поддержка — что угодно. Собираете разговор мышкой, а бота, токен и хостинг берём мы.</p>
          <div className="hero-actions">
            <button className="primary-button large" onClick={() => onStart()}>Создать бота бесплатно <ArrowRight size={17} /></button>
            <button className="text-link" onClick={() => onStart({ templateId: "leads" })}>или начать с готового сценария</button>
          </div>
          <ul className="hero-chips">
            <li><Check size={14} /> Без кода</li>
            <li><Check size={14} /> Без карты на старте</li>
            <li><Check size={14} /> Хостинг внутри</li>
            <li><Check size={14} /> Лимита подписчиков нет</li>
          </ul>
        </div>
        <BuildLoop />
      </section>

      <section className="kinds" id="kinds">
        <div className="section-heading"><span>ЧТО МОЖНО СОБРАТЬ</span><h2>Бот под вашу задачу, а не «универсальный»</h2><p>Листайте вбок — под каждой задачей уже лежит сценарий.</p></div>
        <KindRail onPick={(template) => onStart({ templateId: template })} />
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
          <Price name="Черновик" price="0 ₽" description="Собрать и проверить" items={["Холст сценария целиком", "Проверка бота в чате", "Один проект", "Без банковской карты"]} action="Собрать бесплатно" onClick={() => onStart()} />
          <Price featured name="Один продукт" price="350 ₽" suffix="/ месяц" description="Бот в Telegram" items={["Работающий Telegram-бот", "Без лимита на подписчиков", "Заявки в кабинете", "Хостинг и HTTPS"]} action="Запустить бота" onClick={() => onStart({ plan: "solo" })} />
          <Price name="До трёх продуктов" price="650 ₽" suffix="/ месяц" description="Бот, Mini App и сайт" items={["Всё из тарифа слева", "Mini App внутри Telegram", "Сайт на том же контенте", "Один кабинет на всё"]} action="Запустить всё" onClick={() => onStart({ plan: "trio" })} />
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

      <section className="faq" id="faq">
        <div className="section-heading"><span>ЧАСТЫЕ ВОПРОСЫ</span><h2>Коротко о главном</h2></div>
        <div className="faq-list">
          <Faq title="Нужно ли уметь программировать?">Нет. Диалог собирается мышкой: карточка-сообщение, кнопки, вопрос, развилка. Код видеть не придётся ни разу.</Faq>
          <Faq title="Откуда возьмётся сам бот в Telegram?">Из вашего аккаунта. Мы показываем, как получить бота, забираем токен, шифруем его и подключаем — от вас одно нажатие.</Faq>
          <Faq title="Что можно сделать бесплатно?">Зарегистрироваться, собрать весь сценарий и проверить его в чате. Платить нужно только чтобы бот заработал у настоящих клиентов.</Faq>
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
      <a className="brand" href="#top"><span className="brand-mark"><Bot size={19} /></span><span>KIRA<small>боты · Mini App · сайты</small></span></a>
      <div className="footer-links">
        <a href="#kinds">Что можно собрать</a><a href="#pricing">Тарифы</a>
        <button onClick={onService}>Бот под ключ</button>
        <a href="mailto:support@tmastudio.ru">Поддержка</a><a href="/privacy">Конфиденциальность</a><a href="/terms">Условия</a>
      </div>
      <span>© 2026. Маленькая студия для дела в Telegram.</span>
    </footer>
  </div>;
}

/** Kinds of bot, swiped sideways like a deck of cards. */
function KindRail({ onPick }: { onPick: (template: FlowTemplateId) => void }) {
  const rail = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  // The rail is a plain scroller, so the dots read position instead of owning it.
  const sync = () => {
    const element = rail.current;
    if (element === null) return;
    const card = element.firstElementChild as HTMLElement | null;
    if (card === null) return;
    const step = card.offsetWidth + 16;
    setActive(Math.min(kinds.length - 1, Math.max(0, Math.round(element.scrollLeft / step))));
  };

  const scrollTo = (index: number) => {
    const element = rail.current;
    const card = element?.firstElementChild as HTMLElement | null;
    if (element == null || card == null) return;
    element.scrollTo({ left: index * (card.offsetWidth + 16), behavior: "smooth" });
  };

  return <div className="kind-rail-wrap">
    <div className="kind-rail" ref={rail} onScroll={sync} tabIndex={0} role="group" aria-label="Что можно собрать">
      {kinds.map(({ id, icon: Icon, title, text, problem, demo, ready, template }) => <button key={id} className={`kind kind-${id}`} onClick={() => onPick(template)}>
        <span className="kind-icon"><Icon /></span>
        <b>{title}</b>
        <p>{text}</p>
        <p className="kind-problem"><em>Закрывает</em>{problem}</p>
        <span className="kind-demo">
          <span className="bot">{demo[0]}</span>
          <span className="me">{demo[1]}</span>
        </span>
        <span className="kind-go">{ready ? "Взять сценарий" : "Собрать с нуля"} <ArrowRight size={14} /></span>
      </button>)}
    </div>

    <div className="kind-nav">
      <button className="rail-arrow" onClick={() => scrollTo(Math.max(0, active - 1))} disabled={active === 0} aria-label="Предыдущая задача"><ChevronLeft size={18} /></button>
      <div className="rail-dots">{kinds.map((kind, index) => <button key={kind.id} className={index === active ? "on" : ""} onClick={() => scrollTo(index)} aria-label={kind.title} />)}</div>
      <button className="rail-arrow" onClick={() => scrollTo(Math.min(kinds.length - 1, active + 1))} disabled={active === kinds.length - 1} aria-label="Следующая задача"><ChevronRight size={18} /></button>
    </div>
  </div>;
}

/** The rendered build, playing like a GIF: no controls, no sound, no chrome. */
function BuildLoop() {
  const video = useRef<HTMLVideoElement>(null);
  const [reduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    const element = video.current;
    if (element === null) return;
    element.muted = true; // React does not reflect the attribute, and autoplay needs it
    if (reduced) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) void element.play().catch(() => { /* the poster stays */ });
        else element.pause();
      }
    }, { threshold: 0.25 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [reduced]);

  return <figure className="build-loop">
    <span className="loop-badge"><i />ЖИВОЙ ПРИМЕР · 21 СЕКУНДА</span>
    <span className="loop-glow" aria-hidden="true" />
    <video
      ref={video}
      poster="/media/kira-build-poster.jpg"
      muted
      loop
      playsInline
      autoPlay={!reduced}
      preload="metadata"
      controls={reduced}
      aria-label="Как в KIRA собирается бот и Mini App"
    >
      <source src="/media/kira-build.webm" type="video/webm" />
      <source src="/media/kira-build.mp4" type="video/mp4" />
    </video>
    <figcaption><Rocket size={14} /> Собрали сценарий → проверили в чате → добавили Mini App → запустили</figcaption>
  </figure>;
}

function Price({ name, price, suffix, description, items, action, featured, onClick }: { name: string; price: string; suffix?: string; description: string; items: string[]; action: string; featured?: boolean; onClick: () => void }) {
  return <article className={`price-card ${featured ? "featured" : ""}`}>{featured && <div className="popular">ПОПУЛЯРНЫЙ</div>}<h3>{name}</h3><div className="price">{price}<small>{suffix}</small></div><p>{description}</p><ul>{items.map((item) => <li key={item}><Check />{item}</li>)}</ul><button className={featured ? "primary-button" : "outline-button"} onClick={onClick}>{action}</button></article>;
}

function Faq({ title, children }: { title: string; children: React.ReactNode }) {
  return <details><summary>{title}<span>+</span></summary><p>{children}</p></details>;
}
