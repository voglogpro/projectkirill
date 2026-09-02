import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const telegramUpdateSchema = z.object({ update_id: z.number().int().nonnegative() }).passthrough();
const DUMMY_SECRET_HASH = Buffer.alloc(32);

export type TelegramUpdate = z.infer<typeof telegramUpdateSchema>;

export interface TelegramWebhookIntegration {
  id: string;
  projectId: string;
  webhookSecretHash: Uint8Array;
}

export interface TelegramUpdateRepository {
  findActiveIntegration(publicId: string): Promise<TelegramWebhookIntegration | null>;
  storeUpdate(input: {
    integrationId: string;
    updateId: number;
    payload: TelegramUpdate;
  }): Promise<"stored" | "duplicate">;
}

export class TelegramWebhookAuthenticationError extends Error {
  public constructor() {
    super("Telegram webhook authentication failed");
    this.name = "TelegramWebhookAuthenticationError";
  }
}

export class TelegramWebhookPayloadError extends Error {
  public constructor() {
    super("Telegram webhook payload is invalid");
    this.name = "TelegramWebhookPayloadError";
  }
}

export interface TelegramWebhookReceipt {
  accepted: true;
  duplicate: boolean;
}

/** Durable webhook ingress. Processing happens from telegram_updates later. */
export class TelegramWebhookService {
  public constructor(private readonly repository: TelegramUpdateRepository) {}

  public async receive(publicIntegrationId: string, presentedSecret: string, body: unknown): Promise<TelegramWebhookReceipt> {
    const integration = await this.repository.findActiveIntegration(publicIntegrationId);
    // Always hash and compare, including unknown public ids, to avoid exposing
    // whether an integration exists through an obvious secret-check shortcut.
    const secretIsValid = verifyWebhookSecret(presentedSecret, integration?.webhookSecretHash);
    if (integration === null || !secretIsValid) {
      throw new TelegramWebhookAuthenticationError();
    }

    const parsed = telegramUpdateSchema.safeParse(body);
    if (!parsed.success) throw new TelegramWebhookPayloadError();
    const outcome = await this.repository.storeUpdate({
      integrationId: integration.id,
      updateId: parsed.data.update_id,
      payload: parsed.data,
    });
    return { accepted: true, duplicate: outcome === "duplicate" };
  }
}

/** Generates a Bot API-compatible secret. Only its SHA-256 digest belongs in DB. */
export function generateTelegramWebhookSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function hashTelegramWebhookSecret(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

function verifyWebhookSecret(presented: string, storedHash: Uint8Array | undefined): boolean {
  const formatIsValid = /^[A-Za-z0-9_-]{1,256}$/.test(presented);
  const candidateHash = hashTelegramWebhookSecret(formatIsValid ? presented : "");
  const rawStored = storedHash === undefined ? DUMMY_SECRET_HASH : Buffer.from(storedHash);
  const comparableStored = rawStored.length === 32 ? rawStored : DUMMY_SECRET_HASH;
  const matches = timingSafeEqual(candidateHash, comparableStored);
  return formatIsValid && storedHash !== undefined && rawStored.length === 32 && matches;
}
