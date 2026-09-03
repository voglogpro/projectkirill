import { applyEdgeChanges, applyNodeChanges, Background, BackgroundVariant, Controls, Handle, MiniMap, Position, ReactFlow, type Connection, type Edge, type EdgeChange, type Node, type NodeChange, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeft, Clock, GitBranch, MessageSquareText, Play, Plus, Rocket, Trash2, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { BotFlowDocument, FlowNode } from "../../../../src/domain/bot-flow";
import { createFlowNode, exitsOf, nodeCatalog, saveFlow, type FlowNodeType } from "../flow-store";
import { FlowSimulator } from "./FlowSimulator";

type CanvasData = { node: FlowNode; onChange: (node: FlowNode) => void };
type CanvasNode = Node<CanvasData>;

const icons: Record<FlowNodeType, typeof MessageSquareText> = {
  start: Play, message: MessageSquareText, question: MessageSquareText, choice: GitBranch, delay: Clock, handoff: UserRound,
};

export function FlowEditor({ flow, onChange, onBack, onLaunch }: { flow: BotFlowDocument; onChange: (flow: BotFlowDocument) => void; onBack: () => void; onLaunch: () => void }) {
  const [selectedId, setSelectedId] = useState<string | undefined>(flow.nodes[1]?.id ?? flow.nodes[0]?.id);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const selected = flow.nodes.find((node) => node.id === selectedId);

  const commit = useCallback((next: BotFlowDocument) => { saveFlow(next); onChange(next); }, [onChange]);
  const updateNode = useCallback((next: FlowNode) => commit({ ...flow, nodes: flow.nodes.map((node) => node.id === next.id ? next : node) }), [flow, commit]);

  // React Flow owns the canvas nodes because it writes measured sizes onto them
  // and hides anything it has not measured; the document stays the source of
  // truth for content and position.
  const [nodes, setNodes] = useState<CanvasNode[]>(() => toCanvasNodes(flow, selectedId, updateNode));
  useEffect(() => {
    setNodes((current) => {
      const measured = new Map(current.map((node) => [node.id, node]));
      return toCanvasNodes(flow, selectedId, updateNode).map((node) => ({ ...measured.get(node.id), ...node }));
    });
  }, [flow, selectedId, updateNode]);

  const edges = useMemo<Edge[]>(() => flow.edges.map((edge) => ({
    id: edge.id, source: edge.from, sourceHandle: edge.fromHandle, target: edge.to, animated: true,
  })), [flow.edges]);

  function onNodesChange(changes: NodeChange<CanvasNode>[]) {
    const next = applyNodeChanges(changes, nodes);
    setNodes(next);
    const removed = new Set(changes.flatMap((change) => change.type === "remove" ? [change.id] : []));
    if (removed.size > 0 && flow.nodes.some((node) => removed.has(node.id) && node.type === "start" && node.props.command === "start")) return;
    // Positions are written once the drag ends, so one move is one saved change.
    const settled = changes.some((change) => change.type === "position" && change.dragging === false);
    if (removed.size === 0 && !settled) return;
    const byId = new Map(next.map((node) => [node.id, node.position]));
    commit({
      ...flow,
      nodes: flow.nodes.filter((node) => !removed.has(node.id)).map((node) => ({ ...node, position: byId.get(node.id) ?? node.position })),
      edges: flow.edges.filter((edge) => !removed.has(edge.from) && !removed.has(edge.to)),
    });
    if (selectedId !== undefined && removed.has(selectedId)) setSelectedId(undefined);
  }

  function onEdgesChange(changes: EdgeChange<Edge>[]) {
    const kept = new Set(applyEdgeChanges(changes, edges).map((edge) => edge.id));
    commit({ ...flow, edges: flow.edges.filter((edge) => kept.has(edge.id)) });
  }

  function onConnect(connection: Connection) {
    const handle = connection.sourceHandle ?? "next";
    // One exit leads to one node, so a new link replaces whatever was there.
    const rest = flow.edges.filter((edge) => !(edge.from === connection.source && edge.fromHandle === handle));
    commit({ ...flow, edges: [...rest, { id: `e-${crypto.randomUUID().slice(0, 8)}`, from: connection.source, fromHandle: handle, to: connection.target }] });
  }

  function addNode(type: FlowNodeType) {
    const spread = flow.nodes.length * 24;
    const node = createFlowNode(type, { x: 420 + (spread % 120), y: 120 + spread });
    commit({ ...flow, nodes: [...flow.nodes, node] });
    setSelectedId(node.id);
  }

  function removeSelected() {
    if (selected === undefined) return;
    if (selected.type === "start" && selected.props.command === "start") return;
    commit({ ...flow, nodes: flow.nodes.filter((node) => node.id !== selected.id), edges: flow.edges.filter((edge) => edge.from !== selected.id && edge.to !== selected.id) });
    setSelectedId(undefined);
  }

  return <div className="flow-screen">
    <header className="builder-top">
      <div>
        <button className="icon-button" onClick={onBack} aria-label="Вернуться в кабинет"><ArrowLeft /></button>
        <span className="flow-title"><b>{flow.metadata.name}</b><small>сценарий бота · {flow.nodes.length} шагов</small></span>
      </div>
      <div />
      <div>
        <button className="outline-button" onClick={() => setSimulatorOpen(true)}><Play />Проверить в чате</button>
        <button className="primary-button" onClick={onLaunch}><Rocket />Запустить</button>
      </div>
    </header>

    <div className="flow-body">
      <aside className="flow-palette">
        <span className="label">ШАГИ СЦЕНАРИЯ</span>
        {nodeCatalog.map(({ type, title, hint }) => {
          const Icon = icons[type];
          return <button key={type} onClick={() => addNode(type)}><span className="pal-icon"><Icon /></span><span className="pal-text"><b>{title}</b><small>{hint}</small></span><Plus /></button>;
        })}
        <p className="flow-tip">Соедините точку справа от шага со следующим шагом. У сообщения с кнопками своя точка на каждую кнопку.</p>
      </aside>

      <div className="flow-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_event, node) => setSelectedId(node.id)}
          onPaneClick={() => setSelectedId(undefined)}
          fitView
          proOptions={{ hideAttribution: false }}
          defaultEdgeOptions={{ animated: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>

      <aside className="inspector">
        {selected ? <>
          <div className="inspector-title">
            <div><span className="inspector-icon">{nodeIcon(selected.type)}</span><span><b>{nodeCatalog.find((item) => item.type === selected.type)?.title}</b><small>Настройки шага</small></span></div>
            <button className="icon-button danger" onClick={removeSelected} aria-label="Удалить шаг"><Trash2 /></button>
          </div>
          <NodeFields node={selected} update={updateNode} />
        </> : <div className="empty-inspector"><MessageSquareText /><h3>Выберите шаг</h3><p>Нажмите на карточку на холсте — здесь появятся её настройки.</p></div>}
      </aside>
    </div>

    {simulatorOpen && <FlowSimulator flow={flow} onClose={() => setSimulatorOpen(false)} />}
  </div>;
}

function toCanvasNodes(flow: BotFlowDocument, selectedId: string | undefined, onChange: (node: FlowNode) => void): CanvasNode[] {
  return flow.nodes.map((node) => ({ id: node.id, type: node.type, position: node.position, selected: node.id === selectedId, data: { node, onChange } }));
}

function nodeIcon(type: FlowNodeType) { const Icon = icons[type]; return <Icon />; }

/* ------------------------------------------------------------------ canvas */

function NodeShell({ type, title, selected, children, exits }: { type: FlowNodeType; title: string; selected?: boolean; children: React.ReactNode; exits: Array<{ handle: string; label: string }> }) {
  return <div className={`flow-node type-${type} ${selected ? "selected" : ""}`}>
    {type !== "start" && <Handle type="target" position={Position.Top} />}
    <div className="flow-node-head">{nodeIcon(type)}<span>{title}</span></div>
    <div className="flow-node-body">{children}</div>
    {exits.length > 0 && <div className="flow-node-exits">
      {exits.map((exit) => <span key={exit.handle} className="flow-exit">{exit.label}<Handle type="source" id={exit.handle} position={Position.Right} /></span>)}
    </div>}
  </div>;
}

function StartCanvasNode({ data, selected }: NodeProps<CanvasNode>) {
  const node = data.node;
  if (node.type !== "start") return null;
  return <NodeShell type="start" title="Команда" selected={selected} exits={exitsOf(node)}><code>/{node.props.command}</code>{node.props.description && <p>{node.props.description}</p>}</NodeShell>;
}
function MessageCanvasNode({ data, selected }: NodeProps<CanvasNode>) {
  const node = data.node;
  if (node.type !== "message") return null;
  return <NodeShell type="message" title="Сообщение" selected={selected} exits={exitsOf(node)}>
    <p>{node.props.text}</p>
    {node.props.buttons.length > 0 && <div className="flow-chips">{node.props.buttons.map((button) => <em key={button.id} className={button.kind}>{button.label}</em>)}</div>}
  </NodeShell>;
}
function QuestionCanvasNode({ data, selected }: NodeProps<CanvasNode>) {
  const node = data.node;
  if (node.type !== "question") return null;
  return <NodeShell type="question" title="Вопрос" selected={selected} exits={exitsOf(node)}><p>{node.props.text}</p><div className="flow-chips"><em className="var">{`{{${node.props.variable}}}`}</em></div></NodeShell>;
}
function ChoiceCanvasNode({ data, selected }: NodeProps<CanvasNode>) {
  const node = data.node;
  if (node.type !== "choice") return null;
  return <NodeShell type="choice" title="Условие" selected={selected} exits={exitsOf(node)}>{node.props.conditions.map((condition) => <p key={condition.id}>{condition.variable} {operatorLabel(condition.operator)} {condition.value}</p>)}</NodeShell>;
}
function DelayCanvasNode({ data, selected }: NodeProps<CanvasNode>) {
  const node = data.node;
  if (node.type !== "delay") return null;
  return <NodeShell type="delay" title="Пауза" selected={selected} exits={exitsOf(node)}><p>{node.props.seconds} сек.</p></NodeShell>;
}
function HandoffCanvasNode({ data, selected }: NodeProps<CanvasNode>) {
  const node = data.node;
  if (node.type !== "handoff") return null;
  return <NodeShell type="handoff" title="Оператор" selected={selected} exits={[]}><p>{node.props.text}</p></NodeShell>;
}

const nodeTypes = { start: StartCanvasNode, message: MessageCanvasNode, question: QuestionCanvasNode, choice: ChoiceCanvasNode, delay: DelayCanvasNode, handoff: HandoffCanvasNode };

/* --------------------------------------------------------------- inspector */

function NodeFields({ node, update }: { node: FlowNode; update: (node: FlowNode) => void }) {
  const patch = (props: Record<string, unknown>) => update({ ...node, props: { ...node.props, ...props } } as FlowNode);

  if (node.type === "start") return <div className="fields">
    <Field label="Команда"><div className="command-input"><span>/</span><input value={node.props.command} onChange={(event) => patch({ command: event.target.value.toLowerCase().replaceAll(/[^a-z0-9_]/g, "") })} /></div></Field>
    <Field label="Подпись в меню Telegram"><input value={node.props.description} maxLength={120} onChange={(event) => patch({ description: event.target.value })} /></Field>
  </div>;

  if (node.type === "message") return <div className="fields">
    <Field label="Текст"><textarea rows={6} value={node.props.text} onChange={(event) => patch({ text: event.target.value })} /></Field>
    <p className="field-help">Подставьте ответ клиента как <code>{"{{name}}"}</code> — так пишут все конструкторы.</p>
    <div className="form-field-editor"><b>Кнопки</b>
      {node.props.buttons.map((button, index) => <div className="form-field-card" key={button.id}>
        <div className="form-field-row">
          <input value={button.label} aria-label="Текст кнопки" onChange={(event) => patch({ buttons: node.props.buttons.map((item, position) => position === index ? { ...item, label: event.target.value } : item) })} />
          <select value={button.kind} aria-label="Тип кнопки" onChange={(event) => patch({ buttons: node.props.buttons.map((item, position) => position === index ? makeButton(item.id, event.target.value as "next" | "url" | "miniapp", item.label) : item) })}>
            <option value="next">Следующий шаг</option>
            <option value="url">Ссылка</option>
            <option value="miniapp">Открыть Mini App</option>
          </select>
          <button onClick={() => patch({ buttons: node.props.buttons.filter((_item, position) => position !== index) })} aria-label={`Удалить кнопку ${button.label}`}><Trash2 /></button>
        </div>
        {button.kind === "url" && <Field label="Ссылка"><input value={button.url} onChange={(event) => patch({ buttons: node.props.buttons.map((item, position) => position === index ? { ...item, url: event.target.value } : item) })} /></Field>}
      </div>)}
      <button className="add-field" disabled={node.props.buttons.length >= 10} onClick={() => patch({ buttons: [...node.props.buttons, makeButton(`b${crypto.randomUUID().slice(0, 4)}`, "next", "Кнопка")] })}><Plus />Добавить кнопку</button>
    </div>
  </div>;

  if (node.type === "question") return <div className="fields">
    <Field label="Вопрос"><textarea rows={4} value={node.props.text} onChange={(event) => patch({ text: event.target.value })} /></Field>
    <Field label="Сохранить ответ в"><div className="command-input"><span>{"{{"}</span><input value={node.props.variable} onChange={(event) => patch({ variable: event.target.value.toLowerCase().replaceAll(/[^a-z0-9_]/g, "") })} /><span>{"}}"}</span></div></Field>
    <Field label="Что ждём в ответ"><select value={node.props.expects} onChange={(event) => patch({ expects: event.target.value })}><option value="any">Любой текст</option><option value="email">Email</option><option value="phone">Телефон</option><option value="number">Число</option></select></Field>
    <Field label="Если ответ не подошёл"><textarea rows={2} value={node.props.retryText} onChange={(event) => patch({ retryText: event.target.value })} /></Field>
  </div>;

  if (node.type === "choice") return <div className="fields"><div className="form-field-editor"><b>Условия</b>
    {node.props.conditions.map((condition, index) => <div className="form-field-card" key={condition.id}>
      <div className="form-field-row">
        <input value={condition.variable} aria-label="Переменная" onChange={(event) => patch({ conditions: node.props.conditions.map((item, position) => position === index ? { ...item, variable: event.target.value.toLowerCase().replaceAll(/[^a-z0-9_]/g, "") } : item) })} />
        <select value={condition.operator} aria-label="Оператор" onChange={(event) => patch({ conditions: node.props.conditions.map((item, position) => position === index ? { ...item, operator: event.target.value } : item) })}>
          <option value="filled">заполнено</option><option value="empty">пусто</option><option value="eq">равно</option><option value="neq">не равно</option><option value="contains">содержит</option>
        </select>
        <button disabled={node.props.conditions.length === 1} onClick={() => patch({ conditions: node.props.conditions.filter((_item, position) => position !== index) })} aria-label="Удалить условие"><Trash2 /></button>
      </div>
      {(condition.operator === "eq" || condition.operator === "neq" || condition.operator === "contains") && <Field label="Значение"><input value={condition.value} onChange={(event) => patch({ conditions: node.props.conditions.map((item, position) => position === index ? { ...item, value: event.target.value } : item) })} /></Field>}
    </div>)}
    <button className="add-field" disabled={node.props.conditions.length >= 10} onClick={() => patch({ conditions: [...node.props.conditions, { id: `c${crypto.randomUUID().slice(0, 4)}`, variable: "name", operator: "filled", value: "" }] })}><Plus />Добавить условие</button>
  </div></div>;

  if (node.type === "delay") return <div className="fields"><Field label="Пауза, секунд"><input type="number" min="1" max="3600" value={node.props.seconds} onChange={(event) => patch({ seconds: Math.min(3600, Math.max(1, Math.round(Number(event.target.value)))) })} /></Field></div>;

  return <div className="fields"><Field label="Что написать перед передачей"><textarea rows={4} value={node.props.text} onChange={(event) => patch({ text: event.target.value })} /></Field></div>;
}

function makeButton(id: string, kind: "next" | "url" | "miniapp", label: string) {
  return kind === "url" ? { id, kind, label, url: "https://" } : { id, kind, label };
}
function operatorLabel(operator: string) {
  return ({ eq: "равно", neq: "не равно", contains: "содержит", empty: "пусто", filled: "заполнено" })[operator] ?? operator;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
