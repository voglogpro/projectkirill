import {
  Activity,
  ArrowRight,
  Bot,
  CalendarDays,
  Check,
  Cloud,
  FileText,
  Gauge,
  LayoutTemplate,
  LockKeyhole,
  MessageSquareMore,
  MousePointer2,
  Rocket,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Webhook,
  Zap,
} from "lucide-react";
import { useEffect } from "react";
import type { FlowTemplateId } from "../flow-store";

type StartIntent = { mode?: "register" | "login"; templateId?: FlowTemplateId; plan?: "solo" | "trio" };

const features = [
  { icon: MousePointer2, title: "Визуальная сборка", text: "Добавляйте страницы и блоки, меняйте контент и сразу смотрите результат на экране телефона." },
  { icon: Webhook, title: "Telegram подключается сам", text: "Мы проверяем токен, настраиваем Menu Button и защищённый webhook без ручной работы." },
  { icon: Cloud, title: "Хостинг уже включён", text: "Mini App получает постоянный HTTPS-адрес и остаётся доступным без отдельного сервера." },
  { icon: Activity, title: "Заявки в кабинете", text: "Ответы из форм собираются в одном месте — их можно проверить и выгрузить в CSV." },
  { icon: ShieldCheck, title: "Безопасное хранение", text: "Токены ботов шифруются, а публичные формы принимают только проверенные запросы Telegram." },
  { icon: Gauge, title: "Легковесный Mini App", text: "Быстрый интерфейс без тяжёлого UI-фреймворка комфортно открывается с мобильного интернета." },
];

