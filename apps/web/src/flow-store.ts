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

export type FlowTemplateId =
  | "leads" | "booking" | "catalog" | "faq"
  | "delivery" | "course" | "club" | "quiz" | "event" | "reviews"
  | "blank";

/** Bot scenarios are the front door now, so onboarding picks one of these. */
export const flowTemplateOptions: Array<{ id: FlowTemplateId; title: string; description: string }> = [
  { id: "leads", title: "Сбор заявок", description: "Спросит имя и телефон, ответы придут в кабинет" },
  { id: "booking", title: "Онлайн-запись", description: "Клиент выбирает услугу и оставляет контакты" },
  { id: "catalog", title: "Витрина и цены", description: "Кнопки по разделам, цены и переход к заказу" },
  { id: "faq", title: "Ответы на вопросы", description: "Частые вопросы кнопками и передача оператору" },
  { id: "delivery", title: "Меню и доставка", description: "Меню кнопками, адрес и время доставки" },
  { id: "course", title: "Курс и обучение", description: "Уроки по шагам, проверка задания, доступ дальше" },
  { id: "club", title: "Закрытый клуб", description: "Анкета на входе и заявка в закрытый канал" },
  { id: "quiz", title: "Квиз-подбор", description: "Пара вопросов — и бот подбирает вариант" },
  { id: "event", title: "Афиша и запись", description: "Расписание, регистрация и напоминание" },
  { id: "reviews", title: "Отзывы и оценка", description: "Оценка после визита и разбор жалоб" },
  { id: "blank", title: "С нуля", description: "Одна команда и одно сообщение" },
];

/** Mini App page template that fits a bot scenario, for when the owner adds one. */
export const pageTemplateForFlow: Record<FlowTemplateId, TemplateId> = {
  leads: "leads", booking: "booking", catalog: "catalog", faq: "services",
  delivery: "catalog", course: "services", club: "leads", quiz: "leads",
  event: "booking", reviews: "services", blank: "blank",
};

/** Every template is a chain of steps; this turns one into a valid document. */
type Step =
  | { kind: "message"; text: string; buttons?: string[] }
  | { kind: "question"; text: string; variable: string; expects?: "any" | "email" | "phone" | "number"; retryText?: string }
  | { kind: "handoff"; text: string };

function lineFlow(name: string, command: string, steps: Step[], branches: Array<{ from: number; button: string; steps: Step[] }> = []): BotFlowDocument {
  const id = () => crypto.randomUUID();
  const nodes: FlowNode[] = [];
  const edges: BotFlowDocument["edges"] = [];
  const start = id();
  nodes.push({ id: start, version: 1, position: { x: 0, y: 0 }, type: "start", props: { command, description: "Первое сообщение" } });

  const chain = (steps: Step[], column: number, firstRow: number, from: { node: string; handle: string }): string[] => {
    const ids: string[] = [];
    let previous = from;
    steps.forEach((step, index) => {
      const nodeId = id();
      ids.push(nodeId);
      const position = { x: column * 320, y: (firstRow + index) * 190 };
      if (step.kind === "message") {
        nodes.push({ id: nodeId, version: 1, position, type: "message", props: { text: step.text, buttons: (step.buttons ?? []).map((label, order) => ({ id: `b${order + 1}`, kind: "next" as const, label })) } });
      } else if (step.kind === "question") {
        nodes.push({ id: nodeId, version: 1, position, type: "question", props: { text: step.text, variable: step.variable, expects: step.expects ?? "any", retryText: step.retryText ?? "Не получилось разобрать ответ. Попробуйте ещё раз." } });
      } else {
        nodes.push({ id: nodeId, version: 1, position, type: "handoff", props: { text: step.text } });
      }
      edges.push({ id: `e${edges.length + 1}`, from: previous.node, fromHandle: previous.handle, to: nodeId });
      const buttons = step.kind === "message" ? step.buttons ?? [] : [];
      previous = { node: nodeId, handle: buttons.length > 0 ? "b1" : "next" };
    });
    return ids;
  };

  const trunk = chain(steps, 0, 1, { node: start, handle: "next" });
  branches.forEach((branch, index) => {
    const source = trunk[branch.from];
    const step = steps[branch.from];
    const buttons = step !== undefined && step.kind === "message" ? step.buttons ?? [] : [];
    const handle = `b${buttons.indexOf(branch.button) + 1}`;
    if (source === undefined || !handle.endsWith(String(buttons.indexOf(branch.button) + 1)) || buttons.indexOf(branch.button) < 0) return;
    chain(branch.steps, index + 1, branch.from + 2, { node: source, handle });
  });

  return { schemaVersion: 1, metadata: { name }, nodes, edges };
}

