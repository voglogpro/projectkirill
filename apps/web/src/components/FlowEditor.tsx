import { applyNodeChanges, Background, BackgroundVariant, ConnectionLineType, Controls, Handle, MarkerType, MiniMap, Panel, Position, ReactFlow, useNodeId, useUpdateNodeInternals, type Connection, type Edge, type EdgeChange, type Node, type NodeChange, type NodeProps, type ReactFlowInstance } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeft, CircleHelp, Clock, GitBranch, Hand, LayoutDashboard, MessageSquareText, MousePointer2, MousePointerClick, Move, Play, Plus, Redo2, Rocket, SlidersHorizontal, Trash2, Undo2, UserRound, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BotFlowDocument, FlowNode } from "../../../../src/domain/bot-flow";
import { hasSession, loadRemoteFlow, saveRemoteFlow } from "../api";
import { createFlowNode, exitsOf, nodeCatalog, saveFlow, type FlowNodeType } from "../flow-store";
import { useCompact } from "../use-compact";
import { canConnect, connectFlow, flowNodeLabel, replaceFlowNode } from "../flow-connections";
import { createFlowSaveQueue } from "../flow-save-queue";
import { savePreviewFlow } from "../local-preview";
import { FlowSimulator } from "./FlowSimulator";

type CanvasData = { node: FlowNode; onChange: (node: FlowNode) => void };
type CanvasNode = Node<CanvasData>;

const icons: Record<FlowNodeType, typeof MessageSquareText> = {
  start: Play, message: MessageSquareText, question: MessageSquareText, choice: GitBranch, delay: Clock, handoff: UserRound,
};

