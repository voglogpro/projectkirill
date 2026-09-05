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
  | "property" | "recruiting" | "repair" | "restaurant" | "fitness" | "consultation" | "photography" | "onboarding"
  | "blank";

/** Bot scenarios are the front door now, so onboarding picks one of these. */
export const flowTemplateOptions: Array<{ id: FlowTemplateId; title: string; description: string }> = [
  { id: "leads", title: "Сбор заявок", description: "Спросит имя и телефон, ответы придут в кабинет" },
  { id: "booking", title: "Онлайн-запись", description: "Клиент выбирает услугу и оставляет контакты" },
  { id: "catalog", title: "Витрина и цены", description: "Кнопки по разделам, цены и переход к заказу" },
  { id: "faq", title: "Ответы на вопросы", description: "Частые вопросы кнопками и передача оператору" },
  { id: "delivery", title: "Меню и доставка", description: "Меню кнопками, адрес и время доставки" },
  { id: "course", title: "Курс и обучение", description: "Первый урок и сбор задания для вашей проверки" },
  { id: "club", title: "Закрытый клуб", description: "Анкета на входе и заявка в закрытый канал" },
  { id: "quiz", title: "Квиз-подбор", description: "Пожелания, бюджет и контакт для вашей подборки" },
  { id: "event", title: "Афиша и запись", description: "Описание события и контакты участника" },
  { id: "reviews", title: "Отзывы и оценка", description: "Оценка после визита и разбор жалоб" },
  { id: "property", title: "Подбор недвижимости", description: "Покупка или аренда: район, бюджет и заявка на просмотр" },
  { id: "recruiting", title: "Подбор сотрудников", description: "Вакансии, опыт кандидата и анкета для рекрутера" },
  { id: "repair", title: "Сервис и ремонт", description: "Устройство, неисправность и заявка на диагностику" },
  { id: "restaurant", title: "Бронирование столика", description: "Обычный визит или банкет: дата, гости и пожелания" },
  { id: "fitness", title: "Фитнес и тренировки", description: "Пробное занятие или персональная тренировка" },
  { id: "consultation", title: "Бриф на консультацию", description: "Разбор задачи, ожиданий и материалов клиента" },
  { id: "photography", title: "Заказ фотосъёмки", description: "Портрет или мероприятие: бриф и пожелания" },
  { id: "onboarding", title: "Знакомство с командой", description: "Маршрут новичка, чек-лист и вопросы наставнику" },
  { id: "blank", title: "С нуля", description: "Одна команда и одно сообщение" },
];

/** Mini App page template that fits a bot scenario, for when the owner adds one. */
export const pageTemplateForFlow: Record<FlowTemplateId, TemplateId> = {
  leads: "leads", booking: "booking", catalog: "catalog", faq: "services",
  delivery: "catalog", course: "services", club: "leads", quiz: "leads",
  event: "booking", reviews: "services", blank: "blank",
  property: "catalog", recruiting: "leads", repair: "services", restaurant: "booking",
  fitness: "booking", consultation: "leads", photography: "services", onboarding: "services",
};

/** Every template is a chain of steps; this turns one into a valid document. */
type Step =
  | { kind: "message"; text: string; buttons?: string[] }
  | { kind: "question"; text: string; variable: string; expects?: "any" | "email" | "phone" | "number"; retryText?: string }
  | { kind: "handoff"; text: string };

function lineFlow(name: string, command: string, steps: Step[], branches: Array<{ from: number; button: string; steps: Step[]; resumeAt?: number }> = []): BotFlowDocument {
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
    const branchIds = chain(branch.steps, index + 1, branch.from + 2, { node: source, handle });
    // Secondary routes rejoin the same form; visible CTA buttons must never be dead ends.
    if (branch.resumeAt !== undefined) {
      const target = trunk[branch.resumeAt];
      if (target === undefined) throw new Error("Invalid template resume step");
      const lastId = branchIds.at(-1);
      const lastStep = branch.steps.at(-1);
      const fromHandle = lastId === undefined ? handle : lastStep?.kind === "message" && (lastStep.buttons?.length ?? 0) > 0 ? "b1" : "next";
      edges.push({ id: `e${edges.length + 1}`, from: lastId ?? source, fromHandle, to: target });
    }
  });

  return { schemaVersion: 1, metadata: { name }, nodes, edges };
}

