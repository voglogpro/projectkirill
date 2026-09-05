import type { FlowTemplateId } from "./flow-store";

export type ScenarioCategory = "all" | "sales" | "services" | "community" | "support";
export type ReadyScenarioId = Exclude<FlowTemplateId, "blank">;

export interface ScenarioCard {
  id: ReadyScenarioId;
  title: string;
  description: string;
  category: Exclude<ScenarioCategory, "all">;
  tags: readonly string[];
  accent: "violet" | "cyan" | "mint" | "amber";
}

export const scenarioCategories: ReadonlyArray<{ id: ScenarioCategory; title: string }> = [
  { id: "all", title: "Все сценарии" },
  { id: "sales", title: "Продажи" },
  { id: "services", title: "Услуги" },
  { id: "community", title: "Обучение и события" },
  { id: "support", title: "Поддержка" },
];

/** Describe only what the bundled, editable scenario actually does. */
export const scenarioCards: readonly ScenarioCard[] = [
  { id: "leads", title: "Сбор заявок", description: "Знакомство, имя и телефон клиента. Контакты для обратного звонка.", category: "sales", tags: ["Имя и телефон", "Цены"], accent: "violet" },
  { id: "booking", title: "Запись на услугу", description: "Выбор услуги и контакты. Время записи вы подтверждаете сами.", category: "services", tags: ["Услуги", "Заявка на запись"], accent: "cyan" },
  { id: "catalog", title: "Витрина и цены", description: "Прайс, условия доставки и телефон для оформления заказа менеджером.", category: "sales", tags: ["Прайс", "Заявка на заказ"], accent: "mint" },
  { id: "faq", title: "Вопросы и ответы", description: "Ответы кнопками: часы работы, стоимость и запрос помощи человека.", category: "support", tags: ["FAQ", "Запрос оператору"], accent: "violet" },
  { id: "delivery", title: "Меню и доставка", description: "Меню с ценами, адрес и телефон. Заказ обрабатывается вашей командой.", category: "sales", tags: ["Меню", "Адрес и телефон"], accent: "amber" },
  { id: "course", title: "Первый урок", description: "Текст урока и сбор домашнего задания для вашей проверки.", category: "community", tags: ["Материал урока", "Ответ ученика"], accent: "cyan" },
  { id: "club", title: "Заявка в клуб", description: "Рассказ о сообществе и анкета. Решение о вступлении принимаете вы.", category: "community", tags: ["Анкета", "Контакт для связи"], accent: "violet" },
  { id: "quiz", title: "Подбор по запросу", description: "Вопросы о получателе и бюджете, телефон для отправки вашей подборки.", category: "sales", tags: ["Бюджет", "Контакт клиента"], accent: "mint" },
  { id: "event", title: "Запись на событие", description: "Описание встречи, имя и телефон участника. Без автоматической рассылки.", category: "community", tags: ["Программа", "Регистрация"], accent: "amber" },
  { id: "reviews", title: "Отзывы клиентов", description: "Положительный отзыв или подробный комментарий, если что-то пошло не так.", category: "support", tags: ["Обратная связь", "Замечания"], accent: "cyan" },
];

function normalize(value: string): string {
  return value.toLocaleLowerCase("ru-RU").replaceAll("ё", "е").trim();
}

/** AND-match search words against meaningful card content, within the selected category. */
export function filterScenarios(query: string, category: ScenarioCategory): readonly ScenarioCard[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return scenarioCards.filter((card) => {
    if (category !== "all" && card.category !== category) return false;
    const text = normalize([card.title, card.description, ...card.tags].join(" "));
    return words.every((word) => text.includes(word));
  });
}
