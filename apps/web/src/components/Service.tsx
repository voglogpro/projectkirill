import { ArrowRight, Bot, Check, Clock, FileText, MessageCircle, PenLine, Rocket, ShieldCheck, Sparkles, Wrench } from "lucide-react";

/** Where a "сделайте за меня" request lands: the owner's own bot answers it. */
const CONTACT_TELEGRAM = "https://t.me/KonsTRUktor_bot";
const CONTACT_EMAIL = "support@tmastudio.ru";

const packages = [
  {
    name: "Старт",
    price: "4 900 ₽",
    once: "разово",
    lead: "2 рабочих дня",
    description: "Один бот по готовому сценарию: приветствие, кнопки, сбор заявок.",
    items: ["До 12 блоков в сценарии", "Тексты пишем мы, вы утверждаете", "Подключение бота в Telegram", "Одна правка после сдачи"],
  },
  {
    name: "Бизнес",
    featured: true,
    price: "12 900 ₽",
    once: "разово",
    lead: "5 рабочих дней",
    description: "Бот и Mini App: витрина или запись внутри Telegram, заявки в кабинете.",
    items: ["Сценарий любой длины", "Mini App: витрина, карточки, форма", "Тексты, кнопки и картинки под ваше дело", "Две правки после сдачи", "Обучение по видеосвязи, 40 минут"],
  },
  {
    name: "Под ключ",
    price: "24 900 ₽",
    once: "разово",
    lead: "10 рабочих дней",
    description: "Бот, Mini App и сайт на одном контенте. Мы делаем всё, вы принимаете работу.",
    items: ["Всё из «Бизнеса»", "Сайт на том же содержимом", "Перенос ваших цен, услуг и фотографий", "Месяц правок без доплаты", "Отдельный чат с нами на время работ"],
  },
];

const stages = [
  { icon: MessageCircle, title: "Бриф", text: "Двадцать минут в переписке: чем занимаетесь, что должен спрашивать бот, куда девать заявки." },
  { icon: PenLine, title: "Сценарий", text: "Пишем разговор целиком и показываем его вам в чате — до того, как что-то запущено." },
  { icon: Wrench, title: "Сборка", text: "Собираем бота, Mini App или сайт на нашей же платформе. Вы смотрите готовое, а не описание." },
  { icon: Rocket, title: "Запуск", text: "Подключаем бота к Telegram, отдаём кабинет и показываем, как менять тексты самому." },
];

