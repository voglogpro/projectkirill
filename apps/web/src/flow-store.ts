import type { BotFlowDocument, FlowNode } from "../../../src/domain/bot-flow";

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
