import { describe, expect, it } from "vitest";
import { botFlowDocumentSchema } from "../../../src/domain/bot-flow";
import { initialDialogState, runFlow } from "../../../src/domain/bot-flow-runtime";
import { canConnect, connectFlow, replaceFlowNode } from "./flow-connections";
import { createStarterFlow } from "./flow-store";

describe("canvas and touch connections", () => {
  it("reconnects the target without leaving the old wire and preserves its id", () => {
    const flow = createStarterFlow();
    const edge = flow.edges[1]!;
    const target = flow.nodes[5]!;
    const next = connectFlow(flow, { source: edge.from, sourceHandle: edge.fromHandle, target: target.id }, edge.id);
    expect(next.edges).toHaveLength(flow.edges.length);
    expect(next.edges.find((item) => item.id === edge.id)?.to).toBe(target.id);
    expect(flow.edges[1]).toEqual(edge);
    expect(botFlowDocumentSchema.safeParse(next).success).toBe(true);
    const state = runFlow(next, initialDialogState(), { kind: "command", command: "/start" }).state;
    expect(runFlow(next, state, { kind: "press", handle: "book" }).messages[0]?.text).toContain("Консультация");
  });

  it("moves the source onto an occupied exit atomically", () => {
    const flow = createStarterFlow();
    const [first, second] = flow.edges;
    const next = connectFlow(flow, { source: second!.from, sourceHandle: second!.fromHandle, target: first!.to }, first!.id);
    // A connection to the source node itself is invalid and must not remove anything.
    expect(next).toBe(flow);
    const valid = connectFlow(flow, { source: second!.from, sourceHandle: second!.fromHandle, target: flow.nodes[4]!.id }, first!.id);
    expect(valid.edges).toHaveLength(flow.edges.length - 1);
    expect(valid.edges.some((edge) => edge.id === second!.id)).toBe(false);
    expect(valid.edges.find((edge) => edge.id === first!.id)?.from).toBe(second!.from);
  });

  it("rejects missing nodes, commands as targets, self links and removed handles", () => {
    const flow = createStarterFlow();
    const source = flow.nodes[1]!.id;
    for (const connection of [
      { source, sourceHandle: "book", target: null },
      { source, sourceHandle: "book", target: "missing" },
      { source, sourceHandle: "book", target: flow.nodes[0]!.id },
      { source, sourceHandle: "book", target: source },
      { source, sourceHandle: "missing", target: flow.nodes[2]!.id },
    ]) {
      expect(canConnect(flow, connection)).toBe(false);
      expect(connectFlow(flow, connection, flow.edges[1]!.id)).toBe(flow);
    }
  });

  it("mobile target changes replace an exit, not add parallel routes", () => {
    const flow = createStarterFlow();
    const edge = flow.edges[1]!;
    const connection = { source: edge.from, sourceHandle: edge.fromHandle, target: flow.nodes[4]!.id };
    const next = connectFlow(flow, connection);
    expect(next.edges.filter((item) => item.from === edge.from && item.fromHandle === edge.fromHandle)).toHaveLength(1);
    expect(connectFlow(next, connection)).toBe(next);
  });

  it("cleans orphan wires when message buttons change", () => {
    const flow = createStarterFlow();
    const message = flow.nodes[1]!;
    if (message.type !== "message") throw new Error("Expected a message");
    const next = replaceFlowNode(flow, { ...message, props: { ...message.props, buttons: message.props.buttons.filter((button) => button.id !== "book") } });
    expect(next.edges.some((edge) => edge.from === message.id && edge.fromHandle === "book")).toBe(false);
    expect(next.edges.some((edge) => edge.from === message.id && edge.fromHandle === "prices")).toBe(true);
  });
});
