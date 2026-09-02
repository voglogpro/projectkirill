import { z } from "zod";
import type { EnvelopeTokenVault, SealedSecret } from "../crypto/token-vault.js";
import type { TelegramApi } from "./telegram-client.js";
import type { TelegramUpdate } from "./telegram-webhook.js";

const startMessageSchema = z.object({
  message: z.object({
    chat: z.object({
      id: z.union([z.number().int().safe(), z.string().regex(/^-?[0-9]+$/)]),
      type: z.literal("private"),
    }),
    text: z.string(),
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

export interface TelegramUpdateWorkerOptions {
  leaseSeconds?: number;
  maxAttempts?: number;
  baseRetrySeconds?: number;
  maxRetrySeconds?: number;
  now?: () => Date;
  startMessageText?: string;
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

  public constructor(
    private readonly repository: TelegramUpdateJobRepository,
    private readonly tokenVault: Pick<EnvelopeTokenVault, "open">,
    private readonly telegram: Pick<TelegramApi, "sendMessage">,
    options: TelegramUpdateWorkerOptions = {},
  ) {
    this.leaseSeconds = positiveInteger(options.leaseSeconds ?? 60, "leaseSeconds");
    this.maxAttempts = positiveInteger(options.maxAttempts ?? 8, "maxAttempts");
    this.baseRetrySeconds = positiveInteger(options.baseRetrySeconds ?? 5, "baseRetrySeconds");
    this.maxRetrySeconds = positiveInteger(options.maxRetrySeconds ?? 5 * 60, "maxRetrySeconds");
    this.now = options.now ?? (() => new Date());
    this.startMessageText = options.startMessageText ?? "Приложение готово. Нажмите кнопку, чтобы открыть его.";
  }

  public async runOnce(): Promise<TelegramUpdateWorkerResult> {
    const job = await this.repository.claimNext({
      leaseSeconds: this.leaseSeconds,
      maxAttempts: this.maxAttempts,
    });
    if (job === null) return "idle";

    try {
      const startMessage = getStartMessage(job.payload);
      if (startMessage !== null) {
        const token = await this.tokenVault.open(job.encryptedToken, job.projectId);
        await this.telegram.sendMessage(token, {
          chatId: startMessage.chatId,
          text: this.startMessageText,
          webAppButton: { text: job.menuButtonText, url: job.miniAppUrl },
        });
      }
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
}

function getStartMessage(payload: TelegramUpdate): { chatId: string } | null {
  const result = startMessageSchema.safeParse(payload);
  if (!result.success) return null;
  // Telegram may append a bot username or a deep-link payload to /start.
  if (!/^\/start(?:@[A-Za-z0-9_]+)?(?:\s|$)/.test(result.data.message.text)) return null;
  return { chatId: String(result.data.message.chat.id) };
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
