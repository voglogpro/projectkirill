import { ArrowRight, Bot, Check, Globe, MessageSquareText, Rocket, Smartphone, Sparkles, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FlowTemplateId } from "../flow-store";
import { KindRail } from "./KindRail";

type StartIntent = { mode?: "register" | "login"; templateId?: FlowTemplateId; plan?: "solo" | "trio" };

/**
 * Three products, one cabinet — the part people miss on the first read, so it
 * gets its own section right under the hero.
 */
const pieces = [
  { icon: MessageSquareText, tag: "ОСНОВА", title: "Текстовый бот", text: "Разговор в Telegram: сообщения, кнопки, вопросы, развилки. С него начинают все — этого одного уже хватает, чтобы принимать заявки.", note: "Входит в оба тарифа" },
  { icon: Smartphone, tag: "ЭКРАНЫ", title: "Mini App", text: "Приложение внутри Telegram: каталог, карточки, форма, оплата. Бот открывает его кнопкой — выходить из мессенджера не нужно.", note: "Собирается блоками, как страница" },
  { icon: Globe, tag: "ССЫЛКА", title: "Сайт", text: "Те же экраны по обычной ссылке — для тех, кто не в Telegram. Отдельно верстать ничего не надо: контент один и тот же.", note: "Готов сразу после публикации" },
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
        <a href="#pieces">Что входит</a>
        <a href="#kinds">Что можно собрать</a>
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
          <div className="eyebrow"><Sparkles size={15} /> БОТ · MINI APP · САЙТ В ОДНОМ КАБИНЕТЕ</div>
          <h1>Соберите бота,<br /><em>который нужен вам</em></h1>
          <p>Заявки, запись, магазин, обучение, поддержка. Разговор собираете мышкой, а бота, токен и хостинг берём мы. Рядом — Mini App и сайт на том же контенте.</p>
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
        <a href="#pieces">Что входит</a><a href="#kinds">Что можно собрать</a><a href="#pricing">Тарифы</a>
        <button onClick={onService}>Бот под ключ</button>
        <a href="mailto:support@tmastudio.ru">Поддержка</a><a href="/privacy">Конфиденциальность</a><a href="/terms">Условия</a>
      </div>
      <span>© 2026. Маленькая студия для дела в Telegram.</span>
    </footer>
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
    <figcaption className="loop-title"><i />ВИДЕО-ПРИМЕР<em>21 секунда</em></figcaption>
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
    <p className="loop-steps"><Rocket size={14} /> Собрали сценарий → проверили в чате → добавили Mini App → запустили</p>
  </figure>;
}

function Price({ name, price, suffix, description, items, action, featured, onClick }: { name: string; price: string; suffix?: string; description: string; items: string[]; action: string; featured?: boolean; onClick: () => void }) {
  return <article className={`price-card ${featured ? "featured" : ""}`}>{featured && <div className="popular">ПОПУЛЯРНЫЙ</div>}<h3>{name}</h3><div className="price">{price}<small>{suffix}</small></div><p>{description}</p><ul>{items.map((item) => <li key={item}><Check />{item}</li>)}</ul><button className={featured ? "primary-button" : "outline-button"} onClick={onClick}>{action}</button></article>;
}

function Faq({ title, children }: { title: string; children: React.ReactNode }) {
  return <details><summary>{title}<span>+</span></summary><p>{children}</p></details>;
}
