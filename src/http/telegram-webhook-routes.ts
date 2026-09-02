import type { FastifyInstance } from "fastify";
import type { TelegramWebhookService } from "../telegram/telegram-webhook.js";
import {
  TelegramWebhookAuthenticationError,
  TelegramWebhookPayloadError,
} from "../telegram/telegram-webhook.js";

interface TelegramWebhookRoute {
  Params: { integrationPublicId: string };
}

export async function registerTelegramWebhookRoutes(
  app: FastifyInstance,
  service: TelegramWebhookService,
): Promise<void> {
  app.post<TelegramWebhookRoute>("/v1/telegram/webhooks/:integrationPublicId", async (request, reply) => {
    const header = request.headers["x-telegram-bot-api-secret-token"];
    const presentedSecret = typeof header === "string" ? header : "";
    try {
      const receipt = await service.receive(request.params.integrationPublicId, presentedSecret, request.body);
      return await reply.code(200).send({ ok: true, duplicate: receipt.duplicate });
    } catch (error) {
      if (error instanceof TelegramWebhookAuthenticationError) {
        return await reply.code(401).send({ error: { code: "INVALID_WEBHOOK_SECRET" } });
      }
      if (error instanceof TelegramWebhookPayloadError) {
        return await reply.code(400).send({ error: { code: "INVALID_TELEGRAM_UPDATE" } });
      }
      request.log.error({ err: error }, "Telegram webhook persistence failed");
      throw error;
    }
  });
}