export function Landing({ onStart }: { onStart: (intent?: StartIntent) => void }) {
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
      <a className="brand" href="#top"><span className="brand-mark"><Bot size={19} /></span><span>TMA Studio<small>конструктор + хостинг</small></span></a>
      <nav aria-label="Навигация по странице">
        <a href="#features">Возможности</a>
        <a href="#templates">Шаблоны</a>
        <a href="#pricing">Тарифы</a>
        <a href="#faq">Вопросы</a>
      </nav>
      <div className="nav-actions"><button className="nav-login" onClick={() => onStart({ mode: "login" })}>Войти</button><button className="primary-button" onClick={() => onStart()}>Регистрация</button></div>
    </header>

    <main>
      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={15} /> КОНСТРУКТОР · БОТ · ХОСТИНГ</div>
          <h1>Запустите Mini App<br />и бота в <em>Telegram</em></h1>
          <p>Соберите каталог, онлайн-запись или форму заявок без кода. TMA Studio подключит Telegram-бота, опубликует приложение и возьмёт хостинг на себя.</p>
          <div className="hero-actions"><button className="primary-button large" onClick={() => onStart()}>Создать бесплатно <ArrowRight size={18} /></button><a className="outline-button large" href="#how">Как проходит запуск</a></div>
          <div className="hero-proof"><span><Check /> Без карты на старте</span><span><Check /> Черновик бесплатно</span><span><Check /> Запуск за несколько минут</span></div>
        </div>

        <div className="hero-visual" aria-label="Пример Mini App и панели запуска">
          <div className="floating-card card-one"><Zap /><span><b>Новая заявка</b><small>Анна · Запись на 15:00</small></span></div>
          <div className="hero-phone">
            <div className="mini-telegram"><span className="avatar">S</span><span><b>Studio Nova</b><small><i /> Mini App онлайн</small></span></div>
            <div className="mini-cover"><small>СТУДИЯ КРАСОТЫ</small><strong>Время для себя</strong><p>Выберите услугу и удобное время</p></div>
            <div className="service-row"><span>Маникюр</span><b>от 1 500 ₽</b></div>
            <div className="service-row"><span>Укладка</span><b>от 2 000 ₽</b></div>
            <button onClick={() => onStart({ templateId: "booking" })}>Записаться</button>
          </div>
          <div className="floating-card card-two"><Rocket /><span><b>Опубликовано</b><small>@studio_nova_bot работает</small></span></div>
          <div className="hero-orbit orbit-one"><Bot /></div><div className="hero-orbit orbit-two"><MessageSquareMore /></div>
        </div>
      </section>

      <section className="service-strip" aria-label="Что входит в платформу">
        <div><LockKeyhole /><span><b>HTTPS автоматически</b><small>Без настройки сертификата</small></span></div>
        <div><Cloud /><span><b>Хостинг включён</b><small>Один сервис вместо нескольких</small></span></div>
        <div><Activity /><span><b>Заявки в реальном времени</b><small>Сразу в личном кабинете</small></span></div>
        <div><ShieldCheck /><span><b>Токен зашифрован</b><small>AES-256-GCM перед хранением</small></span></div>
      </section>

      <section className="features" id="features">
        <div className="section-heading"><span>ВСЁ ДЛЯ ЗАПУСКА</span><h2>Техническая часть больше не мешает бизнесу</h2><p>Как в хорошем хостинге: один понятный кабинет, автоматическая настройка и прозрачный статус проекта.</p></div>
        <div className="feature-grid">{features.map(({ icon: Icon, title, text }) => <article key={title}><span><Icon /></span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section className="steps" id="how">
        <div className="section-heading"><span>ПРОСТОЙ ПРОЦЕСС</span><h2>От идеи до работающего Mini App</h2><p>В кабинете всегда видно, что уже готово и какой шаг следующий.</p></div>
        <div className="step-grid">
          <article><i>01</i><LayoutTemplate /><h3>Выберите сценарий</h3><p>Каталог, запись, заявки, услуги или пустой проект.</p></article>
          <article><i>02</i><Sparkles /><h3>Соберите приложение</h3><p>Настройте страницы, блоки, кнопки и формы визуально.</p></article>
          <article><i>03</i><Rocket /><h3>Подключите и запустите</h3><p>Вставьте токен бота, выберите тариф — остальное автоматизировано.</p></article>
        </div>
      </section>

      <section className="templates" id="templates">
        <div className="section-heading"><span>ГОТОВЫЕ СЦЕНАРИИ</span><h2>Не начинайте с пустого экрана</h2><p>Структура уже собрана — замените тексты, ссылки, цены и изображения.</p></div>
        <div className="template-grid">
          <Template icon={<ShoppingBag />} title="Каталог товаров" text="Карточки, цены, кнопки заказа и заявки." onClick={() => onStart({ templateId: "catalog" })} />
          <Template icon={<CalendarDays />} title="Онлайн-запись" text="Услуги, форма записи и подтверждение в Telegram." onClick={() => onStart({ templateId: "booking" })} />
          <Template icon={<FileText />} title="Сбор заявок" text="Лендинг, квалифицирующая форма и контакты клиента." onClick={() => onStart({ templateId: "leads" })} />
          <Template icon={<LayoutTemplate />} title="Пустой проект" text="Чистая страница для собственного сценария." onClick={() => onStart({ templateId: "blank" })} />
        </div>
      </section>

      <section className="pricing" id="pricing">
        <div className="section-heading"><span>ПРОЗРАЧНЫЕ ТАРИФЫ</span><h2>Сначала соберите. Платите только за работу 24/7.</h2><p>Конструктор остаётся бесплатным. В платный тариф входят публикация, домен, HTTPS и хостинг.</p></div>
        <div className="price-grid">
          <Price name="Конструктор" price="0 ₽" description="Для сборки и проверки идеи" items={["1 бесплатный черновик", "Все основные блоки", "Интерактивный preview", "Без банковской карты"]} action="Собрать бесплатно" onClick={() => onStart()} />
          <Price featured name="Один бот" price="350 ₽" suffix="/ месяц" description="Для одного проекта или бизнеса" items={["1 активный Telegram-бот", "Mini App и HTTPS-домен", "Хостинг без сна", "Входящие заявки"]} action="Запустить 1 бота" onClick={() => onStart({ plan: "solo" })} />
          <Price name="Три бота" price="650 ₽" suffix="/ месяц" description="Для сети проектов или клиентов" items={["До 3 активных ботов", "Единый личный кабинет", "Отдельный Mini App для каждого", "Всё из тарифа выше"]} action="Запустить до 3 ботов" onClick={() => onStart({ plan: "trio" })} />
        </div>
      </section>

      <section className="faq" id="faq">
        <div className="section-heading"><span>ЧАСТЫЕ ВОПРОСЫ</span><h2>Что важно знать перед запуском</h2></div>
        <div className="faq-list">
          <Faq title="Что именно можно сделать бесплатно?">Можно зарегистрироваться, выбрать шаблон, собрать страницы, настроить блоки и проверить приложение в интерактивном preview. Оплата нужна только для публичного запуска.</Faq>
          <Faq title="Нужно ли покупать отдельный хостинг или домен?">Нет. После оплаты TMA Studio публикует Mini App на защищённом HTTPS-адресе и обслуживает его в рамках тарифа.</Faq>
          <Faq title="Как подключается Telegram-бот?">Создайте бота у @BotFather и вставьте токен в мастер запуска. Платформа проверит бота, зашифрует токен и установит кнопку Mini App автоматически.</Faq>
          <Faq title="Можно ли изменить приложение после публикации?">Да. Изменения сохраняются в кабинете, а новая версия публикуется кнопкой «Опубликовать».</Faq>
          <Faq title="Что будет после окончания тарифа?">Черновик и данные проекта останутся в кабинете. Публичный Mini App снова заработает после продления.</Faq>
        </div>
      </section>

      <section className="final-cta"><div><span>ГОТОВЫ НАЧАТЬ?</span><h2>Первый проект можно собрать прямо сейчас</h2><p>Без кода, без сервера и без оплаты до публикации.</p></div><button className="cta-light" onClick={() => onStart()}>Создать бесплатно <ArrowRight /></button></section>
    </main>

    <footer><a className="brand" href="#top"><span className="brand-mark"><Bot size={19} /></span><span>TMA Studio<small>конструктор + хостинг</small></span></a><div className="footer-links"><a href="#features">Возможности</a><a href="#pricing">Тарифы</a><a href="mailto:support@tmastudio.ru">Поддержка</a><a href="/privacy">Конфиденциальность</a><a href="/terms">Условия</a></div><span>© 2026. Сделано для бизнеса в Telegram.</span></footer>
  </div>;
}

function Template({ icon, title, text, onClick }: { icon: React.ReactNode; title: string; text: string; onClick: () => void }) {
  return <article className="template-card"><span>{icon}</span><h3>{title}</h3><p>{text}</p><button onClick={onClick}>Использовать шаблон <ArrowRight /></button></article>;
}

function Price({ name, price, suffix, description, items, action, featured, onClick }: { name: string; price: string; suffix?: string; description: string; items: string[]; action: string; featured?: boolean; onClick: () => void }) {
  return <article className={`price-card ${featured ? "featured" : ""}`}>{featured && <div className="popular">ПОПУЛЯРНЫЙ</div>}<h3>{name}</h3><div className="price">{price}<small>{suffix}</small></div><p>{description}</p><ul>{items.map((item) => <li key={item}><Check />{item}</li>)}</ul><button className={featured ? "primary-button" : "outline-button"} onClick={onClick}>{action}</button></article>;
}

function Faq({ title, children }: { title: string; children: React.ReactNode }) {
  return <details><summary>{title}<span>+</span></summary><p>{children}</p></details>;
}
