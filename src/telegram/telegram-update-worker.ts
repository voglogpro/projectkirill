import { z } from "zod";
import type { BotFlowDocument } from "../domain/bot-flow.js";
import { initialDialogState, runFlow, type DialogState, type FlowEvent } from "../domain/bot-flow-runtime.js";
import type { EnvelopeTokenVault, SealedSecret } from "../crypto/token-vault.js";
import type { TelegramApi } from "./telegram-client.js";
import type { TelegramUpdate } from "./telegram-webhook.js";

const chatId = z.union([z.number().int().safe(), z.string().regex(/^-?[0-9]+$/)]);

const messageUpdateSchema = z.object({
  message: z.object({
    chat: z.object({ id: chatId, type: z.literal("private") }),
    text: z.string(),
  }),
});

const callbackUpdateSchema = z.object({
  callback_query: z.object({
    id: z.string().min(1).max(128),
    data: z.string().min(1).max(64),
    message: z.object({ chat: z.object({ id: chatId, type: z.literal("private") }) }),
  }),
});

export interface TelegramUpdateJob {
  integrationId: string;
  updateId: number;
  leaseId: string;
  attempts: number;
  projectId: string;
  encryptedToken: SealedSecret;
  miniAppUrl: string;
  menuButtonText: string;
  payload: TelegramUpdate;
}

export interface TelegramUpdateJobRepository {
  claimNext(options: { leaseSeconds: number; maxAttempts: number }): Promise<TelegramUpdateJob | null>;
  markProcessed(job: Pick<TelegramUpdateJob, "integrationId" | "updateId" | "leaseId">): Promise<boolean>;
  markFailed(input: {
    integrationId: string;
    updateId: number;
    leaseId: string;
    reason: string;
    retryAt: Date;
    deadLetter: boolean;
  }): Promise<boolean>;
}

/** Published scenario for a project, or null while the owner has not published one. */
export interface BotFlowSource {
  loadPublishedFlow(projectId: string): Promise<BotFlowDocument | null>;
}

/** Where each subscriber's conversation is parked between updates. */
export interface DialogStateStore {
  load(integrationId: string, chatId: string): Promise<DialogState | null>;
  save(integrationId: string, chatId: string, state: DialogState): Promise<void>;
}

export interface TelegramUpdateWorkerOptions {
  leaseSeconds?: number;
  maxAttempts?: number;
  baseRetrySeconds?: number;
  maxRetrySeconds?: number;
  now?: () => Date;
  startMessageText?: string;
  /** Both must be present for a project's scenario to run; otherwise /start only. */
  flows?: BotFlowSource;
  dialogs?: DialogStateStore;
  /** Upper bound on a scenario pause, so one job cannot hold the lease. */
  maxPauseSeconds?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}

export type TelegramUpdateWorkerResult = "idle" | "processed" | "retried" | "dead_lettered";

export class TelegramUpdateLeaseLostError extends Error {
  public constructor() {
    super("Telegram update lease is no longer owned by this worker");
    this.name = "TelegramUpdateLeaseLostError";
  }
}

