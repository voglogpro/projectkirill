import "../pricing.css";

/** Actual monthly hosting prices are visible before the visitor opens an editor. */
export function PriceSummary({ href }: { href: string }) {
  return <aside className="price-summary" aria-label="Стоимость запуска">
    <div className="price-summary-items">
      <span><strong>350 ₽<small>/мес</small></strong>Один текстовый бот</span>
      <span><strong>650 ₽<small>/мес</small></strong>Три текстовых бота</span>
      <span><strong>650 ₽<small>/мес</small></strong>Один бот + Mini App<em>Сайт — без доплаты</em></span>
    </div>
    <div className="price-summary-note"><span>Редактор и проверка — бесплатно</span><a href={href}>Подробнее о тарифах →</a></div>
  </aside>;
}
