import { describe, expect, it } from "vitest";
import { botFlowDocumentSchema } from "../../../src/domain/bot-flow";
import { initialDialogState, runFlow } from "../../../src/domain/bot-flow-runtime";
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
});
