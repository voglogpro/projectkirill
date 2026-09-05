import { describe, expect, it } from "vitest";
import { botFlowDocumentSchema } from "../../../src/domain/bot-flow";
import { initialDialogState, runFlow, type DialogState } from "../../../src/domain/bot-flow-runtime";
import { createFlowFromTemplate, flowTemplateOptions } from "./flow-store";

describe("scenario templates", () => {
  it.each(flowTemplateOptions.map((option) => option.id))("%s is a valid scenario that answers /start", (id) => {
    const document = botFlowDocumentSchema.parse(createFlowFromTemplate(id, "Проверка"));
    const step = runFlow(document, initialDialogState(), { kind: "command", command: "/start" });
    expect(step.handled).toBe(true);
    expect(step.messages[0]?.text.length).toBeGreaterThan(0);
  });

  it("walks the leads template to the end and fills the variables in", () => {
    const document = botFlowDocumentSchema.parse(createFlowFromTemplate("leads", "Заявки"));
    let state = runFlow(document, initialDialogState(), { kind: "command", command: "/start" }).state;
    state = runFlow(document, state, { kind: "press", handle: "b1" }).state;
    state = runFlow(document, state, { kind: "text", text: "Анна" }).state;
    const done = runFlow(document, state, { kind: "text", text: "+7 900 123-45-67" });
    expect(done.state.variables.name).toBe("Анна");
    expect(done.messages.at(-1)?.text).toContain("Анна");
    expect(done.messages.at(-1)?.text).toContain("+7 900 123-45-67");
  });

  it("takes a branch button instead of the trunk", () => {
    const document = botFlowDocumentSchema.parse(createFlowFromTemplate("faq", "Вопросы"));
    const greeted = runFlow(document, initialDialogState(), { kind: "command", command: "/start" }).state;
    expect(runFlow(document, greeted, { kind: "press", handle: "b2" }).messages[0]?.text).toContain("Консультация");
    expect(runFlow(document, greeted, { kind: "press", handle: "b3" }).messages[0]?.text).toContain("оператору");
  });

  it.each(flowTemplateOptions.map((option) => option.id))("%s has no dead CTA or disconnected template node", (id) => {
    const document = createFlowFromTemplate(id, "Проверка всех кнопок");
    for (const node of document.nodes) {
      if (node.type !== "message") continue;
      for (const button of node.props.buttons.filter((button) => button.kind === "next")) {
        expect(document.edges.filter((edge) => edge.from === node.id && edge.fromHandle === button.id)).toHaveLength(1);
      }
    }
    const seen = new Set<string>();
    const queue = document.nodes.filter((node) => node.type === "start").map((node) => node.id);
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(...document.edges.filter((edge) => edge.from === next).map((edge) => edge.to));
    }
    expect(seen.size).toBe(document.nodes.length);
  });

  it.each(flowTemplateOptions.map((option) => option.id))("%s completes every available conversation branch", (id) => {
    const document = createFlowFromTemplate(id, "Проверка веток");
    function finishAllBranches(state: DialogState, depth: number): void {
      expect(depth).toBeLessThan(document.nodes.length * 2);
      if (state.awaiting === undefined) return;
      const current = document.nodes.find((node) => node.id === state.currentNodeId);
      expect(current).toBeDefined();
      if (current?.type === "message") {
        for (const button of current.props.buttons.filter((button) => button.kind === "next")) {
          const result = runFlow(document, state, { kind: "press", handle: button.id });
          expect(result.handled).toBe(true);
          expect(result.messages.length).toBeGreaterThan(0);
          finishAllBranches(result.state, depth + 1);
        }
      } else if (current?.type === "question") {
        const answers = { any: "Анна", phone: "+7 900 123-45-67", email: "anna@example.com", number: "5000" };
        const result = runFlow(document, state, { kind: "text", text: answers[current.props.expects] });
        expect(result.handled).toBe(true);
        expect(result.messages.length).toBeGreaterThan(0);
        finishAllBranches(result.state, depth + 1);
      } else {
        throw new Error("Scenario stopped on an unsupported interaction");
      }
    }
    finishAllBranches(runFlow(document, initialDialogState(), { kind: "command", command: "/start" }).state, 0);
  });
});