type FormField = { variable: string; text: string; expects?: "any" | "email" | "phone" | "number" };
type SolutionRoute = { label: string; intro: string; fields: readonly FormField[]; result: string };
type SolutionRecipe = { welcome: string; routes: readonly SolutionRoute[] };

const field = (variable: string, text: string, expects: FormField["expects"] = "any"): FormField => ({ variable, text, expects });
const phone = field("phone", "Оставьте телефон для связи с вашей командой.", "phone");
const person = field("name", "Как вас зовут?");
const email = field("email", "На какую почту можно ответить?", "email");
const when = field("when", "Какие дата и время вам удобны? Это пожелание — доступность подтвердит команда.");
const retry: Record<NonNullable<FormField["expects"]>, string> = {
  any: "Напишите ответ текстом, пожалуйста.",
  phone: "Введите телефон, например +7 900 123-45-67.",
  email: "Введите почту, например anna@example.com.",
  number: "Введите число, например 5000.",
};

/**
 * These are editable conversation recipes, not integrations or executable bot
 * archives. Every route saves its own answers and ends with an explicit summary.
 * Dates, stock and bookings are requests for the owner's manual confirmation.
 */
const recipes: Record<Exclude<FlowTemplateId, "blank">, SolutionRecipe> = {
  leads: { welcome: "Поможем разобраться с задачей. Что вам нужно?", routes: [
    { label: "Обсудить проект", intro: "Соберём короткий бриф, чтобы вы не объясняли всё заново при звонке.", fields: [person, field("task", "Что нужно сделать и какой результат вы ожидаете?"), field("budget", "Какой бюджет рассматриваете? Укажите число в рублях.", "number"), field("deadline", "К какому сроку нужен результат?"), phone], result: "Бриф на проект сохранён. Команда изучит задачу и свяжется с вами." },
    { label: "Узнать условия", intro: "Демонстрационные условия: знакомство бесплатно, объём и стоимость работ согласуются после брифа.", fields: [person, field("question", "Что хотите уточнить о работе или стоимости?"), phone], result: "Вопрос об условиях сохранён для команды." },
  ] },
  booking: { welcome: "Студия красоты. Выберите услугу — соберём заявку на удобное время.", routes: [
    { label: "Стрижка и укладка", intro: "Стрижка и укладка — пример услуги на 60 минут. Стоимость и время подтвердит администратор.", fields: [field("haircut", "Какую стрижку или укладку хотите?"), when, person, phone], result: "Заявка: стрижка и укладка. Запись не подтверждена автоматически — дождитесь ответа администратора." },
    { label: "Окрашивание", intro: "Для окрашивания сначала уточним длину волос и желаемый результат.", fields: [field("colour", "Какие сейчас длина и цвет волос? Какой результат нужен?"), field("history", "Когда было последнее окрашивание?"), when, person, phone], result: "Заявка: окрашивание. Администратор уточнит длительность, цену и свободное время." },
  ] },
  catalog: { welcome: "Витрина подарков. Выберите готовый набор или соберите заявку на свой.", routes: [
    { label: "Готовый набор", intro: "Пример ассортимента: «Уют» — 1 500 ₽, «Праздник» — 3 900 ₽. Наличие подтвердит менеджер.", fields: [field("product", "Какой набор выбрали?"), field("quantity", "Сколько наборов нужно? Укажите число.", "number"), field("delivery", "Самовывоз или доставка? Если доставка — укажите город."), person, phone], result: "Заявка на наборы сохранена. Менеджер подтвердит наличие и итоговую стоимость; оплата ещё не проводилась." },
    { label: "Корпоративный заказ", intro: "Для команды можно подготовить наборы с разным наполнением. Соберём техническое задание.", fields: [field("company", "Название компании и повод для подарков?"), field("quantity", "Сколько получателей? Укажите число.", "number"), field("budget", "Бюджет на один подарок в рублях?", "number"), field("deadline", "Когда нужны подарки?"), email], result: "Бриф на корпоративный заказ сохранён для расчёта менеджером." },
  ] },
  faq: { welcome: "Центр помощи. Ответим на частые вопросы или соберём обращение.", routes: [
    { label: "Часы работы", intro: "Пример графика: с 10:00 до 20:00. Замените адрес и часы под свой бизнес.", fields: [field("question", "Что ещё хотели бы уточнить о визите?"), phone], result: "Вопрос о визите сохранён для команды." },
    { label: "Стоимость и условия", intro: "Консультация по условиям бесплатна. Стоимость заказа подтверждает менеджер.", fields: [field("service", "О какой услуге или товаре вопрос?"), field("question", "Что нужно уточнить?"), phone], result: "Запрос по стоимости сохранён." },
    { label: "Написать оператору", intro: "Соберём контекст для оператора. Это обращение, а не подключение к живому чату.", fields: [field("order", "Номер заказа, если есть. Если нет — напишите «нет»."), field("issue", "Опишите проблему и что уже пробовали."), email], result: "Обращение сохранено. Команда ответит после просмотра; мгновенный ответ не гарантируется." },
  ] },
  delivery: { welcome: "Кухня рядом. Посмотрите меню и оставьте заявку на заказ.", routes: [
    { label: "Доставка", intro: "Демонстрационное меню: паста 390 ₽, суп 260 ₽, лимонад 220 ₽. Доступность и сумму подтвердит команда.", fields: [field("order", "Перечислите блюда и количество каждого."), field("address", "Адрес, подъезд и домофон?"), when, field("notes", "Пожелания к заказу? Если нет — напишите «нет»."), phone], result: "Заявка на доставку сохранена. Это не подтверждение приготовления или отправки курьера." },
    { label: "Самовывоз", intro: "Можно забрать заказ самостоятельно. Адрес точки и время готовности подтвердит команда.", fields: [field("order", "Какие блюда и в каком количестве приготовить?"), when, person, phone], result: "Заявка на самовывоз сохранена. Дождитесь подтверждения времени готовности." },
  ] },
  course: { welcome: "Мини-курс: первый клиент. Выберите урок или задайте вопрос преподавателю.", routes: [
    { label: "Пройти два урока", intro: "Урок 1. Опишите одного конкретного клиента: чем он занимается и какая задача у него возникает. Урок 2. Предложение должно называть результат, срок и следующий шаг.", fields: [field("audience", "Практика 1: кто ваш клиент и какую задачу нужно решить?"), field("offer", "Практика 2: напишите предложение из результата, срока и следующего шага."), field("self_check", "Самопроверка: что в предложении может быть непонятно клиенту?"), email], result: "Две практические работы сохранены для проверки преподавателем. Автоматической оценки или выдачи сертификата нет." },
    { label: "Вопрос по обучению", intro: "Можно уточнить программу или попросить помощь с упражнением.", fields: [person, field("lesson", "По какой теме или уроку вопрос?"), field("question", "Что именно вызывает затруднение?"), email], result: "Вопрос преподавателю сохранён." },
  ] },
  club: { welcome: "Клуб предпринимателей. Познакомимся перед вступлением.", routes: [
    { label: "Подать анкету", intro: "Сообщество для обмена опытом. Вступление рассматривает организатор, доступ автоматически не выдаётся.", fields: [person, field("business", "Чем занимаетесь и на каком этапе ваш проект?"), field("goal", "С чем хотите разобраться в клубе?"), field("contribution", "Каким опытом готовы поделиться?"), email], result: "Анкета на вступление сохранена. Организатор отдельно сообщит решение и условия." },
    { label: "Предложить встречу", intro: "Участники могут предложить тему разбора или выступление.", fields: [person, field("topic", "Тема и чему научатся участники?"), field("format", "Какой формат и длительность предлагаете?"), email], result: "Предложение встречи сохранено для организатора." },
  ] },
  quiz: { welcome: "Поможем составить запрос на подбор подарка.", routes: [
    { label: "Подарок близкому", intro: "Несколько вопросов помогут консультанту предложить уместные варианты.", fields: [field("recipient", "Кому подарок и по какому поводу?"), field("interests", "Что человек любит, а чего лучше избегать?"), field("budget", "Бюджет в рублях?", "number"), field("deadline", "Когда нужен подарок?"), phone], result: "Запрос на персональную подборку сохранён. Варианты подготовит консультант, не автоматический алгоритм." },
    { label: "Для себя", intro: "Соберём предпочтения, чтобы консультант не предлагал лишнее.", fields: [field("need", "Для какой задачи ищете вещь?"), field("preferences", "Какие характеристики для вас важны?"), field("budget", "Бюджет в рублях?", "number"), phone], result: "Ваши предпочтения сохранены для консультанта." },
  ] },
  event: { welcome: "Мастерская идей. Выберите формат участия.", routes: [
    { label: "Стать участником", intro: "Пример программы: знакомство, практическая работа и разбор вопросов. Дату и место организатор укажет до запуска.", fields: [person, field("topic", "Какая тема или вопрос вам интересны?"), field("guests", "Сколько человек хотите зарегистрировать?", "number"), phone], result: "Заявка на участие сохранена. Места и условия подтвердит организатор; билет автоматически не выпущен." },
    { label: "Выступить", intro: "Принимаем предложения от спикеров. Расскажите о докладе и своём опыте.", fields: [person, field("topic", "Тема выступления и три главных тезиса?"), field("experience", "Ваш опыт и ссылка на прошлые выступления, если есть?"), email], result: "Заявка спикера сохранена для программной команды." },
  ] },
  reviews: { welcome: "Помогите нам стать лучше. Как прошёл ваш визит?", routes: [
    { label: "Хочу поблагодарить", intro: "Спасибо! Расскажите, что понравилось — это поможет команде сохранить хороший опыт.", fields: [field("visit", "Какой услугой пользовались и когда?"), field("feedback", "Что понравилось больше всего?"), field("permission", "Можно ли цитировать отзыв на нашем сайте? Напишите «да» или «нет».")], result: "Отзыв сохранён вместе с вашим ответом о публикации. Ничего не публикуется автоматически." },
    { label: "Есть проблема", intro: "Нам важно разобраться. Опишите ситуацию — команда сможет рассмотреть обращение.", fields: [field("order", "Когда был визит или какой номер заказа?"), field("issue", "Что произошло?"), field("resolution", "Какой вариант решения вас устроит?"), phone], result: "Обращение с пожеланием по решению сохранено для команды." },
  ] },
  property: { welcome: "Недвижимость под вашу задачу: купить или арендовать?", routes: [
    { label: "Купить квартиру", intro: "Соберём параметры для специалиста. Это заявка на подбор, не база актуальных объявлений.", fields: [field("location", "Город и подходящие районы?"), field("rooms", "Сколько комнат и какая площадь нужны?"), field("budget", "Максимальный бюджет в рублях?", "number"), field("timing", "Когда планируете покупку и просмотр?"), phone], result: "Заявка на покупку сохранена. Специалист подготовит предложения и согласует просмотр." },
    { label: "Снять жильё", intro: "Уточним условия аренды, чтобы специалист мог подобрать варианты.", fields: [field("location", "Район и пожелания к транспорту?"), field("household", "Сколько жильцов, есть ли дети или питомцы?"), field("budget", "Бюджет аренды в месяц, в рублях?", "number"), field("move_in", "Когда планируете въезд и на какой срок?"), phone], result: "Заявка на аренду сохранена. Наличие и условия проверит специалист." },
  ] },
  recruiting: { welcome: "Команда растёт. Выберите направление и расскажите о себе.", routes: [
    { label: "Работа с клиентами", intro: "Пример вакансии: специалист поддержки. Обязанности — помогать клиентам и разбирать обращения; условия уточняет рекрутер.", fields: [person, field("experience", "Есть ли опыт поддержки или продаж? Расскажите на примере."), field("schedule", "Какой график и формат работы вам подходят?"), field("resume", "Ссылка на резюме или краткий рассказ о навыках?"), email], result: "Отклик в клиентскую команду сохранён. Решение и приглашение отправляет рекрутер." },
    { label: "Другая роль", intro: "Если подходящей вакансии нет, можно оставить анкету в резерв команды.", fields: [person, field("role", "Какую роль рассматриваете?"), field("skills", "Ваши ключевые навыки и опыт?"), field("resume", "Ссылка на портфолио или резюме? Если ссылки нет — напишите об опыте."), email], result: "Анкета в кадровый резерв сохранена для рекрутера." },
  ] },
  repair: { welcome: "Сервисный центр. Что нужно отремонтировать?", routes: [
    { label: "Телефон или планшет", intro: "Не разбирайте устройство самостоятельно. Сначала соберём информацию для диагностики.", fields: [field("model", "Производитель и модель устройства?"), field("fault", "Что не работает и после чего появилась проблема?"), field("history", "Был ли контакт с водой или предыдущий ремонт?"), when, phone], result: "Заявка на диагностику телефона или планшета сохранена. Стоимость и сроки определит мастер после осмотра." },
    { label: "Ноутбук или ПК", intro: "Опишите симптомы: это поможет мастеру подготовиться. Автоматической диагностики здесь нет.", fields: [field("model", "Модель ноутбука или конфигурация компьютера?"), field("fault", "Какие симптомы и сообщения об ошибке?"), field("data", "Нужно ли сохранить важные данные? Не присылайте пароли."), when, phone], result: "Заявка на диагностику компьютера сохранена для мастера." },
  ] },
  restaurant: { welcome: "Встречаем гостей. Оставьте пожелания к столику или мероприятию.", routes: [
    { label: "Столик", intro: "Запросим удобное время и количество гостей. Столик считается забронированным только после подтверждения администратором.", fields: [when, field("guests", "Сколько будет гостей?", "number"), field("preferences", "Пожелания: зона, детское кресло или особый повод?"), person, phone], result: "Заявка на столик сохранена. Дождитесь подтверждения администратора." },
    { label: "Банкет", intro: "Для праздника нужен небольшой бриф: дата, формат и бюджет.", fields: [field("occasion", "Какой повод и формат мероприятия?"), when, field("guests", "Ожидаемое количество гостей?", "number"), field("budget", "Общий бюджет в рублях?", "number"), phone], result: "Бриф на банкет сохранён. Администратор обсудит меню и условия отдельно." },
  ] },
  fitness: { welcome: "Выберите формат знакомства с клубом.", routes: [
    { label: "Пробное занятие", intro: "Познакомимся с вашими пожеланиями. Доступное время и условия пробного занятия подтвердит администратор.", fields: [person, field("activity", "Какое направление интересно: зал, йога, танцы или другое?"), field("experience", "Занимались раньше или начинаете?"), when, phone], result: "Заявка на пробное занятие сохранена. Бот не даёт медицинских рекомендаций или программы тренировок." },
    { label: "Персональный тренер", intro: "Расскажите о цели и расписании, чтобы команда могла предложить подходящего тренера.", fields: [person, field("goal", "Какую цель хотите обсудить с тренером?"), field("format", "Где хотите заниматься: клуб, улица или онлайн?"), when, phone], result: "Запрос на персонального тренера сохранён. План занятий согласуется со специалистом." },
  ] },
  consultation: { welcome: "Разберём задачу и подготовимся к консультации.", routes: [
    { label: "Разбор проекта", intro: "Соберём контекст, чтобы встреча началась с сути, а не с повторного знакомства.", fields: [person, field("project", "Коротко о проекте и вашей роли?"), field("problem", "Что сейчас не получается?"), field("result", "Какой результат хотите получить от консультации?"), email], result: "Бриф на разбор проекта сохранён. Специалист предложит формат и условия встречи." },
    { label: "Проверка материалов", intro: "Можно прислать ссылку на презентацию или описание задачи. Не отправляйте пароли и закрытые персональные данные.", fields: [field("material", "Ссылка на доступный материал или описание?"), field("criteria", "Что нужно проверить в первую очередь?"), field("deadline", "К какому сроку нужен ответ?"), email], result: "Запрос на проверку материалов сохранён для специалиста." },
  ] },
  photography: { welcome: "Фотосъёмка под ваш повод. Выберите формат.", routes: [
    { label: "Портрет или семья", intro: "Подготовим съёмку по вашему настроению: место, участники и референсы.", fields: [field("participants", "Кого снимаем и сколько будет участников?"), field("style", "Какое настроение и стиль хотите? Можно прислать ссылку на референс."), field("location", "Студия, улица или ваша локация?"), when, phone], result: "Бриф на портретную или семейную съёмку сохранён. Дату и стоимость подтвердит фотограф." },
    { label: "Репортаж", intro: "Для события уточним программу и ключевые моменты.", fields: [field("event", "Что за мероприятие и какие кадры особенно важны?"), field("location", "Место проведения?"), when, field("duration", "Сколько часов съёмки предполагается?", "number"), phone], result: "Бриф на репортаж сохранён. Фотограф уточнит доступность и условия." },
  ] },
  onboarding: { welcome: "Добро пожаловать в команду. Начните знакомство или задайте вопрос наставнику.", routes: [
    { label: "Первый рабочий день", intro: "Чек-лист: познакомьтесь с наставником, уточните расписание и запросите нужные рабочие доступы через принятый в компании канал. Пароли в бот не отправляйте.", fields: [person, field("team", "В какой команде и роли начинаете работу?"), field("done", "Что из чек-листа уже готово?"), field("help", "С чем нужна помощь в первую очередь?"), email], result: "Чек-лист новичка сохранён. Наставник сможет разобрать открытые вопросы; доступы автоматически не выдаются." },
    { label: "Вопрос наставнику", intro: "Соберём вопрос и контекст, чтобы наставнику было проще помочь.", fields: [person, field("topic", "Тема: процессы, инструменты, команда или другое?"), field("question", "Что хотите уточнить и что уже пробовали?"), email], result: "Вопрос наставнику сохранён." },
  ] },
};

