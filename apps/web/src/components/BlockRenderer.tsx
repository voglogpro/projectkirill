import { useState } from "react";
import { CheckCircle2, ExternalLink, Image, Send } from "lucide-react";
import type { BlockAction, BuilderBlock } from "../types";

export function BlockRenderer({ block, selected, interactive = false, onSelect, onAction }: { block: BuilderBlock; selected?: boolean; interactive?: boolean; onSelect?: () => void; onAction?: (action: BlockAction) => void }) {
  const className = `render-block ${selected ? "is-selected" : ""}`;
  const selectProps = interactive ? {} : { onClick: onSelect, role: "button", tabIndex: 0, onKeyDown: (event: React.KeyboardEvent) => { if (event.key === "Enter" || event.key === " ") onSelect?.(); } };
  if (block.type === "heading") { const Tag = block.props.level === 1 ? "h1" : block.props.level === 3 ? "h3" : "h2"; return <div className={`${className} align-${block.props.align}`} {...selectProps}><Tag>{block.props.text || "Заголовок"}</Tag></div>; }
  if (block.type === "text") return <div className={className} {...selectProps}><p className={`tone-${block.props.tone}`}>{block.props.markdown || "Текст"}</p></div>;
  if (block.type === "button") return <div className={className} {...selectProps}><button className={`action-preview style-${block.props.style}`} onClick={interactive ? () => onAction?.(block.props.action) : undefined}>{block.props.label}<ExternalLink /></button></div>;
  if (block.type === "media") return <div className={className} {...selectProps}>{block.props.url ? <img className="media-preview" src={block.props.url} alt={block.props.alt} style={{ aspectRatio: block.props.aspectRatio === "auto" ? undefined : block.props.aspectRatio.replace(":", "/") }} /> : <div className="media-placeholder"><Image /><span>Вставьте ссылку на изображение</span></div>}</div>;
  if (block.type === "product") return <div className={`${className} product-preview`} {...selectProps}><div className="product-image"><Image /></div>{block.props.badge && <em>{block.props.badge}</em>}<strong>{block.props.title}</strong><span className="muted">{block.props.description}</span><b>{(block.props.price.amountMinor / 100).toLocaleString("ru-RU")} ₽</b><button className="action-preview" onClick={interactive ? () => onAction?.(block.props.cta.action) : undefined}>{block.props.cta.label}</button></div>;
  return <FormPreview block={block} className={className} interactive={interactive} onSelect={onSelect} />;
}

function FormPreview({ block, className, interactive, onSelect }: { block: Extract<BuilderBlock, { type: "form" }>; className: string; interactive: boolean; onSelect?: () => void }) {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) return <div className={`${className} form-preview preview-success`}><CheckCircle2 /><strong>{block.props.successMessage}</strong><button type="button" onClick={() => setSubmitted(false)}>Заполнить ещё раз</button></div>;

  return <form className={`${className} form-preview`} onClick={interactive ? undefined : onSelect} role={interactive ? undefined : "button"} tabIndex={interactive ? undefined : 0} onKeyDown={interactive ? undefined : (event) => { if (event.key === "Enter" || event.key === " ") onSelect?.(); }} onSubmit={(event) => { event.preventDefault(); if (interactive) setSubmitted(true); }}>
    <strong>Форма заявки</strong>
    {block.props.fields.map((field) => <label key={field.id}>{field.label}
      {field.kind === "checkbox"
        ? <input name={field.id} type="checkbox" disabled={!interactive} required={field.required} />
        : field.kind === "select"
          ? <select name={field.id} disabled={!interactive} required={field.required}><option value="">Выберите</option>{field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          : field.kind === "text" && field.multiline
            ? <textarea name={field.id} disabled={!interactive} required={field.required} maxLength={field.maxLength} placeholder={field.required ? "Обязательное поле" : ""} />
            : <input name={field.id} type={field.kind === "email" ? "email" : field.kind === "phone" ? "tel" : "text"} disabled={!interactive} required={field.required} maxLength={field.kind === "text" ? field.maxLength : undefined} placeholder={field.required ? "Обязательное поле" : ""} />}
    </label>)}
    <button className="action-preview" type="submit" disabled={!interactive}>{block.props.submitLabel}<Send /></button>
  </form>;
}
