import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { botFlowDocumentSchema, type BotFlowDocument } from "../src/domain/bot-flow.js";
import type { DialogState } from "../src/domain/bot-flow-runtime.js";
import type { SealedSecret } from "../src/crypto/token-vault.js";
import {
  TelegramUpdateWorker,
  type TelegramUpdateJob,
  type TelegramUpdateJobRepository,
} from "../src/telegram/telegram-update-worker.js";

const sealedToken: SealedSecret = {
  version: 1,
  algorithm: "AES-256-GCM",
  ciphertext: "ciphertext",
  iv: "iv",
  authTag: "tag",
  wrappedKey: { keyId: "test", ciphertext: "wrapped", iv: "iv", authTag: "tag" },
};

const at = { x: 0, y: 0 };
const ids = { start: randomUUID(), hello: randomUUID(), ask: randomUUID(), done: randomUUID(), pause: randomUUID() };

function scenario(): BotFlowDocument {
  return botFlowDocumentSchema.parse({
    schemaVersion: 1,
    metadata: { name: "Запись" },
    nodes: [
      { id: ids.start, version: 1, position: at, type: "start", props: { command: "start", description: "" } },
      { id: ids.hello, version: 1, position: at, type: "message", props: { text: "Записать вас?", buttons: [{ id: "book", kind: "next", label: "Да" }, { id: "app", kind: "miniapp", label: "Открыть приложение" }] } },
      { id: ids.pause, version: 1, position: at, type: "delay", props: { seconds: 900 } },
      { id: ids.ask, version: 1, position: at, type: "question", props: { text: "Как вас зовут?", variable: "name", expects: "any", retryText: "Ещё раз." } },
      { id: ids.done, version: 1, position: at, type: "message", props: { text: "Готово, {{name}}!", buttons: [] } },
    ],
    edges: [
      { id: "e1", from: ids.start, fromHandle: "next", to: ids.hello },
      { id: "e2", from: ids.hello, fromHandle: "book", to: ids.pause },
      { id: "e3", from: ids.pause, fromHandle: "next", to: ids.ask },
      { id: "e4", from: ids.ask, fromHandle: "next", to: ids.done },
    ],
  });
}

function makeJob(payload: TelegramUpdateJob["payload"]): TelegramUpdateJob {
  return {
    integrationId: randomUUID(), updateId: 7, leaseId: randomUUID(), attempts: 1, projectId: randomUUID(),
    encryptedToken: sealedToken, miniAppUrl: "https://apps.example.com/app/shop", menuButtonText: "Открыть", payload,
  };
}

function fixture(payload: TelegramUpdateJob["payload"], stored: DialogState | null = null, flow: BotFlowDocument | null = scenario()) {
  const job = makeJob(payload);
  const repository: TelegramUpdateJobRepository = {
    claimNext: vi.fn().mockResolvedValue(job),
    markProcessed: vi.fn().mockResolvedValue(true),
    markFailed: vi.fn().mockResolvedValue(true),
  };
  const telegram = { sendMessage: vi.fn().mockResolvedValue({ messageId: 1 }), answerCallbackQuery: vi.fn().mockResolvedValue(undefined) };
  const dialogs = { load: vi.fn().mockResolvedValue(stored), save: vi.fn().mockResolvedValue(undefined) };
  const sleep = vi.fn().mockResolvedValue(undefined);
  const worker = new TelegramUpdateWorker(
    repository,
    { open: vi.fn().mockResolvedValue("123456789:abcdefghijklmnopqrstuvwxyz_ABCDEFGHIJK") },
    telegram,
    { flows: { loadPublishedFlow: vi.fn().mockResolvedValue(flow) }, dialogs, sleep },
  );
  return { worker, telegram, dialogs, sleep, job };
}

const chat = { id: 5150, type: "private" as const };

describe("telegram worker running a published scenario", () => {
  it("never exposes a Mini App button for a text-only paid bot", async () => {
    const { worker, telegram, job } = fixture({ update_id: 7, message: { chat, text: "/start" } });
    job.miniAppEnabled = false;
    expect(await worker.runOnce()).toBe("processed");
    const [, options] = telegram.sendMessage.mock.calls[0] ?? [];
    expect(options.buttons).toEqual([{ text: "Да", callbackData: "book" }]);
    expect(options.webAppButton).toBeUndefined();
  });

  it("answers /start with the scenario message and its inline buttons", async () => {
    const { worker, telegram, dialogs } = fixture({ update_id: 7, message: { chat, text: "/start" } });
    expect(await worker.runOnce()).toBe("processed");

    const [, options] = telegram.sendMessage.mock.calls[0] ?? [];
    expect(options.chatId).toBe("5150");
    expect(options.text).toBe("Записать вас?");
    expect(options.buttons).toEqual([
      { text: "Да", callbackData: "book" },
      { text: "Открыть приложение", webAppUrl: "https://apps.example.com/app/shop" },
    ]);
    expect(dialogs.save.mock.calls[0]?.[2]).toMatchObject({ awaiting: "press" });
  });

  it("clears the button spinner and follows the pressed exit", async () => {
    const parked = { currentNodeId: ids.hello, awaiting: "press" as const, variables: {} };
    const { worker, telegram } = fixture(
      { update_id: 7, callback_query: { id: "cbq-1", data: "book", message: { chat } } },
      parked,
    );
    expect(await worker.runOnce()).toBe("processed");
    expect(telegram.answerCallbackQuery).toHaveBeenCalledWith(expect.any(String), "cbq-1");
    expect(telegram.sendMessage.mock.calls[0]?.[1].text).toBe("Как вас зовут?");
  });

  it("caps a long scenario pause so one update cannot hold the lease", async () => {
    const parked = { currentNodeId: ids.hello, awaiting: "press" as const, variables: {} };
    const { worker, sleep } = fixture({ update_id: 7, callback_query: { id: "c", data: "book", message: { chat } } }, parked);
    await worker.runOnce();
    expect(sleep).toHaveBeenCalledWith(3_000);
  });

  it("stores the answer and fills it into the next message", async () => {
    const parked = { currentNodeId: ids.ask, awaiting: "text" as const, variables: {} };
    const { worker, telegram, dialogs } = fixture({ update_id: 7, message: { chat, text: "Анна" } }, parked);
    expect(await worker.runOnce()).toBe("processed");
    expect(telegram.sendMessage.mock.calls[0]?.[1].text).toBe("Готово, Анна!");
    expect(dialogs.save.mock.calls[0]?.[2].variables).toEqual({ name: "Анна" });
  });

  it("says nothing when the scenario has no answer for the message", async () => {
    const { worker, telegram, dialogs } = fixture({ update_id: 7, message: { chat, text: "просто текст" } });
    expect(await worker.runOnce()).toBe("processed");
    expect(telegram.sendMessage).not.toHaveBeenCalled();
    expect(dialogs.save).not.toHaveBeenCalled();
  });

  it("falls back to the Mini App button while no scenario is published", async () => {
    const { worker, telegram } = fixture({ update_id: 7, message: { chat, text: "/start" } }, null, null);
    expect(await worker.runOnce()).toBe("processed");
    expect(telegram.sendMessage.mock.calls[0]?.[1]).toMatchObject({
      webAppButton: { text: "Открыть", url: "https://apps.example.com/app/shop" },
    });
  });
});