export function FlowEditor({ flow, projectId, localOnly = false, onChange, onBack, onLaunch, onMessage }: { flow: BotFlowDocument; projectId: string; localOnly?: boolean; onChange: (flow: BotFlowDocument) => void; onBack: () => void; onLaunch: () => void; onMessage: (message: string) => void }) {
  const cloudEnabled = !localOnly && hasSession();
  const persistFlow = useCallback((next: BotFlowDocument) => { if (localOnly) savePreviewFlow(projectId, next); else saveFlow(next); }, [localOnly, projectId]);
  const [selectedId, setSelectedId] = useState<string | undefined>(flow.nodes[1]?.id ?? flow.nodes[0]?.id);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const compact = useCompact();
  const [sheet, setSheet] = useState<"none" | "inspector" | "add">("none");
  const [inspectorTab, setInspectorTab] = useState<"content" | "links">("content");
  const [panMode, setPanMode] = useState(false);
  const [moveOnPhone, setMoveOnPhone] = useState(false);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>();
  const past = useRef<BotFlowDocument[]>([]);
  const future = useRef<BotFlowDocument[]>([]);
  const currentFlow = useRef(flow);
  currentFlow.current = flow;
  const canvas = useRef<ReactFlowInstance<CanvasNode, Edge>>(undefined);
  const remoteSaves = useRef<ReturnType<typeof createFlowSaveQueue>>(undefined);
  const [loading, setLoading] = useState(cloudEnabled);
  const [launching, setLaunching] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const skipNextSave = useRef(true);
  const selected = flow.nodes.find((node) => node.id === selectedId);

  const commit = useCallback((next: BotFlowDocument) => {
    if (next === currentFlow.current) return;
    past.current = [...past.current.slice(-49), currentFlow.current];
    future.current = [];
    currentFlow.current = next;
    persistFlow(next); onChange(next);
  }, [onChange, persistFlow]);

  function travel(direction: "undo" | "redo") {
    const source = direction === "undo" ? past : future;
    const target = direction === "undo" ? future : past;
    const next = source.current.pop();
    if (!next) return;
    target.current.push(currentFlow.current);
    currentFlow.current = next;
    setSelectedEdgeId(undefined);
    persistFlow(next); onChange(next);
  }

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (loading || launching || simulatorOpen || (event.target instanceof Element && event.target.closest("input,textarea,select,[contenteditable=true]"))) return;
      if (event.key === "Escape") { setSelectedEdgeId(undefined); setSheet("none"); }
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "z" || event.key.toLowerCase() === "y") {
        event.preventDefault();
        travel(event.shiftKey || event.key.toLowerCase() === "y" ? "redo" : "undo");
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  });

  // The server owns the scenario; local storage is the offline copy and what
  // the preview stand reads.
  useEffect(() => {
    if (!cloudEnabled) { skipNextSave.current = false; return; }
    let active = true;
    void loadRemoteFlow(projectId)
      .then((remote) => {
        if (!active) return;
        const document = remote.document as BotFlowDocument | undefined;
        if (!Array.isArray(document?.nodes)) { setSaveState("error"); onMessage("Сервер вернул сценарий в неизвестном формате — работаем с локальной копией"); return; }
        remoteSaves.current = createFlowSaveQueue(document, remote.revision,
          (next, revision) => saveRemoteFlow(projectId, next, revision));
        past.current = []; future.current = [];
        skipNextSave.current = true;
        persistFlow(document);
        onChange(document);
        // The previous selection belonged to the local copy and may not exist here.
        setSelectedId(document.nodes[1]?.id ?? document.nodes[0]?.id);
      })
      .catch((reason: unknown) => { if (active) { setSaveState("error"); onMessage(reason instanceof Error ? reason.message : "Не удалось загрузить сценарий"); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId]);

  useEffect(() => {
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    const queue = remoteSaves.current;
    if (!cloudEnabled || queue === undefined) return;
    let active = true;
    setSaveState("saving");
    const timer = setTimeout(() => {
      void queue.save(flow)
        .then(() => { if (active) setSaveState("saved"); })
        .catch((reason: unknown) => { if (active) { setSaveState("error"); onMessage(reason instanceof Error ? reason.message : "Не удалось сохранить сценарий"); } });
    }, 900);
    return () => { active = false; clearTimeout(timer); };
  }, [flow, projectId]);

  async function launch() {
    setLaunching(true);
    try {
      if (cloudEnabled) {
        if (!remoteSaves.current) throw new Error("Сначала загрузите облачный сценарий: вернитесь в кабинет и откройте редактор заново.");
        await remoteSaves.current.save(currentFlow.current);
        // The launch wizard checks format/entitlement before publication.
        setSaveState("saved");
      }
      onLaunch();
    } catch (reason) { onMessage(reason instanceof Error ? reason.message : "Не удалось опубликовать сценарий"); }
    finally { setLaunching(false); }
  }
  const updateNode = useCallback((next: FlowNode) => commit(replaceFlowNode(flow, next)), [flow, commit]);

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
    // Steady light, never marching ants: the glow lives in CSS so the line
    // reads as one lit filament from the button to the step it opens.
    id: edge.id, source: edge.from, sourceHandle: edge.fromHandle, target: edge.to,
    animated: false, type: "smoothstep", selected: edge.id === selectedEdgeId,
    markerEnd: { type: MarkerType.ArrowClosed, color: "#A78BFA" },
    interactionWidth: compact ? 36 : 24,
  })), [flow.edges, selectedEdgeId, compact]);

  function onNodesChange(changes: NodeChange<CanvasNode>[]) {
    // /start cannot disappear from the canvas through Delete either.
    const safeChanges = changes.filter((change) => change.type !== "remove" || !flow.nodes.some((node) => node.id === change.id && node.type === "start" && node.props.command === "start"));
    const next = applyNodeChanges(safeChanges, nodes);
    setNodes(next);
    const removed = new Set(safeChanges.flatMap((change) => change.type === "remove" ? [change.id] : []));
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
    const removed = new Set(changes.flatMap((change) => change.type === "remove" ? [change.id] : []));
    // Selection is UI state, not a scenario edit or an autosave.
    if (removed.size > 0) commit({ ...currentFlow.current, edges: currentFlow.current.edges.filter((edge) => !removed.has(edge.id)) });
  }

  async function back() {
    // Leaving during the debounce must not discard the last connection edit.
    if (!remoteSaves.current) { onBack(); return; }
    setLaunching(true);
    try { await remoteSaves.current.save(currentFlow.current); onBack(); }
    catch (reason) { onMessage(reason instanceof Error ? reason.message : "Не удалось сохранить сценарий. Попробуйте ещё раз."); }
    finally { setLaunching(false); }
  }

  function onConnect(connection: Connection) {
    commit(connectFlow(flow, connection));
  }

  function onReconnect(edge: Edge, connection: Connection) {
    commit(connectFlow(flow, connection, edge.id));
  }

  function setNextStep(handle: string, target: string) {
    if (!selected) return;
    if (target) onConnect({ source: selected.id, sourceHandle: handle, target, targetHandle: null });
    else commit({ ...flow, edges: flow.edges.filter((edge) => edge.from !== selected.id || edge.fromHandle !== handle) });
  }

  function addNode(type: FlowNodeType) {
    if (flow.nodes.length >= 300) { onMessage("В одном сценарии может быть до 300 шагов"); return; }
    // A new step lands under the one you are looking at, and the camera follows
    // it — on a phone anything placed off-screen may as well not exist.
    const spread = flow.nodes.length * 24;
    const anchor = selected?.position;
    const position = anchor === undefined
      ? { x: 420 + (spread % 120), y: 120 + spread }
      : { x: anchor.x, y: anchor.y + 200 + (flow.nodes.some((node) => node.position.x === anchor.x && node.position.y === anchor.y + 200) ? 40 : 0) };
    const node = createFlowNode(type, position);
    commit({ ...flow, nodes: [...flow.nodes, node] });
    setSelectedId(node.id);
    setInspectorTab("content");
    requestAnimationFrame(() => canvas.current?.setCenter(position.x + 116, position.y + 90, { zoom: canvas.current.getZoom(), duration: 320 }));
    if (compact) setSheet("inspector");
  }

  /** Buttons live inside a message, so the dock adds one to the selected step. */
  function addButton() {
    if (selected?.type !== "message") { onMessage("Сначала выберите сообщение — кнопки живут в нём"); return; }
    if (selected.props.buttons.length >= 10) { onMessage("В сообщении может быть до 10 кнопок"); return; }
    setInspectorTab("content");
    updateNode({ ...selected, props: { ...selected.props, buttons: [...selected.props.buttons, { id: `b${crypto.randomUUID().slice(0, 4)}`, kind: "next", label: "Кнопка" }] } });
    if (compact) setSheet("inspector");
  }

  function removeSelected() {
    if (selected === undefined) return;
    if (selected.type === "start" && selected.props.command === "start") return;
    commit({ ...flow, nodes: flow.nodes.filter((node) => node.id !== selected.id), edges: flow.edges.filter((edge) => edge.from !== selected.id && edge.to !== selected.id) });
    setSelectedId(undefined);
  }

  const additions = [
    { label: "Сообщение", hint: "Текст и кнопки", icon: MessageSquareText, run: () => addNode("message") },
    { label: "Кнопка", hint: "В выбранное сообщение", icon: MousePointerClick, run: addButton },
    { label: "Вопрос", hint: "Ответ в переменную", icon: CircleHelp, run: () => addNode("question") },
    { label: "Развилка", hint: "Условие по ответу", icon: GitBranch, run: () => addNode("choice") },
    { label: "Пауза", hint: "Подождать перед ответом", icon: Clock, run: () => addNode("delay") },
    { label: "Оператор", hint: "Передать человеку", icon: UserRound, run: () => addNode("handoff") },
  ];

  return <div className={`flow-screen ${compact ? "compact" : ""}`} aria-busy={loading || launching}>
    {(loading || launching) && <div className="flow-busy" role="status">{loading ? "Загружаем сценарий…" : "Сохраняем и готовим запуск…"}</div>}
    <header className="builder-top">
      <div>
        <button className="icon-button" onClick={() => void back()} aria-label="Вернуться в кабинет"><ArrowLeft /></button>
        <span className="flow-title"><b>{flow.metadata.name}</b><small className={saveState === "error" ? "error" : ""}>{localOnly ? "Бесплатный черновик · на устройстве" : saveState === "saving" ? "Сохраняем в облаке…" : saveState === "error" ? "Ошибка сохранения" : cloudEnabled ? "Сохранено в облаке" : "Сохранено на этом устройстве"} · {flow.nodes.length} шагов</small></span>
      </div>
      <div />
      <div>
        <button className="outline-button" onClick={() => setSimulatorOpen(true)} aria-label="Проверить в чате"><Play /><span>Проверить в чате</span></button>
        <button className="primary-button" disabled={loading || launching} onClick={() => void launch()}><Rocket /><span>Запустить</span></button>
      </div>
    </header>

    <div className="flow-body">
      <aside className="flow-palette">
        <span className="label">ШАГИ СЦЕНАРИЯ</span>
        {nodeCatalog.map(({ type, title, hint }) => {
          const Icon = icons[type];
          return <button key={type} onClick={() => addNode(type)}><span className="pal-icon"><Icon /></span><span className="pal-text"><b>{title}</b><small>{hint}</small></span><Plus /></button>;
        })}
        <p className="flow-tip">Тяните линию от выхода справа ко входу сверху. Чтобы изменить цепочку, перетащите конец готовой линии на другой блок. Пробел — перемещение холста, Ctrl / ⌘ + Z — отмена.</p>
      </aside>

      <div className="flow-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onReconnect={onReconnect}
          isValidConnection={(connection) => canConnect(flow, connection)}
          edgesReconnectable={!compact}
          reconnectRadius={16}
          connectOnClick
          onInit={(instance) => { canvas.current = instance; }}
          onNodeClick={(event, node) => {
            if ((event.target as Element).closest(".react-flow__handle")) return;
            setSelectedEdgeId(undefined); setSelectedId(node.id);
            if (compact && !moveOnPhone) setSheet("inspector");
          }}
          onEdgeClick={(_event, edge) => { setSelectedEdgeId(edge.id); setSelectedId(undefined); setSheet("none"); }}
          onPaneClick={() => { setSelectedId(undefined); setSelectedEdgeId(undefined); if (compact) setSheet("none"); }}
          fitView
          proOptions={{ hideAttribution: false }}
          defaultEdgeOptions={{ animated: false, type: "smoothstep" }}
          connectionLineType={ConnectionLineType.SmoothStep}
          // Two fingers must zoom, and far enough out to see a long scenario:
          // React Flow stops at 0.5 by default, which on a phone is still huge.
          minZoom={0.15}
          maxZoom={2.5}
          zoomOnPinch
          nodesDraggable={compact ? moveOnPhone : !panMode}
          panOnDrag={compact || panMode ? true : [1, 2]}
          panOnScroll={!compact}
          selectionOnDrag={!compact && !panMode}
          snapToGrid
          snapGrid={[16, 16]}
          deleteKeyCode={simulatorOpen ? null : ["Backspace", "Delete"]}
          zoomOnDoubleClick={!compact}
          // Fingers are blunt: a wider catch radius makes wiring two steps together possible at all.
          connectionRadius={compact ? 44 : 20}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="#2A2A44" />
          <Panel position="top-left" className="flow-tools" aria-label={compact ? "Управление на телефоне" : "Инструменты холста"}>
            {compact ? null : <>
              <button className={!panMode ? "active" : ""} aria-pressed={!panMode} aria-label="Выделение и перемещение блоков" onClick={() => setPanMode(false)}><MousePointer2 size={17} /></button>
              <button className={panMode ? "active" : ""} aria-pressed={panMode} aria-label="Перемещение холста" onClick={() => setPanMode(true)}><Hand size={17} /></button>
            </>}
            <button disabled={past.current.length === 0} onClick={() => travel("undo")} aria-label="Отменить действие"><Undo2 size={17} /></button>
            <button disabled={future.current.length === 0} onClick={() => travel("redo")} aria-label="Повторить действие"><Redo2 size={17} /></button>
          </Panel>
          <Panel position="bottom-center" className="flow-guidance">
            {selectedEdgeId && flow.edges.some((edge) => edge.id === selectedEdgeId) ? <>
              <span>{compact ? "Связь выбрана" : "Тяните любой конец линии к другому блоку"}</span>
              <button onClick={() => { commit({ ...flow, edges: flow.edges.filter((edge) => edge.id !== selectedEdgeId) }); setSelectedEdgeId(undefined); }}><Trash2 size={15} />Удалить связь</button>
            </> : <span>{compact ? (moveOnPhone ? "Тяните карточки. Нажмите «Готово», чтобы редактировать." : "Нажмите на блок → «Следующие шаги». Два пальца — масштаб.") : "Соединяйте блоки линиями · Перетаскивайте концы, чтобы менять цепочку"}</span>}
          </Panel>
          <Controls showInteractive={false} position="bottom-left" />
          {/* The minimap eats a corner of a phone screen and helps nobody there. */}
          {!compact && <MiniMap pannable zoomable />}
        </ReactFlow>
      </div>

      <aside className={`inspector ${compact && sheet === "inspector" ? "open" : ""}`}>
        {compact && <><div className="sheet-top"><b>Настройки шага</b><button className="icon-button" onClick={() => setSheet("none")} aria-label="Закрыть"><X /></button></div>
          {selected && <div className="flow-inspector-tabs" role="tablist" aria-label="Раздел настроек шага">
            <button id="flow-content-tab" role="tab" aria-selected={inspectorTab === "content"} aria-controls="flow-content" onClick={() => setInspectorTab("content")}>Содержимое</button>
            <button id="flow-links-tab" role="tab" aria-selected={inspectorTab === "links"} aria-controls="flow-links" onClick={() => setInspectorTab("links")}>Связи</button>
          </div>}
        </>}
        {selected ? <>
          <div className="inspector-title">
            <div><span className="inspector-icon">{nodeIcon(selected.type)}</span><span><b>{nodeCatalog.find((item) => item.type === selected.type)?.title}</b><small>Настройки шага</small></span></div>
            <button className="icon-button danger" disabled={selected.type === "start" && selected.props.command === "start"} onClick={removeSelected} aria-label="Удалить шаг"><Trash2 /></button>
          </div>
          <div id="flow-content" hidden={compact && inspectorTab !== "content"} role={compact ? "tabpanel" : undefined} aria-labelledby={compact ? "flow-content-tab" : undefined}><NodeFields node={selected} update={updateNode} /></div>
          <div id="flow-links" className="flow-links fields" hidden={compact && inspectorTab !== "links"} role={compact ? "tabpanel" : undefined} aria-labelledby={compact ? "flow-links-tab" : undefined}>
            <h3>Следующие шаги</h3>
            <p className="field-help">{compact ? "Выберите, куда ведёт каждый ответ. Линия на холсте обновится сама." : "Те же связи, что на холсте. Можно изменить назначение и здесь."}</p>
            {exitsOf(selected).map((exit) => <Field key={exit.handle} label={exit.label}>
              <select aria-label={`Следующий шаг: ${exit.label}`} value={flow.edges.find((edge) => edge.from === selected.id && edge.fromHandle === exit.handle)?.to ?? ""} onChange={(event) => setNextStep(exit.handle, event.target.value)}>
                <option value="">Не соединено</option>
                {flow.nodes.filter((node) => node.type !== "start" && node.id !== selected.id).map((node) => <option key={node.id} value={node.id}>{flow.nodes.indexOf(node) + 1}. {flowNodeLabel(node)}</option>)}
              </select>
            </Field>)}
            {selected.type === "handoff" && <p className="field-help">Здесь цепочка заканчивается: дальше отвечает оператор.</p>}
          </div>
        </> : <div className="empty-inspector"><MessageSquareText /><h3>Выберите шаг</h3><p>Нажмите на карточку на холсте — здесь появятся её настройки.</p></div>}
      </aside>
    </div>

    {compact && <>
      {/* One sheet for adding steps: six full-size targets instead of a row of chips. */}
      <div className={`editor-sheet ${sheet === "add" ? "open" : ""}`} role="dialog" aria-label="Добавить шаг" aria-hidden={sheet !== "add"}>
        <div className="sheet-top"><b>Добавить шаг</b><button className="icon-button" onClick={() => setSheet("none")} aria-label="Закрыть"><X /></button></div>
        <div className="editor-sheet-grid">
          {additions.map(({ label, hint, icon: Icon, run }) => <button key={label} onClick={() => { run(); }}>
            <span><Icon /></span><b>{label}</b><small>{hint}</small>
          </button>)}
        </div>
        <p className="editor-sheet-note">Новый шаг встаёт под выбранным, и холст сам едет к нему. Соединить шаги можно на холсте или в «Настройках» → «Следующие шаги».</p>
      </div>

      <nav className="editor-dock" aria-label="Меню редактора">
        <button className={sheet === "add" ? "on" : ""} onClick={() => setSheet(sheet === "add" ? "none" : "add")}><Plus /><span>Добавить</span></button>
        <button className={moveOnPhone ? "on" : ""} aria-pressed={moveOnPhone} onClick={() => { setMoveOnPhone(!moveOnPhone); setSheet("none"); }}><Move /><span>{moveOnPhone ? "Готово" : "Двигать"}</span></button>
        <button className={sheet === "inspector" ? "on" : ""} onClick={() => setSheet(sheet === "inspector" ? "none" : "inspector")}><SlidersHorizontal /><span>Настройки</span></button>
        <button onClick={onBack}><LayoutDashboard /><span>Кабинет</span></button>
      </nav>
    </>}

    {simulatorOpen && <FlowSimulator flow={flow} onClose={() => setSimulatorOpen(false)} />}
  </div>;
}

