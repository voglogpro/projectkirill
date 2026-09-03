import type { BotFlowDocument, FlowNode } from "../../../src/domain/bot-flow";
import type { TemplateId } from "./types";

const STORAGE_KEY = "tma-studio-flow-v1";

export type FlowNodeType = FlowNode["type"];

export const nodeCatalog: Array<{ type: FlowNodeType; title: string; hint: string }> = [
  { type: "message", title: "Сообщение", hint: "Текст и кнопки" },
  { type: "question", title: "Вопрос", hint: "Ответ сохранится в переменную" },
  { type: "choice", title: "Условие", hint: "Развилка по ответу" },
  { type: "delay", title: "Пауза", hint: "Подождать перед ответом" },
  { type: "handoff", title: "Оператор", hint: "Передать разговор человеку" },
  { type: "start", title: "Команда", hint: "Новая точка входа" },
];

/** A scenario that already sells something, so a new project is never blank. */
export function createStarterFlow(name = "Мой бот"): BotFlowDocument {
  const id = () => crypto.randomUUID();
  const start = id(), hello = id(), askName = id(), askPhone = id(), thanks = id(), prices = id();
  return {
    schemaVersion: 1,
    metadata: { name },
    nodes: [
      { id: start, version: 1, position: { x: 0, y: 0 }, type: "start", props: { command: "start", description: "Первое сообщение" } },
      { id: hello, version: 1, position: { x: 0, y: 140 }, type: "message", props: { text: "Привет! Я помогу записаться или расскажу про цены.", buttons: [{ id: "book", kind: "next", label: "Записаться" }, { id: "prices", kind: "next", label: "Цены" }] } },
      { id: askName, version: 1, position: { x: -220, y: 380 }, type: "question", props: { text: "Как вас зовут?", variable: "name", expects: "any", retryText: "Напишите имя текстом, пожалуйста." } },
      { id: askPhone, version: 1, position: { x: -220, y: 560 }, type: "question", props: { text: "Оставьте телефон — перезвоним и подтвердим.", variable: "phone", expects: "phone", retryText: "Похоже, это не телефон. Пример: +7 900 123-45-67" } },
      { id: thanks, version: 1, position: { x: -220, y: 740 }, type: "message", props: { text: "Спасибо, {{name}}! Перезвоним на {{phone}} в ближайший час.", buttons: [] } },
      { id: prices, version: 1, position: { x: 240, y: 380 }, type: "message", props: { text: "Консультация — бесплатно.\nОсновная услуга — от 1 500 ₽.", buttons: [{ id: "back", kind: "next", label: "Записаться" }] } },
    ],
    edges: [
      { id: "e-start", from: start, fromHandle: "next", to: hello },
      { id: "e-book", from: hello, fromHandle: "book", to: askName },
      { id: "e-prices", from: hello, fromHandle: "prices", to: prices },
      { id: "e-name", from: askName, fromHandle: "next", to: askPhone },
      { id: "e-phone", from: askPhone, fromHandle: "next", to: thanks },
      { id: "e-back", from: prices, fromHandle: "back", to: askName },
    ],
  };
}

export function createFlowNode(type: FlowNodeType, position: { x: number; y: number }): FlowNode {
  const id = crypto.randomUUID();
  const base = { id, version: 1 as const, position };
  switch (type) {
    case "message": return { ...base, type, props: { text: "Новое сообщение", buttons: [] } };
    case "question": return { ...base, type, props: { text: "Что спросить?", variable: `answer_${id.slice(0, 4)}`, expects: "any", retryText: "Не получилось разобрать ответ. Попробуйте ещё раз." } };
    case "choice": return { ...base, type, props: { conditions: [{ id: "case1", variable: "name", operator: "filled", value: "" }] } };
    case "delay": return { ...base, type, props: { seconds: 3 } };
    case "handoff": return { ...base, type, props: { text: "Передаю разговор оператору — скоро ответим." } };
    case "start": return { ...base, type, props: { command: `command_${id.slice(0, 4)}`, description: "" } };
  }
}

