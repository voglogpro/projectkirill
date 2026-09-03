import { ArrowLeft, ArrowRight, Bot, Check, LayoutTemplate, Paintbrush, Rocket } from "lucide-react";
import { useState } from "react";
import { flowTemplateOptions, type FlowTemplateId } from "../flow-store";

export function Onboarding({ initialTemplate = "leads", pending, onBack, onCreate }: { initialTemplate?: FlowTemplateId; pending: boolean; onBack: () => void; onCreate: (template: FlowTemplateId, name: string) => void }) {
  const [template, setTemplate] = useState<FlowTemplateId>(initialTemplate);
  const [name, setName] = useState("");
  return <main className="onboarding">
    <header><button className="brand bare" onClick={onBack}><span className="brand-mark"><Bot /></span>TMA Studio</button><button className="back-link" onClick={onBack}><ArrowLeft /> На главную</button></header>
    <section>
      <div className="onboarding-heading"><span>ШАГ 1 · СЦЕНАРИЙ БОТА</span><h1>Что должен делать ваш бот?</h1><p>Возьмите готовый диалог — сообщения, кнопки и вопросы потом меняются на холсте.</p></div>
      <div className="onboarding-journey" aria-label="Этапы запуска"><span className="active"><LayoutTemplate />Сценарий</span><i /><span><Paintbrush />Правки</span><i /><span><Bot />Проверка в чате</span><i /><span><Rocket />Запуск</span></div>
      <div className="onboarding-templates">{flowTemplateOptions.map((item) => <button key={item.id} className={template === item.id ? "active" : ""} onClick={() => setTemplate(item.id)}><span><LayoutTemplate /></span><div><b>{item.title}</b><small>{item.description}</small></div>{template === item.id && <Check />}</button>)}</div>
      <label className="onboarding-name"><span>Название бота</span><input name="project-name" value={name} onChange={(event) => setName(event.target.value)} placeholder={flowTemplateOptions.find((item) => item.id === template)?.title} maxLength={120} /></label>
      <button className="primary-button large" disabled={pending} onClick={() => onCreate(template, name)}>{pending ? "Создаём…" : "Собрать бота"}<ArrowRight /></button>
      <p className="onboarding-note">Бесплатно и без карты. Оплата нужна только перед запуском бота в Telegram.</p>
    </section>
  </main>;
}
