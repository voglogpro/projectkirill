import { ArrowLeft, ArrowRight, Bot, Check, LayoutTemplate } from "lucide-react";
import { useState } from "react";
import { templateOptions } from "../store";
import type { TemplateId } from "../types";

export function Onboarding({ initialTemplate = "leads", pending, onBack, onCreate }: { initialTemplate?: TemplateId; pending: boolean; onBack: () => void; onCreate: (template: TemplateId, name: string) => void }) {
  const [template, setTemplate] = useState<TemplateId>(initialTemplate);
  const [name, setName] = useState("");
  return <main className="onboarding">
    <header><button className="brand bare" onClick={onBack}><span className="brand-mark"><Bot /></span>TMA Studio</button><button className="back-link" onClick={onBack}><ArrowLeft /> На главную</button></header>
    <section>
      <div className="onboarding-heading"><span>ШАГ 1 ИЗ 1</span><h1>Что вы хотите создать?</h1><p>Выберите готовый сценарий. Все тексты и блоки можно изменить в конструкторе.</p></div>
      <div className="onboarding-templates">{templateOptions.map((item) => <button key={item.id} className={template === item.id ? "active" : ""} onClick={() => setTemplate(item.id)}><span><LayoutTemplate /></span><div><b>{item.title}</b><small>{item.description}</small></div>{template === item.id && <Check />}</button>)}</div>
      <label className="onboarding-name"><span>Название проекта</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder={templateOptions.find((item) => item.id === template)?.title} maxLength={120} /></label>
      <button className="primary-button large" disabled={pending} onClick={() => onCreate(template, name)}>{pending ? "Создаём…" : "Открыть конструктор"}<ArrowRight /></button>
      <p className="onboarding-note">Бесплатно и без карты. Оплата понадобится только перед публикацией.</p>
    </section>
  </main>;
}