/** Exits a node offers on the canvas: one handle per button, condition or "next". */
export function exitsOf(node: FlowNode): Array<{ handle: string; label: string }> {
  if (node.type === "message") {
    const callbacks = node.props.buttons.filter((button) => button.kind === "next");
    return callbacks.length === 0 ? [{ handle: "next", label: "Дальше" }] : callbacks.map((button) => ({ handle: button.id, label: button.label }));
  }
  if (node.type === "choice") return [...node.props.conditions.map((condition) => ({ handle: condition.id, label: condition.variable })), { handle: "else", label: "Иначе" }];
  if (node.type === "handoff") return [];
  return [{ handle: "next", label: "Дальше" }];
}

export function loadFlow(): BotFlowDocument {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? createStarterFlow() : JSON.parse(stored) as BotFlowDocument;
  } catch { return createStarterFlow(); }
}
export function saveFlow(flow: BotFlowDocument): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(flow)); } catch { /* the canvas keeps working from memory */ }
}

export type FlowTemplateId = "leads" | "booking" | "catalog" | "faq" | "blank";

/** Bot scenarios are the front door now, so onboarding picks one of these. */
export const flowTemplateOptions: Array<{ id: FlowTemplateId; title: string; description: string }> = [
  { id: "leads", title: "Сбор заявок", description: "Спросит имя и телефон, ответы придут в кабинет" },
  { id: "booking", title: "Онлайн-запись", description: "Клиент выбирает услугу и оставляет контакты" },
  { id: "catalog", title: "Витрина и цены", description: "Кнопки по разделам, цены и переход к заказу" },
  { id: "faq", title: "Ответы на вопросы", description: "Частые вопросы кнопками и передача оператору" },
  { id: "blank", title: "С нуля", description: "Одна команда и одно сообщение" },
];

/** Mini App page template that fits a bot scenario, for when the owner adds one. */
export const pageTemplateForFlow: Record<FlowTemplateId, TemplateId> = {
  leads: "leads", booking: "booking", catalog: "catalog", faq: "services", blank: "blank",
};

