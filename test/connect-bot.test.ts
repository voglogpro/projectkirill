import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { ConnectBotService, type BotConnectionRepository } from "../src/application/connect-bot.js";
import { EnvelopeTokenVault, LocalAesKek } from "../src/crypto/token-vault.js";
import { NotFoundError } from "../src/domain/errors.js";
import type { TelegramApi } from "../src/telegram/telegram-client.js";

function fixture() {
  const projectId = randomUUID();
  const publicId = randomUUID();
  const integrationId = randomUUID();
  const repository: BotConnectionRepository = {
    findOwnedProject: vi.fn().mockResolvedValue({ id: projectId, publicId }),
    reserve: vi.fn().mockResolvedValue({ integrationId }),
    markActive: vi.fn().mockResolvedValue(undefined),
    markError: vi.fn().mockResolvedValue(undefined),
  };
  const telegram: TelegramApi = {
    getMe: vi.fn().mockResolvedValue({ id: "9007199254740991", isBot: true, firstName: "Shop", username: "shop_bot" }),
    setChatMenuButton: vi.fn().mockResolvedValue(undefined),
    setWebhook: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue({ messageId: 1 }),
  };
  const vault = new EnvelopeTokenVault(new LocalAesKek(randomBytes(32).toString("base64"), "test"));
  return { projectId, publicId, integrationId, repository, telegram, service: new ConnectBotService(repository, telegram, vault, new URL("https://apps.example.com")) };
}

describe("ConnectBotService", () => {
  it("validates, reserves, configures Telegram and activates the integration", async () => {
    const { service, projectId, publicId, repository, telegram } = fixture();
    const token = "123456789:abcdefghijklmnopqrstuvwxyz_ABCDEFGHIJK";

    const result = await service.execute(randomUUID(), { projectId, botToken: token, menuButtonText: "Каталог" });

    expect(result).toEqual({ botId: "9007199254740991", botUsername: "shop_bot", miniAppUrl: `https://apps.example.com/app/${publicId}`, status: "active" });
    expect(telegram.setChatMenuButton).toHaveBeenCalledWith(token, "Каталог", `https://apps.example.com/app/${publicId}`);
    expect(repository.markActive).toHaveBeenCalledOnce();
    const reserveInput = vi.mocked(repository.reserve).mock.calls[0]?.[0];
    expect(JSON.stringify(reserveInput?.token)).not.toContain(token);
  });

  it("does not call Telegram for a project the user does not own", async () => {
    const { service, projectId, repository, telegram } = fixture();
    vi.mocked(repository.findOwnedProject).mockResolvedValue(null);

    await expect(service.execute(randomUUID(), { projectId, botToken: "123456789:abcdefghijklmnopqrstuvwxyz_ABCDEFGHIJK" })).rejects.toBeInstanceOf(NotFoundError);
    expect(telegram.getMe).not.toHaveBeenCalled();
  });

  it("marks the integration as failed when setMenuButton fails", async () => {
    const { service, projectId, repository, telegram, integrationId } = fixture();
    vi.mocked(telegram.setChatMenuButton).mockRejectedValue(new Error("upstream unavailable"));

    await expect(service.execute(randomUUID(), { projectId, botToken: "123456789:abcdefghijklmnopqrstuvwxyz_ABCDEFGHIJK" })).rejects.toThrow("upstream unavailable");
    expect(repository.markError).toHaveBeenCalledWith(integrationId, "Error");
  });
});
