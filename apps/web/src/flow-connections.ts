import type { BotFlowDocument, FlowNode } from "../../../src/domain/bot-flow";
import { exitsOf } from "./flow-store";

export type FlowConnection = { source: string | null; sourceHandle?: string | null; target: string | null };

/** Only real exits may be wired. Loops to other steps remain valid for menus. */
export function canConnect(flow: BotFlowDocument, connection: FlowConnection): boolean {
  const source = flow.nodes.find((node) => node.id === connection.source);
  const target = flow.nodes.find((node) => node.id === connection.target);
  return source !== undefined && target !== undefined && source.id !== target.id && target.type !== "start"
    && exitsOf(source).some((exit) => exit.handle === (connection.sourceHandle ?? "next"));
}

/** Rewiring is atomic: retain the edge id, replace an occupied exit, never drop on invalid input. */
export function connectFlow(flow: BotFlowDocument, connection: FlowConnection, edgeId?: string): BotFlowDocument {
  if (!canConnect(flow, connection) || (edgeId !== undefined && !flow.edges.some((edge) => edge.id === edgeId))) return flow;
  const from = connection.source!;
  const to = connection.target!;
  const fromHandle = connection.sourceHandle ?? "next";
  const existing = flow.edges.find((edge) => edge.from === from && edge.fromHandle === fromHandle);
  if (existing?.to === to && (edgeId === undefined || existing.id === edgeId)) return flow;
  const id = edgeId ?? existing?.id ?? `e-${crypto.randomUUID()}`;
  return { ...flow, edges: [
    ...flow.edges.filter((edge) => edge.id !== id && !(edge.from === from && edge.fromHandle === fromHandle)),
    { id, from, fromHandle, to },
  ] };
}

/** Removing a button/condition also removes its now invisible outgoing wire. */
export function replaceFlowNode(flow: BotFlowDocument, next: FlowNode): BotFlowDocument {
  const handles = new Set(exitsOf(next).map((exit) => exit.handle));
  return { ...flow, nodes: flow.nodes.map((node) => node.id === next.id ? next : node),
    edges: flow.edges.filter((edge) => edge.from !== next.id || handles.has(edge.fromHandle)) };
}

export function flowNodeLabel(node: FlowNode): string {
  if (node.type === "start") return `/${node.props.command}`;
  if (node.type === "choice") return "Условие";
  if (node.type === "delay") return `Пауза · ${node.props.seconds} сек.`;
  return node.props.text.slice(0, 65) || "Без текста";
}
