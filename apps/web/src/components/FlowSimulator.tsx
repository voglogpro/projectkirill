import { RotateCcw, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { BotFlowDocument } from "../../../../src/domain/bot-flow";
import { initialDialogState, runFlow, type DialogState, type FlowMessage } from "../../../../src/domain/bot-flow-runtime";

type Line = { from: "bot" | "user" | "system"; text: string; buttons?: FlowMessage["buttons"] };

/** Runs the scenario through the same interpreter the Telegram worker uses. */
export function FlowSimulator({ flow, onClose }: { flow: BotFlowDocument; onClose: () => void }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [state, setState] = useState<DialogState>(initialDialogState);
  const [draft, setDraft] = useState("");
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => { start(); }, []);
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; addEventListener("keydown", close); return () => removeEventListener("keydown", close); }, [onClose]);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [lines]);

  function push(next: Line[]) { setLines((current) => [...current, ...next]); }
  function apply(step: ReturnType<typeof runFlow>, fallback: string) {
    setState(step.state);
    if (!step.handled) { push([{ from: "system", text: fallback }]); return; }
    push(step.messages.map((message) => ({ from: "bot" as const, text: message.delaySeconds ? `⏳ пауза ${message.delaySeconds} c\n${message.text}` : message.text, buttons: message.buttons })));
  }

  function start() {
    const fresh = initialDialogState();
    setLines([{ from: "user", text: "/start" }]);
    const step = runFlow(flow, fresh, { kind: "command", command: "start" });
    setState(step.state);
    setLines([{ from: "user", text: "/start" }, ...step.messages.map((message) => ({ from: "bot" as const, text: message.text, buttons: message.buttons }))]);
  }

  function press(handle: string, label: string) {
    push([{ from: "user", text: label }]);
    apply(runFlow(flow, state, { kind: "press", handle }), "Эта кнопка никуда не ведёт — соедините её со следующим шагом.");
  }

  function send() {
    const text = draft.trim();
    if (text === "") return;
    setDraft("");
    push([{ from: "user", text }]);
    const event = text.startsWith("/") ? { kind: "command" as const, command: text } : { kind: "text" as const, text };
    apply(runFlow(flow, state, event), text.startsWith("/") ? "Такой команды в сценарии нет." : "Бот сейчас ничего не ждёт от клиента — добавьте шаг «Вопрос».");
  }

  const active = lines.filter((line) => line.buttons && line.buttons.length > 0).at(-1);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="simulator" role="dialog" aria-modal="true" aria-label="Проверка сценария">
      <header><div><b>Проверка сценария</b><small>тот же движок, что и у настоящего бота</small></div><span><button onClick={start} aria-label="Начать заново"><RotateCcw /></button><button onClick={onClose} aria-label="Закрыть"><X /></button></span></header>
      <div className="simulator-log" ref={log}>
        {lines.map((line, index) => <div className={`sim-line ${line.from}`} key={index}>
          <div className="sim-bubble">
            {line.text.split("\n").map((paragraph, position) => <p key={position}>{paragraph}</p>)}
            {line === active && line.buttons?.map((button) => <button key={button.id} className="sim-button" disabled={button.kind !== "next"} onClick={() => press(button.id, button.label)}>
              {button.label}{button.kind === "url" ? " ↗" : button.kind === "miniapp" ? " ▸" : ""}
            </button>)}
          </div>
        </div>)}
      </div>
      <form className="simulator-input" onSubmit={(event) => { event.preventDefault(); send(); }}>
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={state.awaiting === "text" ? "Бот ждёт ответ…" : "Сообщение или /команда"} aria-label="Сообщение клиента" />
        <button type="submit" aria-label="Отправить"><Send /></button>
      </form>
    </div>
  </div>;
}
