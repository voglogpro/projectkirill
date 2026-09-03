import {
  ArrowRight,
  Bot,
  CalendarDays,
  Check,
  Clock,
  FileText,
  Globe,
  HelpCircle,
  MessageSquareText,
  Minus,
  MousePointerClick,
  Quote,
  Rocket,
  Server,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { FlowTemplateId } from "../flow-store";

type StartIntent = { mode?: "register" | "login"; templateId?: FlowTemplateId; plan?: "solo" | "trio" };

const abilities = [
  { icon: MessageSquareText, title: "Отвечает сам", text: "Приветствие, кнопки и ответы на частые вопросы — круглосуточно." },
  { icon: Users, title: "Собирает заявки", text: "Спрашивает имя и телефон, проверяет ответ и складывает контакты в кабинет." },
  { icon: CalendarDays, title: "Записывает клиентов", text: "Клиент выбирает услугу кнопкой и оставляет контакты — вы подтверждаете." },
  { icon: ShieldCheck, title: "Передаёт человеку", text: "Сложный вопрос бот честно отдаёт оператору, а не выдумывает ответ." },
  { icon: Wallet, title: "Показывает цены", text: "Разделы кнопками, прайс и переход к заказу — без сайта и приложения." },
  { icon: Clock, title: "Помнит ответы", text: "Что клиент написал раньше, подставляется дальше: «Спасибо, Анна!»" },
];

/** The product's own output is the most convincing thing to put in the hero. */
const conversation = [
  { from: "user", text: "/start" },
  { from: "bot", text: "Здравствуйте! Записать вас или показать цены?", buttons: ["Записаться", "Цены"] },
  { from: "user", text: "Записаться" },
  { from: "bot", text: "Как вас зовут?" },
  { from: "user", text: "Анна" },
  { from: "bot", text: "Оставьте телефон — подтвердим время." },
  { from: "user", text: "+7 900 123-45-67" },
  { from: "bot", text: "Записали, Анна! Перезвоним и подтвердим." },
] as const;

/**
 * Real customer quotes only. Until they exist the section shows an honest
 * empty state instead of invented praise — a made-up review on a live site
 * is a risk for the owner, not social proof.
 */
const reviews: Array<{ name: string; role: string; text: string }> = [];

const steps = [
  {
    title: "Выбираете сценарий",
    text: "Заявки, запись, витрина или ответы на вопросы. Разговор уже написан целиком — с кнопками и вопросами.",
    caption: "Экран выбора: четыре готовых сценария",
  },
  {
    title: "Видите весь разговор на холсте",
    text: "Каждое сообщение — карточка, каждая кнопка — стрелка к следующей карточке. Видно, куда попадёт клиент после любого нажатия.",
    caption: "Холст сценария: карточки и связи между ними",
  },
  {
    title: "Меняете тексты под своё дело",
    text: "Кликаете карточку — справа открываются поля: текст сообщения, подписи кнопок, какой ответ спросить. Ничего не сохраняете руками.",
    caption: "Панель справа: текст сообщения и кнопки",
  },
  {
    title: "Проверяете бота в чате",
    text: "Рядом с холстом чат: жмёте кнопки как клиент и сразу видите, что ответит бот. До запуска, без Telegram.",
    caption: "Проверка: тот же движок, что и в Telegram",
  },
  {
    title: "Нажимаете «Запустить»",
    text: "Бота создаём мы: токен, кнопка меню, хостинг и HTTPS — внутри тарифа. Через минуту он отвечает вашим клиентам в Telegram.",
    caption: "Запуск: бот появляется в Telegram",
  },
] as const;

const included = [
  { feature: "Холст сценария и проверка в чате", free: true, solo: true, trio: true },
  { feature: "Работающий бот в Telegram", free: false, solo: true, trio: true },
  { feature: "Заявки клиентов в кабинете", free: false, solo: true, trio: true },
  { feature: "Хостинг, домен и HTTPS", free: false, solo: true, trio: true },
  { feature: "Без лимита на число подписчиков", free: false, solo: true, trio: true },
  { feature: "Mini App внутри Telegram", free: false, solo: false, trio: true },
  { feature: "Сайт на том же содержимом", free: false, solo: false, trio: true },
  { feature: "Несколько продуктов в одном кабинете", free: false, solo: false, trio: true },
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
      <a className="brand" href="#top"><span className="brand-mark"><Bot size={19} /></span><span>TMA Studio<small>боты · Mini App · сайты</small></span></a>
      <nav aria-label="Навигация по странице">
        <a href="#how">Как это работает</a>
        <a href="#pricing">Тарифы</a>
        <a href="#reviews">Отзывы</a>
        <a href="#why-cheap">Почему так дёшево</a>
        <a href="#faq">Вопросы</a>
        <a href="#about">О компании</a>
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
          <h1>Бот, который отвечает клиентам.<br /><em>Собрать — десять минут.</em></h1>
          <p>Возьмите готовый сценарий, поменяйте тексты под своё дело и нажмите «Запустить». Telegram подключаем сами: токен, кнопка меню и хостинг уже внутри.</p>

          <div className="start-cards" role="group" aria-label="С чего начать">
            <StartCard icon={<MessageSquareText />} title="Только бот" price="350 ₽" text="Отвечает и собирает заявки в чате" action="Собрать бота" onClick={() => onStart({ plan: "solo" })} />
            <StartCard icon={<Smartphone />} title="Бот + Mini App" price="650 ₽" text="Плюс витрина внутри Telegram" action="Собрать с Mini App" onClick={() => onStart({ plan: "trio" })} />
            <StartCard best icon={<Globe />} title="Бот + Mini App + сайт" price="650 ₽" text="Три продукта по цене двух" action="Собрать всё" onClick={() => onStart({ plan: "trio" })} />
          </div>

          <div className="hero-proof"><span><Check /> Без карты на старте</span><span><Check /> Лимита на подписчиков нет</span><span><Check /> Отменить можно в любой момент</span></div>
        </div>

        <ChatDemo />
      </section>

      <section className="service-strip" aria-label="Что входит в платформу">
        <div><Rocket /><span><b>Запуск в один клик</b><small>Бота создаём мы, вам нужен только текст</small></span></div>
        <div><Users /><span><b>Платите за продукты</b><small>А не за число подписчиков, как у других</small></span></div>
        <div><ShieldCheck /><span><b>Токен зашифрован</b><small>AES-256-GCM перед хранением</small></span></div>
        <div><Clock /><span><b>Работает без вас</b><small>Отвечает ночью, в выходные и в отпуске</small></span></div>
      </section>

      <HowItWorks onStart={() => onStart()} />

      <section className="features" id="abilities">
        <div className="section-heading"><span>ЧТО УМЕЕТ БОТ</span><h2>Первая линия поддержки, которая не устаёт</h2><p>Всё это собирается мышкой: сообщения, кнопки, вопросы и развилки.</p></div>
        <div className="feature-grid">{abilities.map(({ icon: Icon, title, text }) => <article key={title}><span><Icon /></span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section className="templates" id="scenarios">
        <div className="section-heading"><span>ГОТОВЫЕ СЦЕНАРИИ</span><h2>Не начинайте с пустого экрана</h2><p>Диалог уже написан — останется поменять услуги, цены и тексты под себя.</p></div>
        <div className="template-grid">
          <Template icon={<FileText />} title="Сбор заявок" text="Спросит имя и телефон, проверит ответ и передаст контакты вам." onClick={() => onStart({ templateId: "leads" })} />
          <Template icon={<CalendarDays />} title="Онлайн-запись" text="Клиент выбирает услугу кнопкой и оставляет контакты." onClick={() => onStart({ templateId: "booking" })} />
          <Template icon={<ShoppingBag />} title="Витрина и цены" text="Разделы кнопками, прайс и переход к заказу." onClick={() => onStart({ templateId: "catalog" })} />
          <Template icon={<HelpCircle />} title="Ответы на вопросы" text="Частые вопросы кнопками, сложные — оператору." onClick={() => onStart({ templateId: "faq" })} />
        </div>
      </section>

      <section className="pricing" id="pricing">
        <div className="section-heading"><span>ТАРИФЫ</span><h2>Платите за то, что собрали</h2><p>Не за подписчиков. Сколько бы клиентов ни пришло, цена не меняется.</p></div>
        <div className="price-grid">
          <Price name="Черновик" price="0 ₽" description="Собрать и проверить" items={["Холст сценария целиком", "Проверка бота в чате", "Один проект", "Без банковской карты"]} action="Собрать бесплатно" onClick={() => onStart()} />
          <Price featured name="Один продукт" price="350 ₽" suffix="/ месяц" description="Бот в Telegram" items={["Работающий Telegram-бот", "Без лимита на подписчиков", "Заявки в кабинете", "Хостинг и HTTPS"]} action="Запустить бота" onClick={() => onStart({ plan: "solo" })} />
          <Price name="До трёх продуктов" price="650 ₽" suffix="/ месяц" description="Бот, Mini App и сайт" items={["Всё из тарифа слева", "Mini App внутри Telegram", "Сайт на том же контенте", "Один кабинет на всё"]} action="Запустить всё" onClick={() => onStart({ plan: "trio" })} />
        </div>

        <div className="compare">
          <h3>Что именно даёт подписка</h3>
          <table>
            <thead><tr><th scope="col">Возможность</th><th scope="col">Черновик<small>0 ₽</small></th><th scope="col">Один продукт<small>350 ₽</small></th><th scope="col">До трёх<small>650 ₽</small></th></tr></thead>
            <tbody>
              {included.map((row) => <tr key={row.feature}>
                <th scope="row">{row.feature}</th>
                <td>{row.free ? <Check aria-label="есть" /> : <Minus aria-label="нет" className="off" />}</td>
                <td>{row.solo ? <Check aria-label="есть" /> : <Minus aria-label="нет" className="off" />}</td>
                <td>{row.trio ? <Check aria-label="есть" /> : <Minus aria-label="нет" className="off" />}</td>
              </tr>)}
            </tbody>
          </table>
          <p className="compare-note">Подписка помесячная, отменяется в кабинете в один клик. Сценарий и заявки остаются у вас даже после отмены.</p>
        </div>
      </section>

      <section className="why-cheap" id="why-cheap">
        <div className="section-heading"><span>ЧЕСТНО О ЦЕНЕ</span><h2>Почему 350 ₽, а не 3 500</h2><p>Не потому, что «пока акция». Просто наши расходы устроены иначе.</p></div>
        <div className="reason-grid">
          <article><Server /><h3>Один сервер на всех</h3><p>Боты не живут каждый на своей машине: все приходят на один вебхук и различаются внутри. Сто клиентов стоят нам примерно как один.</p></article>
          <article><MousePointerClick /><h3>Никаких менеджеров</h3><p>Вы регистрируетесь, собираете и платите сами — нам не нужен отдел продаж, а вам не нужно ждать звонка.</p></article>
          <article><Users /><h3>Считаем продукты, а не людей</h3><p>Другие берут деньги за каждую тысячу подписчиков. Мы — за то, что вы собрали. Ваш рост не увеличивает наш счёт.</p></article>
          <article><Wallet /><h3>Берём массой, а не суммой</h3><p>Нам выгоднее сто человек по 350 ₽, чем десять по 3 500. Поэтому цену не поднимаем — расширяем то, что входит.</p></article>
        </div>
        <p className="why-note">Что мы <b>не</b> обещаем за эти деньги: индивидуальную разработку, интеграцию с вашей CRM и круглосуточную поддержку по телефону. Нужна работа руками — это <button className="link-button" onClick={onService}>бот под ключ</button>.</p>
      </section>

      <section className="service-band" aria-label="Бот под ключ">
        <div>
          <span>НЕ ХОТИТЕ СОБИРАТЬ САМИ?</span>
          <h2>Соберём бота за вас — от 4 900 ₽</h2>
          <p>Вы рассказываете про своё дело, мы пишем сценарий, собираем и запускаем. Кабинет остаётся вам: дальше правите сами или оставляете нам.</p>
        </div>
        <button className="cta-light" onClick={onService}>Посмотреть, что входит <ArrowRight /></button>
      </section>

      <section className="reviews" id="reviews">
        <div className="section-heading"><span>ОТЗЫВЫ</span><h2>Что говорят те, кто уже запустил</h2></div>
        {reviews.length === 0
          ? <div className="reviews-empty">
              <Quote />
              <h3>Мы только открылись — настоящих отзывов ещё нет</h3>
              <p>Выдумывать чужие слова не будем: здесь появятся отзывы первых клиентов, как только они появятся. Соберите бота бесплатно и напишите нам, что получилось — за развёрнутый отзыв дадим два месяца подписки в подарок.</p>
              <button className="primary-button large" onClick={() => onStart()}>Стать первым <ArrowRight size={17} /></button>
            </div>
          : <div className="review-grid">{reviews.map((review) => <article key={review.name}><Quote /><p>{review.text}</p><footer><b>{review.name}</b><small>{review.role}</small></footer></article>)}</div>}
      </section>

      <section className="about" id="about">
        <div className="section-heading"><span>О КОМПАНИИ</span><h2>Маленькая студия, а не корпорация</h2></div>
        <div className="about-grid">
          <p>TMA Studio делает один инструмент и делает его хорошо: конструктор ботов для тех, кто ведёт дело руками — мастеров, салонов, небольших магазинов, репетиторов, локальных сервисов.</p>
          <p>Мы считаем, что платить за автоматизацию должно быть не страшно. Поэтому берём фиксированную сумму за собранные продукты и не увеличиваем счёт, когда у вас становится больше клиентов. Растёте вы — не растёт наш тариф.</p>
          <p>Пишите напрямую: <a href="mailto:support@tmastudio.ru">support@tmastudio.ru</a>. Отвечает человек, а не бот — иронично, но так честнее.</p>
        </div>
      </section>

      <section className="faq" id="faq">
        <div className="section-heading"><span>ЧАСТЫЕ ВОПРОСЫ</span><h2>Что важно знать перед запуском</h2></div>
        <div className="faq-list">
          <Faq title="Правда за десять минут?">Столько занимает сборка по готовому сценарию: поменять тексты, проверить бота в чате и нажать «Запустить». Если пишете диалог с нуля и вдумчиво — дольше, и это нормально.</Faq>
          <Faq title="Нужно ли уметь программировать?">Нет. Диалог собирается мышкой: карточка-сообщение, кнопки, вопрос, развилка. Код видеть не придётся ни разу.</Faq>
          <Faq title="Откуда возьмётся сам бот в Telegram?">Из вашего аккаунта. Мы показываем, как получить бота, забираем токен, шифруем его и подключаем — от вас нужно одно нажатие, никаких настроек сервера.</Faq>
          <Faq title="Что можно сделать бесплатно?">Зарегистрироваться, собрать весь сценарий и проверить бота в чате. Оплата нужна только чтобы бот заработал в Telegram у настоящих клиентов.</Faq>
          <Faq title="Куда попадают заявки клиентов?">В кабинет, списком: имя, телефон и то, что клиент выбирал кнопками. Ничего не теряется, даже если вы были не за компьютером.</Faq>
          <Faq title="Нужен свой сервер или домен?">Нет. Хостинг и HTTPS-адрес входят в тариф — мы держим бота и Mini App у себя.</Faq>
          <Faq title="Что будет, если клиентов станет много?">Ничего. Тариф считает продукты, а не подписчиков: хоть сто человек в день, хоть десять тысяч — цена та же.</Faq>
          <Faq title="Можно поменять сценарий после запуска?">Да, в любой момент. Правите текст на холсте, нажимаете «Опубликовать» — бот отвечает по-новому со следующего сообщения.</Faq>
          <Faq title="Что произойдёт, если перестать платить?">Сценарий и заявки останутся в кабинете. Бот перестанет отвечать клиентам и снова заработает после продления.</Faq>
          <Faq title="А если я не хочу возиться сам?">Соберём за вас: от 4 900 ₽ разово. Подробности — <button className="link-button" onClick={onService}>на странице «Бот под ключ»</button>.</Faq>
        </div>
      </section>

      <section className="final-cta"><div><span>ГОТОВЫ НАЧАТЬ?</span><h2>Соберите бота прямо сейчас</h2><p>Бесплатно, без карты и без установки чего-либо.</p></div><button className="cta-light" onClick={() => onStart()}>Создать бота <ArrowRight /></button></section>
    </main>

    <footer><a className="brand" href="#top"><span className="brand-mark"><Bot size={19} /></span><span>TMA Studio<small>боты · Mini App · сайты</small></span></a><div className="footer-links"><a href="#how">Как это работает</a><a href="#pricing">Тарифы</a><button onClick={onService}>Бот под ключ</button><a href="#about">О компании</a><a href="mailto:support@tmastudio.ru">Поддержка</a><a href="/privacy">Конфиденциальность</a><a href="/terms">Условия</a></div><span>© 2026. Сделано для дела в Telegram.</span></footer>
  </div>;
}

/** The five screens the owner will actually see, shown instead of described. */
function HowItWorks({ onStart }: { onStart: () => void }) {
  const [active, setActive] = useState(0);
  const step = steps[active] ?? steps[0];

  return <section className="how" id="how">
    <div className="section-heading"><span>КАК ЭТО РАБОТАЕТ</span><h2>Пять экранов — и бот отвечает клиентам</h2><p>Нажмите шаг слева, чтобы посмотреть, что происходит на экране.</p></div>
    <div className="how-body">
      <ol className="how-steps">
        {steps.map((item, index) => <li key={item.title}>
          <button className={index === active ? "active" : ""} onClick={() => setActive(index)} aria-current={index === active}>
            <i>{index + 1}</i>
            <span><b>{item.title}</b><small>{item.text}</small></span>
          </button>
        </li>)}
      </ol>
      <div className="how-stage">
        <div className="how-screen">{[<MockTemplates key="0" />, <MockCanvas key="1" />, <MockInspector key="2" />, <MockChat key="3" />, <MockLaunch key="4" />][active]}</div>
        <div className="how-caption"><span>{step?.caption}</span><button className="outline-button" onClick={onStart}>Попробовать самому <ArrowRight size={15} /></button></div>
      </div>
    </div>
  </section>;
}

function MockTemplates() {
  const items = [
    { icon: <FileText />, title: "Сбор заявок", picked: true },
    { icon: <CalendarDays />, title: "Онлайн-запись" },
    { icon: <ShoppingBag />, title: "Витрина и цены" },
    { icon: <HelpCircle />, title: "Вопросы и ответы" },
  ];
  return <div className="mock mock-templates">
    <b>С чего начнём?</b>
    <div>{items.map((item) => <span key={item.title} className={item.picked ? "picked" : ""}>{item.icon}<em>{item.title}</em>{item.picked && <Check />}</span>)}</div>
    <button className="mock-primary">Дальше</button>
  </div>;
}

function MockCanvas() {
  return <div className="mock mock-canvas">
    <aside><em>Блоки</em><span>Сообщение</span><span>Вопрос</span><span>Условие</span><span>Оператор</span></aside>
    <div className="mock-board">
      <div className="mock-node start"><i>Команда</i><b>/start</b></div>
      <svg className="mock-wire" viewBox="0 0 20 34" aria-hidden="true"><path d="M10 0 V34" /></svg>
      <div className="mock-node"><i>Сообщение</i><b>Здравствуйте! Записать вас или показать цены?</b><span><em>Записаться</em><em>Цены</em></span></div>
      <div className="mock-fork" aria-hidden="true"><svg viewBox="0 0 200 30"><path d="M100 0 V12 H24 V30" /><path d="M100 12 H176 V30" /></svg></div>
      <div className="mock-pair">
        <div className="mock-node small"><i>Вопрос</i><b>Как вас зовут?</b></div>
        <div className="mock-node small"><i>Сообщение</i><b>Стрижка — от 1 500 ₽</b></div>
      </div>
    </div>
  </div>;
}

function MockInspector() {
  return <div className="mock mock-inspector">
    <div className="mock-node selected"><i>Сообщение</i><b>Здравствуйте! Записать вас или показать цены?</b><span><em>Записаться</em><em>Цены</em></span></div>
    <aside>
      <em>Свойства блока</em>
      <label>Текст сообщения<span>Здравствуйте! Записать вас или показать цены?</span></label>
      <label>Кнопка 1<span>Записаться</span></label>
      <label>Кнопка 2<span>Цены</span></label>
      <small><Check /> Сохраняется само</small>
    </aside>
  </div>;
}

function MockChat() {
  return <div className="mock mock-chat">
    <header><span className="avatar"><Bot size={15} /></span><b>Проверка сценария</b></header>
    <div>
      <p className="bot">Здравствуйте! Записать вас или показать цены?</p>
      <span className="keys"><em>Записаться</em><em>Цены</em></span>
      <p className="user">Записаться</p>
      <p className="bot">Как вас зовут?</p>
      <p className="user">Анна</p>
      <p className="bot">Записали, Анна! Перезвоним и подтвердим.</p>
    </div>
    <footer>Тот же движок, что и в Telegram</footer>
  </div>;
}

function MockLaunch() {
  return <div className="mock mock-launch">
    <span className="mock-rocket"><Rocket /></span>
    <b>Бот запущен</b>
    <ul>
      <li><Check /> Токен зашифрован и сохранён</li>
      <li><Check /> Кнопка меню в Telegram настроена</li>
      <li><Check /> Хостинг и HTTPS подключены</li>
    </ul>
    <div className="mock-bot">@vash_salon_bot<em>отвечает</em></div>
  </div>;
}

/** The first three lines are there on load; the rest arrive so the chat feels live. */
function ChatDemo() {
  const [shown, setShown] = useState(3);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(conversation.length); return; }
    if (shown >= conversation.length) return;
    const timer = setTimeout(() => setShown((value) => value + 1), conversation[shown]?.from === "bot" ? 900 : 550);
    return () => clearTimeout(timer);
  }, [shown]);

  const waiting = shown < conversation.length && conversation[shown]?.from === "bot";
  return <div className="hero-chat" aria-label="Пример разговора клиента с ботом">
    <header><span className="avatar"><Bot size={17} /></span><span><b>Салон Нова</b><small>бот · отвечает сразу</small></span></header>
    <div className="chat-body">
      {conversation.slice(0, shown).map((line, index) => <div className={`chat-msg ${line.from}`} key={index}>
        <div className="chat-bubble">
          {line.text}
          {"buttons" in line && line.buttons !== undefined && <span className="chat-buttons">{line.buttons.map((button) => <em key={button}>{button}</em>)}</span>}
        </div>
      </div>)}
      {waiting && <div className="chat-msg bot"><div className="chat-bubble typing" aria-label="Бот печатает"><i /><i /><i /></div></div>}
    </div>
    <footer>Так выглядит бот, собранный на TMA Studio</footer>
  </div>;
}