export function Service({ onStart, onHome }: { onStart: () => void; onHome: () => void }) {
  return <div className="landing service-page">
    <header className="landing-nav">
      <button className="brand" onClick={onHome}><span className="brand-mark"><Bot size={19} /></span><span>KIRA<small>боты · Mini App · сайты</small></span></button>
      <nav aria-label="Навигация по странице">
        <a href="#packages">Цены</a>
        <a href="#stages">Как проходит</a>
        <a href="#service-faq">Вопросы</a>
      </nav>
      <div className="nav-actions">
        <button className="nav-login" onClick={onHome}>На главную</button>
        <a className="primary-button" href={CONTACT_TELEGRAM} target="_blank" rel="noreferrer">Оставить заявку</a>
      </div>
    </header>

    <main>
      <section className="service-hero">
        <div>
          <div className="eyebrow"><Sparkles size={15} /> БОТ ПОД КЛЮЧ</div>
          <h1>Некогда собирать самому?<br /><em>Соберём за вас.</em></h1>
          <p>Вы рассказываете про своё дело — мы пишем сценарий, собираем бота, подключаем его к Telegram и отдаём вам готовый кабинет. Дальше меняете тексты сами или оставляете нам.</p>
          <div className="service-hero-actions">
            <a className="primary-button large" href={CONTACT_TELEGRAM} target="_blank" rel="noreferrer">Обсудить задачу <ArrowRight size={17} /></a>
            <button className="outline-button large" onClick={onStart}>Сначала попробую сам</button>
          </div>
          <div className="hero-proof">
            <span><Check /> Оценка и сроки — до оплаты</span>
            <span><Check /> Не подошло — вернём деньги</span>
            <span><Check /> Кабинет остаётся вам</span>
          </div>
        </div>
        <aside className="service-note">
          <h2>Что вы получаете на руки</h2>
          <ul>
            <li><Check /> Работающего бота в Telegram под вашим именем</li>
            <li><Check /> Кабинет с холстом сценария — правьте без нас</li>
            <li><Check /> Заявки клиентов в одном списке</li>
            <li><Check /> Инструкцию на своём языке, а не на нашем</li>
          </ul>
          <p>Разовая работа оплачивается отдельно от подписки: подписка держит бота в эфире (350 ₽ или 650 ₽ в месяц), сборка — один раз.</p>
        </aside>
      </section>

      <section className="pricing" id="packages">
        <div className="section-heading"><span>СКОЛЬКО СТОИТ</span><h2>Три объёма работы</h2><p>Цена фиксируется до начала. Если задача не укладывается — скажем сразу, а не после оплаты.</p></div>
        <div className="price-grid">
          {packages.map((item) => <article key={item.name} className={`price-card ${item.featured ? "featured" : ""}`}>
            {item.featured && <div className="popular">ЧАЩЕ ВСЕГО</div>}
            <h3>{item.name}</h3>
            <div className="price">{item.price}<small>{item.once}</small></div>
            <p>{item.description}</p>
            <ul>{item.items.map((line) => <li key={line}><Check />{line}</li>)}</ul>
            <div className="price-lead"><Clock /> Срок: {item.lead}</div>
            <a className={item.featured ? "primary-button" : "outline-button"} href={CONTACT_TELEGRAM} target="_blank" rel="noreferrer">Выбрать «{item.name}»</a>
          </article>)}
        </div>
        <div className="service-support">
          <div><ShieldCheck /><span><b>Сопровождение — 3 000 ₽ в месяц</b><small>Меняем тексты, добавляем разделы и следим за ботом. Отказаться можно в любой месяц.</small></span></div>
          <div><FileText /><span><b>Отдельная правка — 900 ₽</b><small>Если сопровождение не нужно, а поправить надо один раз.</small></span></div>
        </div>
      </section>

      <section className="stages" id="stages">
        <div className="section-heading"><span>КАК ПРОХОДИТ РАБОТА</span><h2>Четыре шага, и вы ничего не делаете руками</h2><p>Оплата — после того, как согласовали сценарий и срок.</p></div>
        <div className="stage-grid">
          {stages.map(({ icon: Icon, title, text }, index) => <article key={title}>
            <i>{index + 1}</i><Icon /><h3>{title}</h3><p>{text}</p>
          </article>)}
        </div>
      </section>

      <section className="faq" id="service-faq">
        <div className="section-heading"><span>ЧАСТЫЕ ВОПРОСЫ</span><h2>О работе под ключ</h2></div>
        <div className="faq-list">
          <details><summary>Чем это отличается от конструктора?<span>+</span></summary><p>Ничем, кроме того, кто сидит за конструктором. Мы собираем бота на той же платформе и отдаём вам тот же кабинет — вы в любой момент можете продолжить сами.</p></details>
          <details><summary>Нужно ли платить подписку сверху?<span>+</span></summary><p>Да. Разовая сумма — за сборку, подписка 350 ₽ или 650 ₽ в месяц — за то, что бот работает в Telegram и мы держим хостинг. Первый месяц подписки входит в любой пакет.</p></details>
          <details><summary>А если результат не понравится?<span>+</span></summary><p>Сценарий вы утверждаете до сборки, поэтому сюрпризов почти не бывает. Если готовая работа всё же не подошла — вернём деньги за сборку.</p></details>
          <details><summary>Кому принадлежит бот?<span>+</span></summary><p>Вам. Бот создаётся в вашем Telegram-аккаунте, кабинет оформлен на вас, тексты и заявки — ваши.</p></details>
          <details><summary>Как быстро начнёте?<span>+</span></summary><p>Обычно в тот же день, если задача понятна. Срок в карточке считается с момента, когда согласован сценарий.</p></details>
        </div>
      </section>

      <section className="final-cta">
        <div><span>ГОТОВЫ ПОРУЧИТЬ?</span><h2>Расскажите про своё дело — остальное наша забота</h2><p>Ответим в Telegram, оценим задачу и назовём срок. Бесплатно и без обязательств.</p></div>
        <a className="cta-light" href={CONTACT_TELEGRAM} target="_blank" rel="noreferrer">Написать в Telegram <ArrowRight /></a>
      </section>
    </main>

    <footer>
      <button className="brand" onClick={onHome}><span className="brand-mark"><Bot size={19} /></span><span>KIRA<small>боты · Mini App · сайты</small></span></button>
      <div className="footer-links"><button onClick={onHome}>Главная</button><a href={`mailto:${CONTACT_EMAIL}`}>Почта</a><a href="/privacy">Конфиденциальность</a><a href="/terms">Условия</a></div>
      <span>© 2026. Сделано для дела в Telegram.</span>
    </footer>
  </div>;
}