const templates: Record<Exclude<FlowTemplateId, "blank">, (name: string) => BotFlowDocument> = {
  leads: (name) => lineFlow(name, "start", [
    { kind: "message", text: "Здравствуйте! Оставьте заявку — перезвоним и всё расскажем.", buttons: ["Оставить заявку", "Сколько стоит"] },
    { kind: "question", text: "Как вас зовут?", variable: "name", retryText: "Напишите имя текстом, пожалуйста." },
    { kind: "question", text: "Оставьте телефон — перезвоним в течение часа.", variable: "phone", expects: "phone", retryText: "Похоже, это не телефон. Пример: +7 900 123-45-67" },
    { kind: "message", text: "Спасибо, {{name}}! Перезвоним на {{phone}} в ближайший час." },
  ], [
    { from: 0, button: "Сколько стоит", steps: [{ kind: "message", text: "Консультация бесплатно, работы — от 1 500 ₽.", buttons: ["Оставить заявку"] }] },
  ]),

  booking: (name) => lineFlow(name, "start", [
    { kind: "message", text: "Здравствуйте! На какую услугу записать?", buttons: ["Стрижка", "Окрашивание"] },
    { kind: "question", text: "Как вас зовут?", variable: "name", retryText: "Напишите имя текстом, пожалуйста." },
    { kind: "question", text: "Оставьте телефон — подтвердим время.", variable: "phone", expects: "phone", retryText: "Похоже, это не телефон. Пример: +7 900 123-45-67" },
    { kind: "message", text: "Записали, {{name}}! Перезвоним на {{phone}} и подтвердим время." },
  ], [
    { from: 0, button: "Окрашивание", steps: [{ kind: "message", text: "Окрашивание занимает до трёх часов. Записываем?", buttons: ["Записаться"] }] },
  ]),

  catalog: (name) => lineFlow(name, "start", [
    { kind: "message", text: "Здравствуйте! Что показать?", buttons: ["Цены", "Доставка", "Заказать"] },
    { kind: "message", text: "Основная позиция — от 1 500 ₽.\nКомплект — от 3 900 ₽.", buttons: ["Заказать"] },
    { kind: "question", text: "Оставьте телефон — менеджер соберёт заказ.", variable: "phone", expects: "phone", retryText: "Похоже, это не телефон. Пример: +7 900 123-45-67" },
    { kind: "message", text: "Спасибо! Свяжемся по номеру {{phone}}." },
  ], [
    { from: 0, button: "Доставка", steps: [{ kind: "message", text: "По городу — на следующий день, самовывоз — в тот же.", buttons: ["Заказать"] }] },
  ]),

  faq: (name) => lineFlow(name, "start", [
    { kind: "message", text: "Здравствуйте! Выберите вопрос или напишите свой.", buttons: ["Часы работы", "Сколько стоит", "Позвать человека"] },
    { kind: "message", text: "Работаем с 10:00 до 20:00 без выходных." },
  ], [
    { from: 0, button: "Сколько стоит", steps: [{ kind: "message", text: "Консультация бесплатная, работы — от 1 500 ₽." }] },
    { from: 0, button: "Позвать человека", steps: [{ kind: "handoff", text: "Передаю разговор оператору — ответим в рабочее время." }] },
  ]),

  delivery: (name) => lineFlow(name, "start", [
    { kind: "message", text: "Здравствуйте! Меню на сегодня — выбирайте.", buttons: ["Горячее", "Напитки"] },
    { kind: "message", text: "Плов — 420 ₽\nСуп дня — 260 ₽\nПаста — 390 ₽", buttons: ["Заказать"] },
    { kind: "question", text: "Куда привезти? Напишите адрес и подъезд.", variable: "address", retryText: "Напишите адрес текстом, пожалуйста." },
    { kind: "question", text: "Оставьте телефон для курьера.", variable: "phone", expects: "phone", retryText: "Похоже, это не телефон. Пример: +7 900 123-45-67" },
    { kind: "message", text: "Принято! Привезём на {{address}}, курьер наберёт {{phone}}." },
  ], [
    { from: 0, button: "Напитки", steps: [{ kind: "message", text: "Кофе — 180 ₽\nЛимонад — 220 ₽", buttons: ["Заказать"] }] },
  ]),

  course: (name) => lineFlow(name, "start", [
    { kind: "message", text: "Добро пожаловать на курс! Начнём с первого урока?", buttons: ["Начать урок", "Что внутри"] },
    { kind: "message", text: "Урок 1. Посмотрите материал и выполните задание.", buttons: ["Задание выполнено"] },
    { kind: "question", text: "Пришлите ссылку или короткий отчёт по заданию.", variable: "homework", retryText: "Напишите отчёт текстом или пришлите ссылку." },
    { kind: "message", text: "Принято! Проверим и откроем урок 2. Отчёт: {{homework}}" },
  ], [
    { from: 0, button: "Что внутри", steps: [{ kind: "message", text: "Восемь уроков, задания с проверкой и чат с преподавателем.", buttons: ["Начать урок"] }] },
  ]),

  club: (name) => lineFlow(name, "start", [
    { kind: "message", text: "Это закрытый клуб. Пара вопросов — и мы вас впустим.", buttons: ["Ответить", "Что даёт клуб"] },
    { kind: "question", text: "Чем вы занимаетесь?", variable: "about", retryText: "Расскажите в паре предложений, пожалуйста." },
    { kind: "question", text: "Оставьте телефон или почту для связи.", variable: "contact", retryText: "Напишите телефон или почту." },
    { kind: "message", text: "Спасибо! Заявка у нас: {{about}}. Ответим на {{contact}} в течение дня." },
  ], [
    { from: 0, button: "Что даёт клуб", steps: [{ kind: "message", text: "Закрытый канал, разборы раз в неделю и общий чат.", buttons: ["Ответить"] }] },
  ]),

  quiz: (name) => lineFlow(name, "start", [
    { kind: "message", text: "Подберём подходящий вариант за три вопроса. Начнём?", buttons: ["Поехали"] },
    { kind: "question", text: "Для кого подбираем: для себя или в подарок?", variable: "who", retryText: "Напишите «себе» или «в подарок»." },
    { kind: "question", text: "Какой бюджет? Напишите числом в рублях.", variable: "budget", expects: "number", retryText: "Напишите бюджет числом, например 5000." },
    { kind: "question", text: "Оставьте телефон — пришлём подборку.", variable: "phone", expects: "phone", retryText: "Похоже, это не телефон. Пример: +7 900 123-45-67" },
    { kind: "message", text: "Готово! Соберём варианты ({{who}}, до {{budget}} ₽) и пришлём на {{phone}}." },
  ]),

  event: (name) => lineFlow(name, "start", [
    { kind: "message", text: "Ближайшая встреча — в субботу в 18:00. Записать вас?", buttons: ["Записаться", "Что будет"] },
    { kind: "question", text: "Как вас зовут?", variable: "name", retryText: "Напишите имя текстом, пожалуйста." },
    { kind: "question", text: "Оставьте телефон — пришлём напоминание.", variable: "phone", expects: "phone", retryText: "Похоже, это не телефон. Пример: +7 900 123-45-67" },
    { kind: "message", text: "Ждём вас, {{name}}! Напомним на {{phone}} за день до встречи." },
  ], [
    { from: 0, button: "Что будет", steps: [{ kind: "message", text: "Два часа практики, разбор вопросов и чай.", buttons: ["Записаться"] }] },
  ]),

  reviews: (name) => lineFlow(name, "start", [
    { kind: "message", text: "Спасибо, что были у нас! Как всё прошло?", buttons: ["Всё отлично", "Есть замечание"] },
    { kind: "message", text: "Спасибо! Будем рады видеть вас снова." },
  ], [
    { from: 0, button: "Есть замечание", steps: [
      { kind: "question", text: "Расскажите, что пошло не так — разберёмся.", variable: "issue", retryText: "Напишите пару слов, пожалуйста." },
      { kind: "handoff", text: "Спасибо, передали руководителю. Свяжемся с вами лично." },
    ] },
  ]),
};

export function createFlowFromTemplate(template: FlowTemplateId, name: string): BotFlowDocument {
  const title = name.trim() || flowTemplateOptions.find((item) => item.id === template)?.title || "Мой бот";
  if (template === "blank") {
    return lineFlow(title, "start", [{ kind: "message", text: "Здравствуйте! Чем помочь?" }]);
  }
  return templates[template](title);
}