function StartCard({ icon, title, price, text, action, best, onClick }: { icon: React.ReactNode; title: string; price: string; text: string; action: string; best?: boolean; onClick: () => void }) {
  return <button className={`start-card ${best ? "best" : ""}`} onClick={onClick}>
    {best && <em className="tag">Выгодно</em>}
    <span className="start-icon">{icon}</span>
    <b>{title}</b>
    <strong>{price}<small>/ мес</small></strong>
    <p>{text}</p>
    <span className="start-action">{action} <ArrowRight size={15} /></span>
  </button>;
}

function Template({ icon, title, text, onClick }: { icon: React.ReactNode; title: string; text: string; onClick: () => void }) {
  return <article className="template-card"><span>{icon}</span><h3>{title}</h3><p>{text}</p><button onClick={onClick}>Взять сценарий <ArrowRight /></button></article>;
}

function Price({ name, price, suffix, description, items, action, featured, onClick }: { name: string; price: string; suffix?: string; description: string; items: string[]; action: string; featured?: boolean; onClick: () => void }) {
  return <article className={`price-card ${featured ? "featured" : ""}`}>{featured && <div className="popular">ПОПУЛЯРНЫЙ</div>}<h3>{name}</h3><div className="price">{price}<small>{suffix}</small></div><p>{description}</p><ul>{items.map((item) => <li key={item}><Check />{item}</li>)}</ul><button className={featured ? "primary-button" : "outline-button"} onClick={onClick}>{action}</button></article>;
}

function Faq({ title, children }: { title: string; children: React.ReactNode }) {
  return <details><summary>{title}<span>+</span></summary><p>{children}</p></details>;
}

