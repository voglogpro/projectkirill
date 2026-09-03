import { describe, expect, it } from "vitest";
import { botFlowDocumentSchema, type BotFlowDocument } from "../src/domain/bot-flow.js";
import { initialDialogState, interpolate, runFlow } from "../src/domain/bot-flow-runtime.js";

const at = { x: 0, y: 0 };
const ids = { start: crypto.randomUUID(), greeting: crypto.randomUUID(), ask: crypto.randomUUID(), pick: crypto.randomUUID(), yes: crypto.randomUUID(), no: crypto.randomUUID() };

/** Greeting with two buttons, a question, a branch — the shape most bots start as. */
function scenario(): BotFlowDocument {
  return botFlowDocumentSchema.parse({
    schemaVersion: 1,
    metadata: { name: "Запись на услугу" },
    nodes: [
      { id: ids.start, version: 1, position: at, type: "start", props: { command: "start", description: "Начало" } },
      { id: ids.greeting, version: 1, position: at, type: "message", props: { text: "Привет! Записать вас?", buttons: [{ id: "book", kind: "next", label: "Записаться" }, { id: "site", kind: "url", label: "Сайт", url: "https://example.com" }] } },
      { id: ids.ask, version: 1, position: at, type: "question", props: { text: "Как вас зовут?", variable: "name", expects: "any" } },
      { id: ids.pick, version: 1, position: at, type: "choice", props: { conditions: [{ id: "named", variable: "name", operator: "filled", value: "" }] } },
      { id: ids.yes, version: 1, position: at, type: "message", props: { text: "Готово, {{name}}!" } },
      { id: ids.no, version: 1, position: at, type: "message", props: { text: "Имя не указано." } },
    ],
    edges: [
      { id: "e1", from: ids.start, fromHandle: "next", to: ids.greeting },
      { id: "e2", from: ids.greeting, fromHandle: "book", to: ids.ask },
      { id: "e3", from: ids.ask, fromHandle: "next", to: ids.pick },
      { id: "e4", from: ids.pick, fromHandle: "named", to: ids.yes },
      { id: "e5", from: ids.pick, fromHandle: "else", to: ids.no },
    ],
  });
}

describe("bot flow document", () => {
  it("requires a start command and unique commands", () => {
    const document = scenario();
    expect(() => botFlowDocumentSchema.parse({ ...document, nodes: document.nodes.filter((node) => node.type !== "start") })).toThrow();
    expect(() => botFlowDocumentSchema.parse({ ...document, nodes: [...document.nodes, { id: crypto.randomUUID(), version: 1, position: at, type: "start", props: { command: "start", description: "" } }] })).toThrow();
  });

  it("rejects an edge to a missing node and a second edge on one exit", () => {
    const document = scenario();
    expect(() => botFlowDocumentSchema.parse({ ...document, edges: [...document.edges, { id: "e6", from: ids.start, fromHandle: "next", to: crypto.randomUUID() }] })).toThrow();
    expect(() => botFlowDocumentSchema.parse({ ...document, edges: [...document.edges, { id: "e6", from: ids.greeting, fromHandle: "book", to: ids.no }] })).toThrow();
  });
});

describe("bot flow runtime", () => {
  it("answers /start with the greeting and parks on its buttons", () => {
    const step = runFlow(scenario(), initialDialogState(), { kind: "command", command: "/start" });
    expect(step.handled).toBe(true);
    expect(step.messages).toHaveLength(1);
    expect(step.messages[0]?.text).toBe("Привет! Записать вас?");
    expect(step.messages[0]?.buttons.map((button) => button.kind)).toEqual(["next", "url"]);
    expect(step.state.awaiting).toBe("press");
  });

  it("ignores an unknown command and a press on a stale button", () => {
    const document = scenario();
    expect(runFlow(document, initialDialogState(), { kind: "command", command: "/menu" }).handled).toBe(false);
    const parked = runFlow(document, initialDialogState(), { kind: "command", command: "start" }).state;
    expect(runFlow(document, parked, { kind: "press", handle: "missing" }).handled).toBe(false);
  });

  it("stores the answer, takes the matching branch and fills the variable in", () => {
    const document = scenario();
    const greeted = runFlow(document, initialDialogState(), { kind: "command", command: "start" }).state;
    const asked = runFlow(document, greeted, { kind: "press", handle: "book" });
    expect(asked.messages[0]?.text).toBe("Как вас зовут?");
    expect(asked.state.awaiting).toBe("text");

    const done = runFlow(document, asked.state, { kind: "text", text: " Анна " });
    expect(done.state.variables.name).toBe("Анна");
    expect(done.messages[0]?.text).toBe("Готово, Анна!");
    expect(done.state.awaiting).toBeUndefined();
  });

  it("repeats the question when the answer does not match what it expects", () => {
    const document = botFlowDocumentSchema.parse({
      ...scenario(),
      nodes: scenario().nodes.map((node) => node.id === ids.ask ? { ...node, props: { ...node.props, expects: "email", retryText: "Нужен email." } } : node),
    });
    const greeted = runFlow(document, initialDialogState(), { kind: "command", command: "start" }).state;
    const asked = runFlow(document, greeted, { kind: "press", handle: "book" }).state;
    const retry = runFlow(document, asked, { kind: "text", text: "не почта" });
    expect(retry.messages[0]?.text).toBe("Нужен email.");
    expect(retry.state.awaiting).toBe("text");
    expect(runFlow(document, asked, { kind: "text", text: "anna@example.com" }).state.variables.name).toBe("anna@example.com");
  });

  it("carries a delay onto the message that follows it", () => {
    const pause = crypto.randomUUID();
    const document = botFlowDocumentSchema.parse({
      ...scenario(),
      nodes: [...scenario().nodes, { id: pause, version: 1, position: at, type: "delay", props: { seconds: 3 } }],
      edges: [
        { id: "e1", from: ids.start, fromHandle: "next", to: pause },
        { id: "e1b", from: pause, fromHandle: "next", to: ids.greeting },
        ...scenario().edges.filter((edge) => edge.from !== ids.start),
      ],
    });
    expect(runFlow(document, initialDialogState(), { kind: "command", command: "start" }).messages[0]?.delaySeconds).toBe(3);
  });

  it("leaves an unknown placeholder empty instead of printing it", () => {
    expect(interpolate("Здравствуйте, {{name}}{{missing}}!", { name: "Пётр" })).toBe("Здравствуйте, Пётр!");
  });
});
