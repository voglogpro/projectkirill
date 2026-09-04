import { ArrowRight, Bot, Check, Globe, MessageSquareText, Rocket, Smartphone } from "lucide-react";

/**
 * The page a new account lands on: what the three parts are, how they fit
 * together and what to press next. Reachable later from «Помощь».
 */
const parts = [
  { icon: MessageSquareText, tag: "ОСНОВА", title: "Текстовый бот", text: "Разговор в Telegram: сообщения, кнопки, вопросы, развилки. Собирается на холсте мышкой и проверяется в чате рядом.", note: "С него начинают все" },
  { icon: Smartphone, tag: "ЭКРАНЫ", title: "Mini App", text: "Приложение внутри Telegram: каталог, карточки, форма заявки. Бот открывает его кнопкой меню — из мессенджера выходить не нужно.", note: "Собирается блоками, как страница" },
  { icon: Globe, tag: "ССЫЛКА", title: "Сайт", text: "Те же экраны по обычной ссылке — для тех, кто не в Telegram. Отдельно верстать ничего не надо: контент один и тот же.", note: "Готов сразу после публикации" },
];

const steps = [
  { title: "Возьмите готовый сценарий", text: "Заявки, запись, магазин, поддержка — диалог уже собран, останется поменять слова." },
  { title: "Поправьте тексты на холсте", text: "Карточки — это сообщения бота, стрелки — переходы. Двигаются мышкой или пальцем." },
  { title: "Проверьте в чате", text: "Справа тот же движок, что в Telegram: жмёте кнопки как клиент и сразу видите ответ." },
  { title: "Нажмите «Запустить»", text: "Бота, токен, меню и хостинг подключим мы. Mini App и сайт добавляются потом, там же." },
];

export function Guide({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return <main className="guide">
    <header>
      <span className="brand bare"><span className="brand-mark"><Bot /></span>KIRA</span>
      <button className="back-link" onClick={onSkip}>Пропустить <ArrowRight /></button>
    </header>
    <section>
      <div className="guide-heading">
        <span>АККАУНТ СОЗДАН</span>
        <h1>Как здесь всё устроено</h1>
        <p>Минута чтения — и дальше вы не заблудитесь. Вернуться к этой странице можно в разделе «Помощь».</p>
      </div>

      <ol className="guide-parts">
        {parts.map(({ icon: Icon, tag, title, text, note }, index) => <li key={title} className={`guide-part part-${index + 1}`}>
          <span className="part-icon"><Icon /></span>
          <span className="part-tag">{tag}</span>
          <b>{title}</b>
          <p>{text}</p>
          <small><Check size={13} />{note}</small>
        </li>)}
      </ol>
      <p className="guide-link"><Rocket size={15} /> Всё это — один проект в одном кабинете. Бот открывает Mini App кнопкой меню, а сайт показывает те же экраны по ссылке. Поменяли текст один раз — поменялось везде.</p>

      <h2 className="guide-subhead">Что делать прямо сейчас</h2>
      <ol className="guide-steps">
        {steps.map((step, index) => <li key={step.title}><i>{index + 1}</i><div><b>{step.title}</b><small>{step.text}</small></div></li>)}
      </ol>

      <p className="guide-money">Собрать и проверить можно бесплатно и без карты. Платить нужно, только когда бот пойдёт к настоящим клиентам: <b>350 ₽</b> — один продукт, <b>650 ₽</b> — все три.</p>

      <div className="guide-actions">
        <button className="primary-button large" onClick={onStart}>Собрать первого бота <ArrowRight /></button>
        <button className="outline-button" onClick={onSkip}>Сразу в кабинет</button>
      </div>
    </section>
  </main>;
}
