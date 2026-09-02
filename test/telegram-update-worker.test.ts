import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { SealedSecret } from "../src/crypto/token-vault.js";
import {
  TelegramUpdateLeaseLostError,
  TelegramUpdateWorker,
  type TelegramUpdateJob,
  type TelegramUpdateJobRepository,
} from "../src/telegram/telegram-update-worker.js";

const NOW = new Date("2026-09-02T12:00:00.000Z");

const sealedToken: SealedSecret = {
  version: 1,
  algorithm: "AES-256-GCM",
  ciphertext: "ciphertext",
  iv: "iv",
  authTag: "tag",
  wrappedKey: { keyId: "test", ciphertext: "wrapped", iv: "iv", authTag: "tag" },
};

function makeJob(overrides: Partial<TelegramUpdateJob> = {}): TelegramUpdateJob {
  return {
    integrationId: randomUUID(),
    updateId: 1001,
    leaseId: randomUUID(),
    attempts: 1,
    projectId: randomUUID(),
    encryptedToken: sealedToken,
    miniAppUrl: "https://apps.example.com/app/project",
    menuButtonText: "Открыть",
    payload: { update_id: 1001, message: { chat: { id: 9007199254740991, type: "private" }, text: "/start campaign" } },
    ...overrides,
  };
}

function fixture(job: TelegramUpdateJob | null = makeJob()) {
  const repository: TelegramUpdateJobRepository = {
    claimNext: vi.fn().mockResolvedValue(job),
    markProcessed: vi.fn().mockResolvedValue(true),
    markFailed: vi.fn().mockResolvedValue(true),
  };
  const tokenVault = { open: vi.fn().mockResolvedValue("123456789:abcdefghijklmnopqrstuvwxyz_ABCDEFGHIJK") };
  const telegram = { sendMessage: vi.fn().mockResolvedValue({ messageId: 42 }) };
  const worker = new TelegramUpdateWorker(repository, tokenVault, telegram, { now: () => NOW });
  return { repository, tokenVault, telegram, worker, job };
}

describe("TelegramUpdateWorker", () => {
  it("decrypts the active integration token and answers /start with the Mini App button", async () => {
    const { worker, repository, tokenVault, telegram, job } = fixture();

    await expect(worker.runOnce()).resolves.toBe("processed");
    expect(tokenVault.open).toHaveBeenCalledWith(job?.encryptedToken, job?.projectId);
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      "123456789:abcdefghijklmnopqrstuvwxyz_ABCDEFGHIJK",
      {
        chatId: "9007199254740991",
        text: "Приложение готово. Нажмите кнопку, чтобы открыть его.",
        webAppButton: { text: "Открыть", url: "https://apps.example.com/app/project" },
      },
    );
    expect(repository.markProcessed).toHaveBeenCalledWith({
      integrationId: job?.integrationId,
      updateId: job?.updateId,
      leaseId: job?.leaseId,
    });
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it("acknowledges unrelated Telegram updates without decrypting the token", async () => {
    const { worker, repository, tokenVault, telegram } = fixture(makeJob({
      payload: { update_id: 1001, message: { chat: { id: 1, type: "private" }, text: "hello" } },
    }));

    await expect(worker.runOnce()).resolves.toBe("processed");
    expect(tokenVault.open).not.toHaveBeenCalled();
    expect(telegram.sendMessage).not.toHaveBeenCalled();
    expect(repository.markProcessed).toHaveBeenCalledOnce();
  });

  it("does not send a Web App button in a group, where Telegram forbids it", async () => {
    const { worker, tokenVault, telegram } = fixture(makeJob({
      payload: { update_id: 1001, message: { chat: { id: -100123, type: "supergroup" }, text: "/start" } },
    }));

    await expect(worker.runOnce()).resolves.toBe("processed");
    expect(tokenVault.open).not.toHaveBeenCalled();
    expect(telegram.sendMessage).not.toHaveBeenCalled();
  });

  it("retries with exponential backoff and persists no sensitive error text", async () => {
    const { worker, repository, telegram, job } = fixture();
    vi.mocked(telegram.sendMessage).mockRejectedValue(new TypeError("secret token appeared here"));

    await expect(worker.runOnce()).resolves.toBe("retried");
    expect(repository.markFailed).toHaveBeenCalledWith({
      integrationId: job?.integrationId,
      updateId: job?.updateId,
      leaseId: job?.leaseId,
      reason: "TypeError",
      retryAt: new Date("2026-09-02T12:00:05.000Z"),
      deadLetter: false,
    });
    expect(JSON.stringify(vi.mocked(repository.markFailed).mock.calls)).not.toContain("secret token appeared here");
  });

  it("dead-letters an update after the final attempt", async () => {
    const { worker, telegram } = fixture(makeJob({ attempts: 8 }));
    vi.mocked(telegram.sendMessage).mockRejectedValue(new Error("unavailable"));
    await expect(worker.runOnce()).resolves.toBe("dead_lettered");
  });

  it("reports idle and protects a reclaimed lease", async () => {
    const idle = fixture(null);
    await expect(idle.worker.runOnce()).resolves.toBe("idle");

    const lost = fixture();
    vi.mocked(lost.repository.markProcessed).mockResolvedValue(false);
    await expect(lost.worker.runOnce()).rejects.toBeInstanceOf(TelegramUpdateLeaseLostError);
    expect(lost.repository.markFailed).not.toHaveBeenCalled();
  });
});
