import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { registerTelegramWebhookRoutes } from "../src/http/telegram-webhook-routes.js";
import {
  hashTelegramWebhookSecret,
  TelegramWebhookAuthenticationError,
  TelegramWebhookPayloadError,
  TelegramWebhookService,
  type TelegramUpdateRepository,
} from "../src/telegram/telegram-webhook.js";

function fixture() {
  const integrationId = randomUUID();
  const publicId = randomUUID();
  const secret = "telegram_webhook_secret-123";
  const repository: TelegramUpdateRepository = {
    findActiveIntegration: vi.fn().mockResolvedValue({
      id: integrationId,
      projectId: randomUUID(),
      webhookSecretHash: hashTelegramWebhookSecret(secret),
    }),
    storeUpdate: vi.fn().mockResolvedValue("stored"),
  };
  return { integrationId, publicId, secret, repository, service: new TelegramWebhookService(repository) };
}

describe("TelegramWebhookService", () => {
  it("authenticates the secret and durably accepts an update", async () => {
    const { service, repository, integrationId, publicId, secret } = fixture();
    await expect(service.receive(publicId, secret, { update_id: 1001, message: { text: "/start" } }))
      .resolves.toEqual({ accepted: true, duplicate: false });
    expect(repository.storeUpdate).toHaveBeenCalledWith({
      integrationId,
      updateId: 1001,
      payload: { update_id: 1001, message: { text: "/start" } },
    });
  });

  it("reports duplicate deliveries without storing a second row", async () => {
    const { service, repository, publicId, secret } = fixture();
    vi.mocked(repository.storeUpdate).mockResolvedValue("duplicate");
    await expect(service.receive(publicId, secret, { update_id: 1001 }))
      .resolves.toEqual({ accepted: true, duplicate: true });
  });

  it("rejects an invalid secret before accepting the update", async () => {
    const { service, repository, publicId } = fixture();
    await expect(service.receive(publicId, "wrong", { update_id: 1001 }))
      .rejects.toBeInstanceOf(TelegramWebhookAuthenticationError);
    expect(repository.storeUpdate).not.toHaveBeenCalled();
  });

  it("rejects a malformed update", async () => {
    const { service, publicId, secret } = fixture();
    await expect(service.receive(publicId, secret, { message: {} }))
      .rejects.toBeInstanceOf(TelegramWebhookPayloadError);
  });
});

describe("registerTelegramWebhookRoutes", () => {
  it("returns 200 for a durable receipt and 401 for a bad header", async () => {
    const { service, publicId, secret } = fixture();
    const app = Fastify();
    await registerTelegramWebhookRoutes(app, service);

    const accepted = await app.inject({
      method: "POST",
      url: `/v1/telegram/webhooks/${publicId}`,
      headers: { "x-telegram-bot-api-secret-token": secret },
      payload: { update_id: 55 },
    });
    const rejected = await app.inject({
      method: "POST",
      url: `/v1/telegram/webhooks/${publicId}`,
      payload: { update_id: 56 },
    });

    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toEqual({ ok: true, duplicate: false });
    expect(rejected.statusCode).toBe(401);
    await app.close();
  });
});
