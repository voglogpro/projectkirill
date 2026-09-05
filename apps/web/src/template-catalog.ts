import { createFlowFromTemplate, type FlowTemplateId } from "./flow-store";

export type ScenarioCategory = "all" | "sales" | "services" | "community" | "support";
export type ReadyScenarioId = Exclude<FlowTemplateId, "blank">;
export interface ScenarioCard {
  id: ReadyScenarioId;
  title: string;
  description: string;
  category: Exclude<ScenarioCategory, "all">;
  tags: readonly string[];
  accent: "violet" | "cyan" | "mint" | "amber";
  /** Unique visual subject; the cover must show the job, not a generic chat. */
  artwork: ReadyScenarioId;
  outcome: string;
  setup: readonly string[];
  nodeCount: number;
}

export const scenarioCategories: ReadonlyArray<{ id: ScenarioCategory; title: string }> = [
  { id: "all", title: "Все решения" },
  { id: "sales", title: "Продажи" },
  { id: "services", title: "Услуги" },
  { id: "community", title: "Обучение и команда" },
  { id: "support", title: "Поддержка" },
];

type CardInput = Omit<ScenarioCard, "artwork" | "nodeCount">;
/** Capabilities match the editable conversation shipped with each card. */
const cards: readonly CardInput[] = [
  { id: "leads", title: "Бриф и заявки", description: "Два пути: обсудить проект или уточнить условия. Задача, бюджет, срок и контакт собираются в готовый бриф.", category: "sales", tags: ["Бюджет и сроки", "Имя и телефон", "Два маршрута"], accent: "violet", outcome: "Бриф с задачей и контактами для первого звонка", setup: ["Опишите свои услуги", "Замените условия знакомства", "Уточните вопросы о проекте"] },
  { id: "booking", title: "Салон красоты", description: "Стрижка и окрашивание с разными вопросами, пожеланием по времени и контактами. Запись подтверждает администратор.", category: "services", tags: ["Заявка на запись", "Услуги", "Пожелания к визиту"], accent: "cyan", outcome: "Заявка на услугу с пожеланиями и временем", setup: ["Добавьте свои услуги", "Укажите длительность и условия", "Настройте вопросы клиенту"] },
  { id: "catalog", title: "Магазин подарков", description: "Готовые наборы и корпоративный заказ: количество, бюджет, срок и способ получения. Менеджер подтверждает наличие и цену.", category: "sales", tags: ["Наборы", "Корпоративный заказ", "Количество"], accent: "mint", outcome: "Заявка на наборы или корпоративный заказ", setup: ["Замените ассортимент и цены", "Укажите условия получения", "Настройте бриф для компаний"] },
  { id: "faq", title: "Центр поддержки", description: "Условия, график и отдельный маршрут обращения: номер заказа, описание проблемы и проверка email.", category: "support", tags: ["FAQ", "Обращения", "Проверка email"], accent: "violet", outcome: "Структурированное обращение для команды поддержки", setup: ["Заполните график и условия", "Замените частые вопросы", "Уточните порядок ответа"] },
  { id: "delivery", title: "Кухня и доставка", description: "Доставка или самовывоз: блюда, количество, адрес, пожелания ко времени. Заказ подтверждает команда кухни.", category: "sales", tags: ["Меню", "Адрес", "Самовывоз"], accent: "amber", outcome: "Заявка с составом заказа и способом получения", setup: ["Замените меню и цены", "Укажите точку самовывоза", "Опишите правила подтверждения"] },
  { id: "course", title: "Мини-курс с практикой", description: "Два упражнения по работе с клиентом, самопроверка и отдельный путь вопросов преподавателю. Работы проверяются вручную.", category: "community", tags: ["Два упражнения", "Самопроверка", "Вопрос преподавателю"], accent: "cyan", outcome: "Практические работы и контакт ученика для обратной связи", setup: ["Замените содержание уроков", "Подготовьте свои задания", "Опишите порядок проверки"] },
  { id: "club", title: "Клуб предпринимателей", description: "Анкета на вступление с целями и опытом. Второй маршрут — предложение встречи или выступления.", category: "community", tags: ["Анкета участника", "Предложение встречи"], accent: "violet", outcome: "Анкета участника или предложение для программы клуба", setup: ["Опишите ценность сообщества", "Уточните критерии вступления", "Замените вопросы анкеты"] },
  { id: "quiz", title: "Подбор подарка", description: "Разные брифы для себя и близкого: интересы, ограничения, бюджет и срок. Подборку готовит консультант.", category: "sales", tags: ["Предпочтения", "Бюджет", "Подарок"], accent: "mint", outcome: "Понятный запрос для персональной подборки консультантом", setup: ["Определите предмет подбора", "Замените вопросы о предпочтениях", "Опишите срок ответа"] },
  { id: "event", title: "Участники и спикеры", description: "Регистрация группы участников или заявка докладчика с темой и опытом. Организатор подтверждает места.", category: "community", tags: ["Группа гостей", "Заявка спикера"], accent: "amber", outcome: "Заявки участников и предложения докладов", setup: ["Укажите дату и место", "Добавьте программу", "Настройте вопросы спикеру"] },
  { id: "reviews", title: "Отзывы и обращения", description: "Положительный отзыв с вопросом о публикации или описание проблемы с желаемым решением и контактом.", category: "support", tags: ["Отзыв", "Разрешение на цитату", "Разбор проблемы"], accent: "cyan", outcome: "Отзыв или обращение с контекстом для разбора", setup: ["Назовите услугу или продукт", "Уточните вопрос о публикации", "Опишите порядок ответа на жалобы"] },
  { id: "property", title: "Подбор недвижимости", description: "Покупка и аренда с разными анкетами: район, жильцы, бюджет, срок и контакт для специалиста.", category: "sales", tags: ["Покупка", "Аренда", "Бюджет"], accent: "mint", outcome: "Параметры покупки или аренды для агента", setup: ["Укажите регион работы", "Уточните критерии подбора", "Добавьте условия просмотра"] },
  { id: "recruiting", title: "Рекрутер команды", description: "Отклик в клиентскую команду или кадровый резерв: навыки, опыт, график, резюме и email.", category: "community", tags: ["Вакансия", "Резюме", "Кадровый резерв"], accent: "violet", outcome: "Анкета кандидата для рассмотрения рекрутером", setup: ["Замените описание вакансии", "Укажите реальные условия", "Настройте вопросы об опыте"] },
  { id: "repair", title: "Сервисный центр", description: "Телефон или компьютер: модель, симптомы, история ремонта, пожелание по времени и телефон клиента.", category: "services", tags: ["Диагностика", "Модель устройства", "Симптомы"], accent: "cyan", outcome: "Карточка обращения для предварительного разбора мастером", setup: ["Укажите виды техники", "Опишите условия диагностики", "Настройте вопросы о неисправности"] },
  { id: "restaurant", title: "Столик и банкет", description: "Два маршрута: визит в ресторан или праздник. Дата, гости, пожелания и бюджет банкета.", category: "services", tags: ["Столик", "Банкет", "Гости"], accent: "amber", outcome: "Запрос на столик или бриф на банкет", setup: ["Добавьте описание ресторана", "Укажите условия бронирования", "Уточните вопросы для банкета"] },
  { id: "fitness", title: "Фитнес-клуб", description: "Пробное занятие или персональный тренер: направление, опыт, цель и удобное расписание.", category: "services", tags: ["Пробное занятие", "Тренер", "Расписание"], accent: "mint", outcome: "Заявка на знакомство с клубом или тренером", setup: ["Добавьте направления клуба", "Укажите условия пробного визита", "Настройте вопросы о формате"] },
  { id: "consultation", title: "Экспертная консультация", description: "Бриф на разбор проекта или проверку материалов: проблема, ожидаемый результат, ссылки и срок.", category: "services", tags: ["Бриф", "Материалы", "Результат"], accent: "violet", outcome: "Контекст задачи до первой встречи с экспертом", setup: ["Опишите вашу специализацию", "Замените вопросы брифа", "Укажите условия консультации"] },
  { id: "photography", title: "Фотограф", description: "Портретная съёмка или репортаж: участники, стиль, локация, дата и длительность.", category: "services", tags: ["Портрет", "Репортаж", "Референсы"], accent: "amber", outcome: "Бриф на съёмку с пожеланиями клиента", setup: ["Опишите форматы съёмки", "Укажите условия согласования", "Добавьте вопросы по подготовке"] },
  { id: "onboarding", title: "Первый день в команде", description: "Чек-лист новичка и отдельный путь вопроса наставнику. Роль, выполненные шаги и запрос на помощь.", category: "community", tags: ["Чек-лист", "Наставник", "Адаптация"], accent: "cyan", outcome: "Статус знакомства новичка и открытые вопросы наставнику", setup: ["Замените чек-лист компании", "Укажите каналы выдачи доступов", "Настройте вопросы наставнику"] },
];

// Counts come from the actual graph; copy changes cannot make the badge fictitious.
export const scenarioCards: readonly ScenarioCard[] = cards.map((card) => ({
  ...card,
  artwork: card.id,
  nodeCount: createFlowFromTemplate(card.id, card.title).nodes.length,
}));

function normalize(value: string): string {
  return value.toLocaleLowerCase("ru-RU").replaceAll("ё", "е").trim();
}

/** AND-match words against meaningful content, within the selected category. */
export function filterScenarios(query: string, category: ScenarioCategory): readonly ScenarioCard[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return scenarioCards.filter((card) => {
    if (category !== "all" && card.category !== category) return false;
    const text = normalize([card.title, card.description, card.outcome, ...card.tags].join(" "));
    return words.every((word) => text.includes(word));
  });
}