/** Processes one durable inbox row. Call runOnce from a worker loop or queue. */
export class TelegramUpdateWorker {
  private readonly leaseSeconds: number;
  private readonly maxAttempts: number;
  private readonly baseRetrySeconds: number;
  private readonly maxRetrySeconds: number;
  private readonly now: () => Date;
  private readonly startMessageText: string;
  private readonly flows: BotFlowSource | undefined;
  private readonly dialogs: DialogStateStore | undefined;
  private readonly maxPauseSeconds: number;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  public constructor(
    private readonly repository: TelegramUpdateJobRepository,
    private readonly tokenVault: Pick<EnvelopeTokenVault, "open">,
    private readonly telegram: Pick<TelegramApi, "sendMessage"> & Partial<Pick<TelegramApi, "answerCallbackQuery">>,
    options: TelegramUpdateWorkerOptions = {},
  ) {
    this.leaseSeconds = positiveInteger(options.leaseSeconds ?? 60, "leaseSeconds");
    this.maxAttempts = positiveInteger(options.maxAttempts ?? 8, "maxAttempts");
    this.baseRetrySeconds = positiveInteger(options.baseRetrySeconds ?? 5, "baseRetrySeconds");
    this.maxRetrySeconds = positiveInteger(options.maxRetrySeconds ?? 5 * 60, "maxRetrySeconds");
    this.now = options.now ?? (() => new Date());
    this.startMessageText = options.startMessageText ?? "Приложение готово. Нажмите кнопку, чтобы открыть его.";
    this.flows = options.flows;
    this.dialogs = options.dialogs;
    this.maxPauseSeconds = positiveInteger(options.maxPauseSeconds ?? 3, "maxPauseSeconds");
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  public async runOnce(): Promise<TelegramUpdateWorkerResult> {
    const job = await this.repository.claimNext({
      leaseSeconds: this.leaseSeconds,
      maxAttempts: this.maxAttempts,
    });
    if (job === null) return "idle";

    try {
      await this.deliver(job);
      if (!(await this.repository.markProcessed({
        integrationId: job.integrationId,
        updateId: job.updateId,
        leaseId: job.leaseId,
      }))) throw new TelegramUpdateLeaseLostError();
      return "processed";
    } catch (error) {
      if (error instanceof TelegramUpdateLeaseLostError) throw error;
      const deadLetter = job.attempts >= this.maxAttempts;
      const retryAt = new Date(this.now().getTime() + retryDelaySeconds(
        job.attempts,
        this.baseRetrySeconds,
        this.maxRetrySeconds,
      ) * 1_000);
      const marked = await this.repository.markFailed({
        integrationId: job.integrationId,
        updateId: job.updateId,
        leaseId: job.leaseId,
        reason: safeFailureReason(error),
        retryAt,
        deadLetter,
      });
      if (!marked) throw new TelegramUpdateLeaseLostError();
      return deadLetter ? "dead_lettered" : "retried";
    }
  }

  private async deliver(job: TelegramUpdateJob): Promise<void> {
    const incoming = readUpdate(job.payload);
    if (incoming === null) return;

    const flow = this.flows === undefined ? null : await this.flows.loadPublishedFlow(job.projectId);
    if (flow === null || this.dialogs === undefined) {
      await this.deliverStartMessage(job, incoming);
      return;
    }

    const token = await this.tokenVault.open(job.encryptedToken, job.projectId);
    if (incoming.callbackQueryId !== undefined) {
      // Answer first: Telegram spins the button until it hears back.
      await this.telegram.answerCallbackQuery?.(token, incoming.callbackQueryId);
    }

    const state = (await this.dialogs.load(job.integrationId, incoming.chatId)) ?? initialDialogState();
    const step = runFlow(flow, state, incoming.event);
    if (!step.handled && step.messages.length === 0) return;

    let paused = 0;
    for (const message of step.messages) {
      const pause = Math.min(message.delaySeconds ?? 0, Math.max(0, this.maxPauseSeconds - paused));
      if (pause > 0) { await this.sleep(pause * 1_000); paused += pause; }
      await this.telegram.sendMessage(token, {
        chatId: incoming.chatId,
        text: message.text,
        buttons: message.buttons.map((button) => button.kind === "url" && button.url !== undefined
          ? { text: button.label, url: button.url }
          : button.kind === "miniapp"
            ? { text: button.label, webAppUrl: job.miniAppUrl }
            : { text: button.label, callbackData: button.id }),
      });
    }
    await this.dialogs.save(job.integrationId, incoming.chatId, step.state);
  }

  /** Behaviour before scenarios existed: a Mini App button on /start. */
  private async deliverStartMessage(job: TelegramUpdateJob, incoming: IncomingUpdate): Promise<void> {
    if (incoming.event.kind !== "command" || normalizeCommand(incoming.event.command) !== "start") return;
    const token = await this.tokenVault.open(job.encryptedToken, job.projectId);
    await this.telegram.sendMessage(token, {
      chatId: incoming.chatId,
      text: this.startMessageText,
      webAppButton: { text: job.menuButtonText, url: job.miniAppUrl },
    });
  }
}

interface IncomingUpdate {
  chatId: string;
  event: FlowEvent;
  callbackQueryId?: string;
}

function readUpdate(payload: TelegramUpdate): IncomingUpdate | null {
  const callback = callbackUpdateSchema.safeParse(payload);
  if (callback.success) {
    return {
      chatId: String(callback.data.callback_query.message.chat.id),
      event: { kind: "press", handle: callback.data.callback_query.data },
      callbackQueryId: callback.data.callback_query.id,
    };
  }
  const message = messageUpdateSchema.safeParse(payload);
  if (!message.success) return null;
  const text = message.data.message.text;
  // Telegram may append a bot username or a deep-link payload to a command.
  const isCommand = /^\/[A-Za-z0-9_]+(?:@[A-Za-z0-9_]+)?(?:\s|$)/.test(text);
  return {
    chatId: String(message.data.message.chat.id),
    event: isCommand ? { kind: "command", command: text } : { kind: "text", text },
  };
}

function normalizeCommand(command: string): string {
  return command.trim().replace(/^\//, "").split(/[\s@]/)[0]?.toLowerCase() ?? "";
}

function retryDelaySeconds(attempt: number, base: number, maximum: number): number {
  return Math.min(base * 2 ** Math.max(0, attempt - 1), maximum);
}

function safeFailureReason(error: unknown): string {
  // Upstream errors and their URLs can contain bot tokens. Persist only a
  // bounded classification, never the message, stack, cause or request URL.
  return error instanceof Error ? error.name.slice(0, 100) : "UnknownError";
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${name} must be a positive integer`);
  return value;
}
