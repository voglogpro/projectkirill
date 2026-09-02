import { describe, expect, it, vi } from "vitest";
import { TelegramTokenError, TelegramUpstreamError } from "../src/domain/errors.js";
import { TelegramBotApiClient } from "../src/telegram/telegram-client.js";

describe("TelegramBotApiClient", () => {
  it("uses getMe and maps Telegram fields without converting the id in domain code", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { id: 123456789, is_bot: true, first_name: "Store", username: "store_bot" } }), { status: 200, headers: { "content-type": "application/json" } }));
    const client = new TelegramBotApiClient(fetchMock, "https://telegram.test");
    const token = "123456789:abcdefghijklmnopqrstuvwxyz_ABCDEFGHIJK";

    await expect(client.getMe(token)).resolves.toEqual({ id: "123456789", isBot: true, firstName: "Store", username: "store_bot" });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`https://telegram.test/bot${token}/getMe`);
  });

  it("sends the official MenuButtonWebApp shape", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ok: true, result: true }), { status: 200, headers: { "content-type": "application/json" } }));
    const client = new TelegramBotApiClient(fetchMock, "https://telegram.test");
    const token = "123456789:abcdefghijklmnopqrstuvwxyz_ABCDEFGHIJK";

    await client.setChatMenuButton(token, "Открыть", "https://apps.example.com/app/public-id");

    const init = fetchMock.mock.calls[0]?.[1];
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`https://telegram.test/bot${token}/setChatMenuButton`);
    expect(JSON.parse(String(init?.body))).toEqual({ menu_button: { type: "web_app", text: "Открыть", web_app: { url: "https://apps.example.com/app/public-id" } } });
  });

  it("classifies rejected credentials without leaking the token", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ok: false, error_code: 401, description: "Unauthorized" }), { status: 401, headers: { "content-type": "application/json" } }));
    const client = new TelegramBotApiClient(fetchMock, "https://telegram.test");
    const token = "123456789:abcdefghijklmnopqrstuvwxyz_ABCDEFGHIJK";

    const promise = client.getMe(token);
    await expect(promise).rejects.toBeInstanceOf(TelegramTokenError);
    await expect(promise).rejects.not.toThrow(token);
  });

  it("does not retain a fetch error that may contain the tokenized URL", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      throw new Error(`network failure for ${String(url)}`);
    });
    const client = new TelegramBotApiClient(fetchMock, "https://telegram.test");
    const token = "123456789:abcdefghijklmnopqrstuvwxyz_ABCDEFGHIJK";

    const promise = client.getMe(token);
    await expect(promise).rejects.toBeInstanceOf(TelegramUpstreamError);
    await expect(promise).rejects.not.toThrow(token);
  });

  it("configures a webhook with the official secret header contract", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ok: true, result: true }), { status: 200 }));
    const client = new TelegramBotApiClient(fetchMock, "https://telegram.test");
    const token = "123456789:abcdefghijklmnopqrstuvwxyz_ABCDEFGHIJK";

    await client.setWebhook(token, {
      url: "https://api.example.com/v1/telegram/webhooks/public-id",
      secretToken: "safe_webhook-secret",
      allowedUpdates: ["message"],
    });

    const init = fetchMock.mock.calls[0]?.[1];
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`https://telegram.test/bot${token}/setWebhook`);
    expect(JSON.parse(String(init?.body))).toEqual({
      url: "https://api.example.com/v1/telegram/webhooks/public-id",
      secret_token: "safe_webhook-secret",
      allowed_updates: ["message"],
      drop_pending_updates: false,
    });
  });

  it("sends a start message with an inline Mini App button", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { message_id: 42 } }), { status: 200 }));
    const client = new TelegramBotApiClient(fetchMock, "https://telegram.test");
    const token = "123456789:abcdefghijklmnopqrstuvwxyz_ABCDEFGHIJK";

    await expect(client.sendMessage(token, {
      chatId: "100500",
      text: "Welcome",
      webAppButton: { text: "Open", url: "https://apps.example.com/app/project" },
    })).resolves.toEqual({ messageId: 42 });

    const init = fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(String(init?.body))).toEqual({
      chat_id: "100500",
      text: "Welcome",
      reply_markup: { inline_keyboard: [[{ text: "Open", web_app: { url: "https://apps.example.com/app/project" } }]] },
    });
  });
});