/** Branch-specific variable names preserve the chosen route in collected answers. */
function createSolutionFlow(name: string, recipe: SolutionRecipe): BotFlowDocument {
  const routeSteps = (route: SolutionRoute, index: number): Step[] => {
    const fields = route.fields.map((item) => ({ ...item, variable: `r${index + 1}_${item.variable}` }));
    return [
      { kind: "message", text: route.intro, buttons: ["Продолжить"] },
      ...fields.map((item): Step => ({ kind: "question", text: item.text, variable: item.variable, expects: item.expects ?? "any", retryText: retry[item.expects ?? "any"] })),
      { kind: "message", text: `${route.result}\n\nВаши ответы:\n${fields.map((item) => `${item.text}\n{{${item.variable}}}`).join("\n\n")}` },
    ];
  };
  const first = recipe.routes[0];
  if (first === undefined) throw new Error("A solution needs at least one route");
  return lineFlow(name, "start", [
    { kind: "message", text: recipe.welcome, buttons: recipe.routes.map((route) => route.label) },
    ...routeSteps(first, 0),
  ], recipe.routes.slice(1).map((route, index) => ({ from: 0, button: route.label, steps: routeSteps(route, index + 1) })));
}

export function createFlowFromTemplate(template: FlowTemplateId, name: string): BotFlowDocument {
  const title = name.trim() || flowTemplateOptions.find((item) => item.id === template)?.title || "Мой бот";
  if (template === "blank") {
    return lineFlow(title, "start", [{ kind: "message", text: "Здравствуйте! Чем помочь?" }]);
  }
  return createSolutionFlow(title, recipes[template]);
}
