import { z } from "zod";
import type { EnvelopeTokenVault, SealedSecret } from "../crypto/token-vault.js";
import { NotFoundError } from "../domain/errors.js";
import type { TelegramApi, TelegramBotIdentity } from "../telegram/telegram-client.js";
import { generateTelegramWebhookSecret, hashTelegramWebhookSecret } from "../telegram/telegram-webhook.js";

export const connectBotInputSchema = z
  .object({
    projectId: z.uuid(),
    botToken: z.string().min(20).max(256),
    menuButtonText: z.string().trim().min(1).max(64).default("Открыть приложение"),
  })
  .strict();

export type ConnectBotInput = z.infer<typeof connectBotInputSchema>;

export interface OwnedProject {
  id: string;
  publicId: string;
}

export interface BotConnectionRepository {
  findOwnedProject(projectId: string, ownerUserId: string): Promise<OwnedProject | null>;
  reserve(input: {
    projectId: string;
    ownerUserId: string;
    bot: TelegramBotIdentity;
    token: SealedSecret;
    webhookSecretHash?: Uint8Array;
    menuButtonText: string;
    miniAppUrl: string;
  }): Promise<{ integrationId: string; publicIntegrationId?: string }>;
  markActive(integrationId: string): Promise<void>;
  markError(integrationId: string, reason: string): Promise<void>;
}

export interface BotActivationEntitlementGate {
  assertCanActivateBot(ownerUserId: string, projectId: string): Promise<void>;
}

export interface ConnectBotResult {
  botId: string;
  botUsername?: string;
  miniAppUrl: string;
  status: "active";
}

export class ConnectBotService {
  public constructor(
    private readonly repository: BotConnectionRepository,
    private readonly telegram: TelegramApi,
    private readonly tokenVault: EnvelopeTokenVault,
    private readonly publicTmaOrigin: URL,
    private readonly entitlements?: BotActivationEntitlementGate,
    private readonly publicApiOrigin?: URL,
  ) {}

  /** Free preflight: verifies ownership and token without storing or activating it. */
  public async validate(ownerUserId: string, untrustedInput: unknown) {
    const input = connectBotInputSchema.pick({ projectId: true, botToken: true }).parse(untrustedInput);
    const project = await this.repository.findOwnedProject(input.projectId, ownerUserId);
    if (project === null) throw new NotFoundError("Project not found");
    const bot = await this.telegram.getMe(input.botToken);
    return { botId: bot.id, firstName: bot.firstName, ...(bot.username === undefined ? {} : { username: bot.username }) };
  }

  public async execute(ownerUserId: string, untrustedInput: unknown): Promise<ConnectBotResult> {
    const input = connectBotInputSchema.parse(untrustedInput);
    const project = await this.repository.findOwnedProject(input.projectId, ownerUserId);
    if (project === null) throw new NotFoundError("Project not found");
    await this.entitlements?.assertCanActivateBot(ownerUserId, project.id);

    // The URL is derived server-side, preventing users from turning this endpoint
    // into a generic menu-button setter for arbitrary domains.
    const miniAppUrl = new URL(`/app/${project.publicId}`, this.publicTmaOrigin).toString();
    const bot = await this.telegram.getMe(input.botToken);
    const sealedToken = await this.tokenVault.seal(input.botToken, project.id);
    const webhookSecret = this.publicApiOrigin === undefined ? undefined : generateTelegramWebhookSecret();

    const reservation = await this.repository.reserve({
      projectId: project.id,
      ownerUserId,
      bot,
      token: sealedToken,
      ...(webhookSecret === undefined ? {} : { webhookSecretHash: hashTelegramWebhookSecret(webhookSecret) }),
      menuButtonText: input.menuButtonText,
      miniAppUrl,
    });

    try {
      await this.telegram.setChatMenuButton(input.botToken, input.menuButtonText, miniAppUrl);
      if (webhookSecret !== undefined && reservation.publicIntegrationId !== undefined) {
        const webhookUrl = new URL(`/v1/telegram/webhooks/${reservation.publicIntegrationId}`, this.publicApiOrigin).toString();
        await this.telegram.setWebhook(input.botToken, { url: webhookUrl, secretToken: webhookSecret, allowedUpdates: ["message", "callback_query"], dropPendingUpdates: false });
      }
      await this.repository.markActive(reservation.integrationId);
    } catch (error) {
      // A secondary database failure must not hide the original Telegram failure.
      try {
        await this.repository.markError(reservation.integrationId, publicFailureReason(error));
      } catch {
        // The still-configuring reservation is safe to reconcile/retry later.
      }
      throw error;
    }

    return {
      botId: bot.id,
      ...(bot.username === undefined ? {} : { botUsername: bot.username }),
      miniAppUrl,
      status: "active",
    };
  }
}

function publicFailureReason(error: unknown): string {
  // Never persist error objects: request URLs can contain the secret token.
  return error instanceof Error ? error.name.slice(0, 100) : "UnknownError";
}