export function createFlowFromTemplate(template: FlowTemplateId, name: string): BotFlowDocument {
  const id = () => crypto.randomUUID();
  const at = (x: number, y: number) => ({ x, y });
  const start = id();
  const startNode: FlowNode = { id: start, version: 1, position: at(0, 0), type: "start", props: { command: "start", description: "Первое сообщение" } };
  const metadata = { name: name.trim() || flowTemplateOptions.find((item) => item.id === template)?.title || "Мой бот" };

  if (template === "blank") {
    const hello = id();
    return { schemaVersion: 1, metadata, nodes: [startNode, { id: hello, version: 1, position: at(0, 150), type: "message", props: { text: "Здравствуйте! Чем помочь?", buttons: [] } }], edges: [{ id: "e1", from: start, fromHandle: "next", to: hello }] };
  }

  if (template === "booking") {
    const hello = id(), askName = id(), askPhone = id(), done = id();
    return {
      schemaVersion: 1, metadata,
      nodes: [
        startNode,
        { id: hello, version: 1, position: at(0, 150), type: "message", props: { text: "Здравствуйте! На какую услугу записать?", buttons: [{ id: "haircut", kind: "next", label: "Стрижка" }, { id: "colour", kind: "next", label: "Окрашивание" }] } },
        { id: askName, version: 1, position: at(-200, 400), type: "question", props: { text: "Как вас зовут?", variable: "name", expects: "any", retryText: "Напишите имя текстом, пожалуйста." } },
        { id: askPhone, version: 1, position: at(-200, 580), type: "question", props: { text: "Оставьте телефон — подтвердим время.", variable: "phone", expects: "phone", retryText: "Похоже, это не телефон. Пример: +7 900 123-45-67" } },
        { id: done, version: 1, position: at(-200, 760), type: "message", props: { text: "Записали, {{name}}! Перезвоним на {{phone}} и подтвердим время.", buttons: [] } },
      ],
      edges: [
        { id: "e1", from: start, fromHandle: "next", to: hello },
        { id: "e2", from: hello, fromHandle: "haircut", to: askName },
        { id: "e3", from: hello, fromHandle: "colour", to: askName },
        { id: "e4", from: askName, fromHandle: "next", to: askPhone },
        { id: "e5", from: askPhone, fromHandle: "next", to: done },
      ],
    };
  }

  if (template === "catalog") {
    const hello = id(), prices = id(), delivery = id(), askPhone = id(), done = id();
    return {
      schemaVersion: 1, metadata,
      nodes: [
        startNode,
        { id: hello, version: 1, position: at(0, 150), type: "message", props: { text: "Здравствуйте! Что показать?", buttons: [{ id: "prices", kind: "next", label: "Цены" }, { id: "delivery", kind: "next", label: "Доставка" }, { id: "order", kind: "next", label: "Заказать" }] } },
        { id: prices, version: 1, position: at(-260, 420), type: "message", props: { text: "Основная позиция — от 1 500 ₽.\nКомплект — от 3 900 ₽.", buttons: [{ id: "order", kind: "next", label: "Заказать" }] } },
        { id: delivery, version: 1, position: at(20, 420), type: "message", props: { text: "Доставка по городу — на следующий день, самовывоз — в тот же день.", buttons: [{ id: "order", kind: "next", label: "Заказать" }] } },
        { id: askPhone, version: 1, position: at(300, 560), type: "question", props: { text: "Оставьте телефон — менеджер соберёт заказ.", variable: "phone", expects: "phone", retryText: "Похоже, это не телефон. Пример: +7 900 123-45-67" } },
        { id: done, version: 1, position: at(300, 740), type: "message", props: { text: "Спасибо! Свяжемся по номеру {{phone}}.", buttons: [] } },
      ],
      edges: [
        { id: "e1", from: start, fromHandle: "next", to: hello },
        { id: "e2", from: hello, fromHandle: "prices", to: prices },
        { id: "e3", from: hello, fromHandle: "delivery", to: delivery },
        { id: "e4", from: hello, fromHandle: "order", to: askPhone },
        { id: "e5", from: prices, fromHandle: "order", to: askPhone },
        { id: "e6", from: delivery, fromHandle: "order", to: askPhone },
        { id: "e7", from: askPhone, fromHandle: "next", to: done },
      ],
    };
  }

  if (template === "faq") {
    const hello = id(), hours = id(), price = id(), operator = id();
    return {
      schemaVersion: 1, metadata,
      nodes: [
        startNode,
        { id: hello, version: 1, position: at(0, 150), type: "message", props: { text: "Здравствуйте! Выберите вопрос или напишите свой.", buttons: [{ id: "hours", kind: "next", label: "Часы работы" }, { id: "price", kind: "next", label: "Сколько стоит" }, { id: "human", kind: "next", label: "Позвать человека" }] } },
        { id: hours, version: 1, position: at(-260, 420), type: "message", props: { text: "Работаем с 10:00 до 20:00 без выходных.", buttons: [] } },
        { id: price, version: 1, position: at(20, 420), type: "message", props: { text: "Консультация бесплатная, работы — от 1 500 ₽.", buttons: [] } },
        { id: operator, version: 1, position: at(300, 420), type: "handoff", props: { text: "Передаю разговор оператору — ответим в рабочее время." } },
      ],
      edges: [
        { id: "e1", from: start, fromHandle: "next", to: hello },
        { id: "e2", from: hello, fromHandle: "hours", to: hours },
        { id: "e3", from: hello, fromHandle: "price", to: price },
        { id: "e4", from: hello, fromHandle: "human", to: operator },
      ],
    };
  }

  const starter = createStarterFlow(metadata.name);
  return { ...starter, metadata };
}
