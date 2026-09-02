import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  TelegramInitDataError,
  validateTelegramInitData,
} from "../src/telegram/init-data-validator.js";

const BOT_TOKEN = "123456789:abcdefghijklmnopqrstuvwxyz_ABCDEFGHIJK";
const NOW = new Date("2026-09-02T12:00:00.000Z");

function signedInitData(values: Record<string, string>): string {
  const dataCheckString = Object.entries(values)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const hash = createHmac("sha256", secret).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...values, hash }).toString();
}

describe("validateTelegramInitData", () => {
  it("validates Telegram's two-step HMAC and returns typed fields", () => {
    const authDate = String(Math.floor(NOW.getTime() / 1_000) - 10);
    const raw = signedInitData({
      auth_date: authDate,
      query_id: "AAHdF6IQAAAAAN0XohDhrOrc",
      start_param: "preview_abc",
      user: JSON.stringify({ id: 123456789, first_name: "Kirill", language_code: "ru" }),
    });

    expect(validateTelegramInitData(raw, BOT_TOKEN, { now: NOW })).toMatchObject({
      authDateUnix: Number(authDate),
      queryId: "AAHdF6IQAAAAAN0XohDhrOrc",
      startParam: "preview_abc",
      user: { id: 123456789, first_name: "Kirill", language_code: "ru" },
    });
  });

  it("rejects tampering using a constant-length hash comparison", () => {
    const raw = signedInitData({ auth_date: String(Math.floor(NOW.getTime() / 1_000)), query_id: "original" });
    expect(() => validateTelegramInitData(raw.replace("original", "tampered"), BOT_TOKEN, { now: NOW }))
      .toThrowError(expect.objectContaining<TelegramInitDataError>({ code: "INVALID_HASH" }));
  });

  it("rejects duplicate decoded keys before signature verification", () => {
    const raw = `${signedInitData({ auth_date: String(Math.floor(NOW.getTime() / 1_000)) })}&auth%5Fdate=1`;
    expect(() => validateTelegramInitData(raw, BOT_TOKEN, { now: NOW }))
      .toThrowError(expect.objectContaining<TelegramInitDataError>({ code: "DUPLICATE_KEY" }));
  });

  it("enforces the 8 KiB byte limit", () => {
    expect(() => validateTelegramInitData(`query_id=${"я".repeat(4_100)}`, BOT_TOKEN, { now: NOW }))
      .toThrowError(expect.objectContaining<TelegramInitDataError>({ code: "TOO_LARGE" }));
  });

  it("rejects expired data and excessive future clock skew", () => {
    const nowSeconds = Math.floor(NOW.getTime() / 1_000);
    const expired = signedInitData({ auth_date: String(nowSeconds - 901) });
    const future = signedInitData({ auth_date: String(nowSeconds + 31) });

    expect(() => validateTelegramInitData(expired, BOT_TOKEN, { now: NOW }))
      .toThrowError(expect.objectContaining<TelegramInitDataError>({ code: "EXPIRED" }));
    expect(() => validateTelegramInitData(future, BOT_TOKEN, { now: NOW }))
      .toThrowError(expect.objectContaining<TelegramInitDataError>({ code: "FUTURE_AUTH_DATE" }));
  });
});
