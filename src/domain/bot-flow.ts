import { z } from "zod";

/**
 * Bot scenario document. Like the page document, this is the single source of
 * truth: the canvas editor, the preview simulator and the Telegram worker all
 * read the same tree, and it never carries executable code.
 */

const nodeId = z.uuid();
const handleId = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);
const variableName = z.string().regex(/^[a-z][a-z0-9_]{0,31}$/);

/** Telegram rejects longer values, so the editor must not let them through. */
const MESSAGE_LIMIT = 4096;
const BUTTON_LABEL_LIMIT = 64;

const position = z.object({ x: z.number().finite(), y: z.number().finite() }).strict();

const baseNode = { id: nodeId, version: z.literal(1), position };

const buttonSchema = z.discriminatedUnion("kind", [
  // A callback button continues the scenario along the edge that leaves it.
  z.object({ id: handleId, kind: z.literal("next"), label: z.string().min(1).max(BUTTON_LABEL_LIMIT) }).strict(),
  z.object({ id: handleId, kind: z.literal("url"), label: z.string().min(1).max(BUTTON_LABEL_LIMIT), url: z.url().max(2048) }).strict(),
  // Opens the project's published Mini App — the paid second product.
  z.object({ id: handleId, kind: z.literal("miniapp"), label: z.string().min(1).max(BUTTON_LABEL_LIMIT) }).strict(),
]);

export const startNodeSchema = z
  .object({
    ...baseNode,
    type: z.literal("start"),
    props: z
      .object({
        // Stored without the slash: "start", "help", "menu".
        command: z.string().regex(/^[a-z][a-z0-9_]{0,31}$/),
        description: z.string().max(120).default(""),
      })
      .strict(),
  })
  .strict();

export const messageNodeSchema = z
  .object({
    ...baseNode,
    type: z.literal("message"),
    props: z
      .object({
        text: z.string().min(1).max(MESSAGE_LIMIT),
        buttons: z.array(buttonSchema).max(10).default([]),
      })
      .strict()
      .superRefine((props, context) => assertUniqueIds(props.buttons, "buttons", context)),
  })
  .strict();

export const questionNodeSchema = z
  .object({
    ...baseNode,
    type: z.literal("question"),
    props: z
      .object({
        text: z.string().min(1).max(MESSAGE_LIMIT),
        variable: variableName,
        expects: z.enum(["any", "email", "phone", "number"]).default("any"),
        retryText: z.string().min(1).max(MESSAGE_LIMIT).default("Не получилось разобрать ответ. Попробуйте ещё раз."),
      })
      .strict(),
  })
  .strict();

const conditionSchema = z
  .object({
    id: handleId,
    variable: variableName,
    operator: z.enum(["eq", "neq", "contains", "empty", "filled"]),
    value: z.string().max(500).default(""),
  })
  .strict();

export const choiceNodeSchema = z
  .object({
    ...baseNode,
    type: z.literal("choice"),
    props: z
      .object({ conditions: z.array(conditionSchema).min(1).max(10) })
      .strict()
      .superRefine((props, context) => assertUniqueIds(props.conditions, "conditions", context)),
  })
  .strict();

export const delayNodeSchema = z
  .object({
    ...baseNode,
    type: z.literal("delay"),
    props: z.object({ seconds: z.number().int().min(1).max(3600) }).strict(),
  })
  .strict();

export const handoffNodeSchema = z
  .object({
    ...baseNode,
    type: z.literal("handoff"),
    props: z
      .object({
        text: z.string().min(1).max(MESSAGE_LIMIT).default("Передаю разговор оператору — скоро ответим."),
      })
      .strict(),
  })
  .strict();

export const flowNodeSchema = z.discriminatedUnion("type", [
  startNodeSchema,
  messageNodeSchema,
  questionNodeSchema,
  choiceNodeSchema,
  delayNodeSchema,
  handoffNodeSchema,
]);

export const flowEdgeSchema = z
  .object({
    id: handleId,
    from: nodeId,
    // Which exit the edge leaves by: a button id, a condition id, "next" or "else".
    fromHandle: handleId.default("next"),
    to: nodeId,
  })
  .strict();

export const botFlowDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    metadata: z.object({ name: z.string().min(1).max(200) }).strict(),
    nodes: z.array(flowNodeSchema).min(1).max(300),
    edges: z.array(flowEdgeSchema).max(600),
  })
  .strict()
  .superRefine((document, context) => {
    const ids = new Set<string>();
    document.nodes.forEach((node, index) => {
      if (ids.has(node.id)) context.addIssue({ code: "custom", path: ["nodes", index, "id"], message: "Node ids must be unique" });
      ids.add(node.id);
    });
    if (!document.nodes.some((node) => node.type === "start")) {
      context.addIssue({ code: "custom", path: ["nodes"], message: "Scenario needs at least one start command" });
    }
    const commands = new Set<string>();
    document.nodes.forEach((node, index) => {
      if (node.type !== "start") return;
      if (commands.has(node.props.command)) {
        context.addIssue({ code: "custom", path: ["nodes", index, "props", "command"], message: "Commands must be unique" });
      }
      commands.add(node.props.command);
    });
    const seenEdges = new Set<string>();
    document.edges.forEach((edge, index) => {
      if (!ids.has(edge.from)) context.addIssue({ code: "custom", path: ["edges", index, "from"], message: "Edge starts at a missing node" });
      if (!ids.has(edge.to)) context.addIssue({ code: "custom", path: ["edges", index, "to"], message: "Edge ends at a missing node" });
      // One exit leads to one node; a second edge on the same handle would make
      // the scenario non-deterministic.
      const exit = `${edge.from}:${edge.fromHandle}`;
      if (seenEdges.has(exit)) {
        context.addIssue({ code: "custom", path: ["edges", index, "fromHandle"], message: "This exit already leads somewhere" });
      }
      seenEdges.add(exit);
    });
  });

export type BotFlowDocument = z.infer<typeof botFlowDocumentSchema>;
export type FlowNode = z.infer<typeof flowNodeSchema>;
export type FlowEdge = z.infer<typeof flowEdgeSchema>;
export type FlowButton = z.infer<typeof buttonSchema>;

function assertUniqueIds(items: ReadonlyArray<{ id: string }>, path: string, context: z.RefinementCtx): void {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    if (seen.has(item.id)) context.addIssue({ code: "custom", path: [path, index, "id"], message: "Ids must be unique" });
    seen.add(item.id);
  });
}

export function parseBotFlowDocument(value: unknown): BotFlowDocument {
  return botFlowDocumentSchema.parse(value);
}
