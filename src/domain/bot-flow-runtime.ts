import type { BotFlowDocument, FlowNode } from "./bot-flow.js";

/**
 * Pure interpreter for a bot scenario: (state, event) -> (messages, state).
 * The preview simulator and the Telegram worker share it, so what the owner
 * tries in the editor is exactly what a subscriber gets in the chat.
 */

export interface DialogState {
  /** Node the dialogue is parked at while it waits for the subscriber. */
  currentNodeId?: string;
  awaiting?: "press" | "text";
  variables: Record<string, string>;
}

export type FlowEvent =
  | { kind: "command"; command: string }
  | { kind: "text"; text: string }
  | { kind: "press"; handle: string };

export interface FlowButton {
  id: string;
  label: string;
  kind: "next" | "url" | "miniapp";
  url?: string;
}

export interface FlowMessage {
  text: string;
  buttons: FlowButton[];
  /** Pause to apply before sending, in seconds. */
  delaySeconds?: number;
}

export interface FlowStep {
  state: DialogState;
  messages: FlowMessage[];
  /** False when nothing in the scenario answers this event. */
  handled: boolean;
}

/** A scenario that loops through nodes without emitting must not hang a worker. */
const MAX_STEPS = 50;

export function initialDialogState(): DialogState {
  return { variables: {} };
}

export function runFlow(document: BotFlowDocument, state: DialogState, event: FlowEvent): FlowStep {
  const nodes = new Map(document.nodes.map((node) => [node.id, node]));
  const current = state.currentNodeId === undefined ? undefined : nodes.get(state.currentNodeId);

  if (event.kind === "command") {
    const start = document.nodes.find((node) => node.type === "start" && node.props.command === normalizeCommand(event.command));
    if (start === undefined) return { state, messages: [], handled: false };
    return walk(document, nodes, { variables: state.variables }, start.id, "next");
  }

  if (event.kind === "press") {
    if (current?.type !== "message" || state.awaiting !== "press") return { state, messages: [], handled: false };
    const button = current.props.buttons.find((item) => item.id === event.handle);
    if (button === undefined) return { state, messages: [], handled: false };
    // Link buttons open something outside the scenario and move nothing.
    if (button.kind !== "next") return { state, messages: [], handled: true };
    return walk(document, nodes, state, current.id, button.id);
  }

  if (current?.type !== "question" || state.awaiting !== "text") return { state, messages: [], handled: false };
  const answer = event.text.trim();
  if (!accepts(current.props.expects, answer)) {
    return { state, messages: [{ text: interpolate(current.props.retryText, state.variables), buttons: [] }], handled: true };
  }
  const variables = { ...state.variables, [current.props.variable]: answer };
  return walk(document, nodes, { ...state, variables }, current.id, "next");
}

function walk(
  document: BotFlowDocument,
  nodes: ReadonlyMap<string, FlowNode>,
  state: DialogState,
  fromNodeId: string,
  fromHandle: string,
): FlowStep {
  const messages: FlowMessage[] = [];
  let variables = state.variables;
  let pendingDelay: number | undefined;
  let nodeId = fromNodeId;
  let handle = fromHandle;

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const edge = document.edges.find((item) => item.from === nodeId && item.fromHandle === handle);
    if (edge === undefined) return { state: { variables }, messages, handled: true };
    const node = nodes.get(edge.to);
    if (node === undefined) return { state: { variables }, messages, handled: true };
    nodeId = node.id;
    handle = "next";

    if (node.type === "start") continue;

    if (node.type === "delay") {
      pendingDelay = (pendingDelay ?? 0) + node.props.seconds;
      continue;
    }

    if (node.type === "choice") {
      const matched = node.props.conditions.find((condition) => matches(condition, variables));
      handle = matched?.id ?? "else";
      continue;
    }

    if (node.type === "handoff") {
      messages.push(emit(node.props.text, [], variables, pendingDelay));
      return { state: { variables }, messages, handled: true };
    }

    if (node.type === "question") {
      messages.push(emit(node.props.text, [], variables, pendingDelay));
      return { state: { currentNodeId: node.id, awaiting: "text", variables }, messages, handled: true };
    }

    const buttons = node.props.buttons.map((button) => ({
      id: button.id,
      label: interpolate(button.label, variables),
      kind: button.kind,
      ...(button.kind === "url" ? { url: button.url } : {}),
    }));
    messages.push(emit(node.props.text, buttons, variables, pendingDelay));
    pendingDelay = undefined;
    // Only a callback button parks the dialogue; link-only messages flow on.
    if (buttons.some((button) => button.kind === "next")) {
      return { state: { currentNodeId: node.id, awaiting: "press", variables }, messages, handled: true };
    }
  }

  return { state: { variables }, messages, handled: true };
}

function emit(text: string, buttons: FlowButton[], variables: Record<string, string>, delaySeconds?: number): FlowMessage {
  return { text: interpolate(text, variables), buttons, ...(delaySeconds === undefined ? {} : { delaySeconds }) };
}

/** `{{name}}` is replaced by what the subscriber answered earlier. */
export function interpolate(text: string, variables: Record<string, string>): string {
  return text.replaceAll(/\{\{\s*([a-z][a-z0-9_]{0,31})\s*\}\}/g, (_match, name: string) => variables[name] ?? "");
}

function normalizeCommand(command: string): string {
  return command.trim().replace(/^\//, "").split(/[\s@]/)[0]?.toLowerCase() ?? "";
}

function matches(condition: { variable: string; operator: string; value: string }, variables: Record<string, string>): boolean {
  const actual = variables[condition.variable] ?? "";
  switch (condition.operator) {
    case "eq": return actual.toLowerCase() === condition.value.toLowerCase();
    case "neq": return actual.toLowerCase() !== condition.value.toLowerCase();
    case "contains": return actual.toLowerCase().includes(condition.value.toLowerCase());
    case "empty": return actual === "";
    default: return actual !== "";
  }
}

function accepts(expects: "any" | "email" | "phone" | "number", answer: string): boolean {
  if (answer === "") return false;
  if (expects === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(answer);
  if (expects === "phone") return /^\+?[\d\s()-]{5,20}$/.test(answer) && (answer.match(/\d/g)?.length ?? 0) >= 5;
  if (expects === "number") return /^-?\d+([.,]\d+)?$/.test(answer);
  return true;
}