function toCanvasNodes(flow: BotFlowDocument, selectedId: string | undefined, onChange: (node: FlowNode) => void): CanvasNode[] {
  return flow.nodes.map((node) => ({ id: node.id, type: node.type, position: node.position, selected: node.id === selectedId, deletable: !(node.type === "start" && node.props.command === "start"), data: { node, onChange } }));
}

function nodeIcon(type: FlowNodeType) { const Icon = icons[type]; return <Icon />; }

/* ------------------------------------------------------------------ canvas */

function NodeShell({ type, title, selected, children, exits }: { type: FlowNodeType; title: string; selected?: boolean; children: React.ReactNode; exits: Array<{ handle: string; label: string }> }) {
  const id = useNodeId();
  const updateInternals = useUpdateNodeInternals();
  const exitSignature = JSON.stringify(exits);
  useEffect(() => { if (id) updateInternals(id); }, [id, exitSignature, updateInternals]);
  return <div className={`flow-node type-${type} ${selected ? "selected" : ""}`}>
    {type !== "start" && <Handle type="target" position={Position.Top} aria-label="Вход в шаг" />}
    <div className="flow-node-head">{nodeIcon(type)}<span>{title}</span></div>
    <div className="flow-node-body">{children}</div>
    {exits.length > 0 && <div className="flow-node-exits">
      {exits.map((exit) => <span key={exit.handle} className="flow-exit">{exit.label}<Handle type="source" id={exit.handle} position={Position.Right} aria-label={`Выход: ${exit.label}`} /></span>)}
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
