import { ExternalLink, Image, Send } from "lucide-react";
import type { BuilderBlock } from "../types";

export function BlockRenderer({ block, selected, onSelect }: { block: BuilderBlock; selected?: boolean; onSelect?: () => void }) {
  const p = block.props;
  const className = `render-block ${selected ? "is-selected" : ""}`;
  if (block.type === "heading") return <button className={className} onClick={onSelect}><h2>{String(p.text ?? "Заголовок")}</h2></button>;
  if (block.type === "text") return <button className={className} onClick={onSelect}><p className="muted">{String(p.markdown ?? "Текст")}</p></button>;
  if (block.type === "button") return <button className={`${className} action-preview`} onClick={onSelect}>{String(p.label ?? "Кнопка")}<ExternalLink size={16} /></button>;
  if (block.type === "media") return <button className={`${className} media-placeholder`} onClick={onSelect}><Image size={26} /><span>Добавьте изображение</span></button>;
  if (block.type === "product") {
    const price = p.price as { amountMinor?: number } | undefined;
    return <button className={`${className} product-preview`} onClick={onSelect}><div className="product-image"><Image /></div><strong>{String(p.title ?? "Товар")}</strong><span className="muted">{String(p.description ?? "")}</span><b>{((price?.amountMinor ?? 0) / 100).toLocaleString("ru-RU")} ₽</b></button>;
  }
  return <button className={`${className} form-preview`} onClick={onSelect}><strong>Форма заявки</strong><label>Ваше имя<input disabled placeholder="Алексей" /></label><label>Телефон<input disabled placeholder="+7 999 000-00-00" /></label><span className="action-preview">{String(p.submitLabel ?? "Отправить")}<Send size={15} /></span></button>;
}
