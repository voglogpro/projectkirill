import {
  ArrowRight,
  Bot,
  CalendarDays,
  Check,
  Clock,
  FileText,
  Globe,
  HelpCircle,
  LayoutTemplate,
  MessageSquareText,
  Rocket,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { FlowTemplateId } from "../flow-store";

type StartIntent = { mode?: "register" | "login"; templateId?: FlowTemplateId; plan?: "solo" | "trio" };

const abilities = [
  { icon: MessageSquareText, title: "Отвечает сам", text: "Приветствие, кнопки, ответы на частые вопросы — круглосуточно, без вашего участия." },
  { icon: Users, title: "Собирает заявки", text: "Спрашивает имя и телефон, проверяет ответ и складывает контакты в кабинет." },
  { icon: CalendarDays, title: "Записывает клиентов", text: "Клиент выбирает услугу кнопкой и оставляет контакты — вы только подтверждаете." },
  { icon: ShieldCheck, title: "Передаёт человеку", text: "Когда вопрос сложный, бот честно зовёт оператора вместо выдумывания ответа." },
  { icon: Wallet, title: "Показывает цены", text: "Разделы кнопками, прайс и переход к заказу — без сайта и без приложения." },
  { icon: Clock, title: "Помнит ответы", text: "Что клиент написал раньше, подставляется дальше по диалогу: «Спасибо, Анна!»" },
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
      <a className="brand" href="#top"><span className="brand-mark"><Bot size={19} /></span><span>TMA Studio<small>боты · Mini App · сайты</small></span></a>
      <nav aria-label="Навигация по странице">
        <a href="#abilities">Что умеет</a>
        <a href="#scenarios">Сценарии</a>
        <a href="#pricing">Тарифы</a>
        <a href="#about">О нас</a>
        <a href="#faq">Вопросы</a>
      </nav>
      <div className="nav-actions"><button className="nav-login" onClick={() => onStart({ mode: "login" })}>Войти</button><button className="primary-button" onClick={() => onStart()}>Создать бота</button></div>
    </header>

    <main>
      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={15} /> КОНСТРУКТОР TELEGRAM-БОТОВ</div>
          <h1>Бот, который отвечает клиентам.<br /><em>Собрать — десять минут.</em></h1>
          <p>Возьмите готовый сценарий, поменяйте тексты под своё дело и нажмите «Запустить». Telegram подключаем сами: токен, кнопка меню и хостинг уже внутри.</p>

          <div className="start-cards" role="group" aria-label="С чего начать">
            <StartCard
              icon={<MessageSquareText />}
              title="Только бот"
              price="350 ₽"
              text="Отвечает, записывает, собирает заявки в чате"
              action="Собрать бота"
              onClick={() => onStart({ plan: "solo" })}
            />
            <StartCard
              icon={<Smartphone />}
              title="Бот + Mini App"
              price="650 ₽"
              text="Плюс приложение внутри Telegram: витрина, карточки, формы"
              action="Собрать с Mini App"
              onClick={() => onStart({ plan: "trio" })}
            />
            <StartCard
              best
              icon={<Globe />}
              title="Бот + Mini App + сайт"
              price="650 ₽"
              text="Три продукта по цене двух — один кабинет на всё"
              action="Собрать всё"
              onClick={() => onStart({ plan: "trio" })}
            />
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

      <section className="features" id="abilities">
        <div className="section-heading"><span>ЧТО УМЕЕТ БОТ</span><h2>Первая линия поддержки, которая не устаёт</h2><p>Всё это собирается мышкой на холсте: сообщения, кнопки, вопросы и развилки.</p></div>
        <div className="feature-grid">{abilities.map(({ icon: Icon, title, text }) => <article key={title}><span><Icon /></span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section className="steps" id="how">
        <div className="section-heading"><span>КАК ЭТО ПРОХОДИТ</span><h2>Три шага от идеи до работающего бота</h2><p>Порядок именно такой — каждый следующий шаг опирается на предыдущий.</p></div>
        <div className="step-grid">
          <article><i>1</i><LayoutTemplate /><h3>Выберите сценарий</h3><p>Запись, заявки, витрина или ответы на вопросы. Диалог уже собран.</p></article>
          <article><i>2</i><Sparkles /><h3>Поменяйте тексты</h3><p>На холсте видно весь разговор: сообщения, кнопки, вопросы. Тут же проверяете его в чате.</p></article>
          <article><i>3</i><Rocket /><h3>Нажмите «Запустить»</h3><p>Бот появляется в Telegram и сразу отвечает клиентам. Хостинг наш.</p></article>
        </div>
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
      </section>

      <section className="about" id="about">
        <div className="section-heading"><span>О НАС</span><h2>Маленькая студия, а не корпорация</h2></div>
        <div className="about-grid">
          <p>TMA Studio делает один инструмент и делает его хорошо: конструктор ботов для тех, кто ведёт дело руками — мастеров, салонов,небольших магазинов, репетиторов, локальных сервисов.</p>
          <p>Мы считаем, что платить за автоматизацию должно быть не страшно. Поэтому берём фиксированную сумму за собранные продукты и не увеличиваем счёт, когда у вас становится больше клиентов. Растёте вы — не растёт наш тариф.</p>
          <p>Пишите напрямую: <a href="mailto:support@tmastudio.ru">support@tmastudio.ru</a>. Отвечает человек, а не бот — иронично, но так честнее.</p>
        </div>
      </section>

      <section className="faq" id="faq">
        <div className="section-heading"><span>ЧАСТЫЕ ВОПРОСЫ</span><h2>Что важно знать перед запуском</h2></div>
        <div className="faq-list">
          <Faq title="Правда за десять минут?">Столько занимает сборка по готовому сценарию: поменять тексты, проверить бота в чате и нажать «Запустить». Если пишете диалог с нуля и вдумчиво — дольше, и это нормально.</Faq>
          <Faq title="Нужно ли уметь программировать?">Нет. Диалог собирается мышкой: карточка-сообщение, кнопки, вопрос, развилка. Код видеть не придётся ни разу.</Faq>
          <Faq title="Что можно сделать бесплатно?">Зарегистрироваться, собрать весь сценарий и проверить бота в чате. Оплата нужна только чтобы бот заработал в Telegram у настоящих клиентов.</Faq>
          <Faq title="Нужен свой сервер или домен?">Нет. Хостинг и HTTPS-адрес входят в тариф — мы держим бота и Mini App у себя.</Faq>
          <Faq title="Что будет, если клиентов станет много?">Ничего. Тариф считает продукты, а не подписчиков: хоть сто человек в день, хоть десять тысяч — цена та же.</Faq>
          <Faq title="Что произойдёт, если перестать платить?">Сценарий и заявки останутся в кабинете. Бот перестанет отвечать клиентам и снова заработает после продления.</Faq>
        </div>
      </section>

      <section className="final-cta"><div><span>ГОТОВЫ НАЧАТЬ?</span><h2>Соберите бота прямо сейчас</h2><p>Бесплатно, без карты и без установки чего-либо.</p></div><button className="cta-light" onClick={() => onStart()}>Создать бота <ArrowRight /></button></section>
    </main>

    <footer><a className="brand" href="#top"><span className="brand-mark"><Bot size={19} /></span><span>TMA Studio<small>боты · Mini App · сайты</small></span></a><div className="footer-links"><a href="#abilities">Что умеет</a><a href="#pricing">Тарифы</a><a href="#about">О нас</a><a href="mailto:support@tmastudio.ru">Поддержка</a><a href="/privacy">Конфиденциальность</a><a href="/terms">Условия</a></div><span>© 2026. Сделано для дела в Telegram.</span></footer>
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
