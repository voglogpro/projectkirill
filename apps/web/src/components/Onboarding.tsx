import { ArrowLeft, ArrowRight, Bot, Check, LayoutTemplate, Paintbrush, Rocket } from "lucide-react";
import { useState } from "react";
import { templateOptions } from "../store";
import type { TemplateId } from "../types";

export function Onboarding({ initialTemplate = "leads", pending, onBack, onCreate }: { initialTemplate?: TemplateId; pending: boolean; onBack: () => void; onCreate: (template: TemplateId, name: string) => void }) {
  const [template, setTemplate] = useState<TemplateId>(initialTemplate);
  const [name, setName] = useState("");
  return <main className="onboarding">
    <header><button className="brand bare" onClick={onBack}><span className="brand-mark"><Bot /></span>TMA Studio</button><button className="back-link" onClick={onBack}><ArrowLeft /> На главную</button></header>
    <section>
      <div className="onboarding-heading"><span>ШАГ 1 · ВЫБОР СЦЕНАРИЯ</span><h1>Что вы хотите запустить?</h1><p>Начните с готовой структуры — все тексты, блоки и действия можно изменить.</p></div>
      <div className="onboarding-journey" aria-label="Этапы запуска"><span className="active"><LayoutTemplate />Шаблон</span><i /><span><Paintbrush />Настройка</span><i /><span><Bot />Бот</span><i /><span><Rocket />Запуск</span></div>
      <div className="onboarding-templates">{templateOptions.map((item) => <button key={item.id} className={template === item.id ? "active" : ""} onClick={() => setTemplate(item.id)}><span><LayoutTemplate /></span><div><b>{item.title}</b><small>{item.description}</small></div>{template === item.id && <Check />}</button>)}</div>
      <label className="onboarding-name"><span>Название проекта</span><input name="project-name" value={name} onChange={(event) => setName(event.target.value)} placeholder={templateOptions.find((item) => item.id === template)?.title} maxLength={120} /></label>
      <button className="primary-button large" disabled={pending} onClick={() => onCreate(template, name)}>{pending ? "Создаём…" : "Открыть конструктор"}<ArrowRight /></button>
      <p className="onboarding-note">Бесплатно и без карты. Оплата понадобится только перед публикацией.</p>
    </section>
  </main>;
}
