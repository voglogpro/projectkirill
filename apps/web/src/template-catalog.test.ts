import { describe, expect, it } from "vitest";
import { botFlowDocumentSchema } from "../../../src/domain/bot-flow";
import { createFlowFromTemplate, flowTemplateOptions } from "./flow-store";
import { filterScenarios, scenarioCards, scenarioCategories } from "./template-catalog";

describe("ready scenario catalog", () => {
  it("covers every ready scenario exactly once without a fake blank product", () => {
    expect(scenarioCards.map((card) => card.id).sort()).toEqual(flowTemplateOptions.filter((template) => template.id !== "blank").map((template) => template.id).sort());
    expect(new Set(scenarioCards.map((card) => card.id)).size).toBe(18);
  });
  it.each(scenarioCards)("$id opens a valid actual scenario", (card) => {
    const document = botFlowDocumentSchema.parse(createFlowFromTemplate(card.id, card.title));
    expect(document.metadata.name).toBe(card.title);
    expect(document.nodes.some((node) => node.type === "message")).toBe(true);
    expect(scenarioCategories.some((category) => category.id === card.category)).toBe(true);
    expect(card.nodeCount).toBe(document.nodes.length);
    expect(card.artwork).toBe(card.id);
    expect(card.outcome.length).toBeGreaterThan(20);
    expect(card.setup).toHaveLength(3);
  });
  it("filters category and searches title, description and tags without case sensitivity", () => {
    expect(filterScenarios("  ОКРАШИВАНИЕ  ", "services").map((card) => card.id)).toEqual(["booking"]);
    expect(filterScenarios("  имя   телефон ", "sales").map((card) => card.id)).toEqual(["leads"]);
    expect(filterScenarios("FAQ", "support").map((card) => card.id)).toEqual(["faq"]);
    expect(filterScenarios("запись", "support")).toEqual([]);
  });
  it("can recover from empty results and shows all templates for whitespace", () => {
    expect(filterScenarios("несуществующий сценарий", "all")).toEqual([]);
    expect(filterScenarios("", "all")).toHaveLength(18);
    expect(filterScenarios("   ", "all")).toHaveLength(18);
  });
  it("offers distinguishable visual subjects and searches new jobs", () => {
    expect(new Set(scenarioCards.map((card) => card.artwork)).size).toBe(18);
    expect(filterScenarios("аренда", "sales").map((card) => card.id)).toEqual(["property"]);
    expect(filterScenarios("резюме", "community").map((card) => card.id)).toEqual(["recruiting"]);
    expect(filterScenarios("репортаж", "services").map((card) => card.id)).toEqual(["photography"]);
  });
});
