import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const MAX_INIT_DATA_BYTES = 8 * 1_024;
const DEFAULT_MAX_AGE_SECONDS = 15 * 60;
const DEFAULT_MAX_FUTURE_SKEW_SECONDS = 30;

const telegramUserSchema = z
  .object({
    id: z.number().int().safe(),
    is_bot: z.boolean().optional(),
    first_name: z.string(),
    last_name: z.string().optional(),
    username: z.string().optional(),
    language_code: z.string().optional(),
    is_premium: z.boolean().optional(),
    allows_write_to_pm: z.boolean().optional(),
  })
  .passthrough();

export type TelegramInitDataErrorCode =
  | "TOO_LARGE"
  | "MALFORMED"
  | "DUPLICATE_KEY"
  | "MISSING_FIELD"
  | "INVALID_HASH"
  | "EXPIRED"
  | "FUTURE_AUTH_DATE";

export class TelegramInitDataError extends Error {
  public constructor(public readonly code: TelegramInitDataErrorCode, message: string) {
    super(message);
    this.name = "TelegramInitDataError";
  }
}

export interface TelegramInitDataValidationOptions {
  now?: Date;
  maxAgeSeconds?: number;
  maxFutureSkewSeconds?: number;
}

export interface ValidatedTelegramInitData {
  authDate: Date;
  authDateUnix: number;
  fields: Readonly<Record<string, string>>;
  queryId?: string;
  startParam?: string;
  user?: z.infer<typeof telegramUserSchema>;
}

/**
 * Validates Telegram.WebApp.initData using Telegram's two-step HMAC-SHA-256
 * construction. The caller must select the bot token from a trusted route or
 * host before calling this function; a project id supplied by the client is not
 * a trustworthy way to select the verification key.
 */
export function validateTelegramInitData(
  rawInitData: string,
  botToken: string,
  options: TelegramInitDataValidationOptions = {},
): ValidatedTelegramInitData {
  if (Buffer.byteLength(rawInitData, "utf8") > MAX_INIT_DATA_BYTES) {
    throw new TelegramInitDataError("TOO_LARGE", "Telegram init data exceeds 8 KiB");
  }
  if (rawInitData.length === 0) {
    throw new TelegramInitDataError("MALFORMED", "Telegram init data is empty");
  }

  const fields = parseUniqueQueryString(rawInitData);
  const receivedHash = fields.get("hash");
  const authDateRaw = fields.get("auth_date");
  if (receivedHash === undefined || authDateRaw === undefined) {
    throw new TelegramInitDataError("MISSING_FIELD", "Telegram init data lacks hash or auth_date");
  }
  if (!/^[a-fA-F0-9]{64}$/.test(receivedHash)) {
    throw new TelegramInitDataError("INVALID_HASH", "Telegram init data hash has an invalid format");
  }

  const dataCheckString = [...fields.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken, "utf8").digest();
  const expectedHash = createHmac("sha256", secretKey).update(dataCheckString, "utf8").digest();
  const actualHash = Buffer.from(receivedHash, "hex");
  if (!timingSafeEqual(expectedHash, actualHash)) {
    throw new TelegramInitDataError("INVALID_HASH", "Telegram init data signature is invalid");
  }

  if (!/^[0-9]{1,16}$/.test(authDateRaw)) {
    throw new TelegramInitDataError("MALFORMED", "Telegram auth_date is invalid");
  }
  const authDateUnix = Number(authDateRaw);
  if (!Number.isSafeInteger(authDateUnix) || authDateUnix <= 0) {
    throw new TelegramInitDataError("MALFORMED", "Telegram auth_date is invalid");
  }

  const maxAgeSeconds = options.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS;
  const maxFutureSkewSeconds = options.maxFutureSkewSeconds ?? DEFAULT_MAX_FUTURE_SKEW_SECONDS;
  assertNonNegativeFinite(maxAgeSeconds, "maxAgeSeconds");
  assertNonNegativeFinite(maxFutureSkewSeconds, "maxFutureSkewSeconds");
  const nowUnix = Math.floor((options.now ?? new Date()).getTime() / 1_000);
  if (authDateUnix > nowUnix + maxFutureSkewSeconds) {
    throw new TelegramInitDataError("FUTURE_AUTH_DATE", "Telegram init data is dated in the future");
  }
  if (authDateUnix < nowUnix - maxAgeSeconds) {
    throw new TelegramInitDataError("EXPIRED", "Telegram init data has expired");
  }

  const user = parseUser(fields.get("user"));
  const safeFields = Object.freeze(Object.fromEntries(fields));
  const queryId = fields.get("query_id");
  const startParam = fields.get("start_param");
  return {
    authDate: new Date(authDateUnix * 1_000),
    authDateUnix,
    fields: safeFields,
    ...(queryId === undefined ? {} : { queryId }),
    ...(startParam === undefined ? {} : { startParam }),
    ...(user === undefined ? {} : { user }),
  };
}

function parseUniqueQueryString(raw: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const pair of raw.split("&")) {
    const separator = pair.indexOf("=");
    if (pair.length === 0 || separator <= 0) {
      throw new TelegramInitDataError("MALFORMED", "Telegram init data is not a valid query string");
    }
    let key: string;
    let value: string;
    try {
      key = decodeQueryComponent(pair.slice(0, separator));
      value = decodeQueryComponent(pair.slice(separator + 1));
    } catch {
      throw new TelegramInitDataError("MALFORMED", "Telegram init data contains invalid percent encoding");
    }
    if (fields.has(key)) {
      throw new TelegramInitDataError("DUPLICATE_KEY", `Telegram init data contains duplicate key: ${key}`);
    }
    fields.set(key, value);
  }
  return fields;
}

function decodeQueryComponent(value: string): string {
  return decodeURIComponent(value.replace(/\+/g, " "));
}

function parseUser(raw: string | undefined): z.infer<typeof telegramUserSchema> | undefined {
  if (raw === undefined) return undefined;
  try {
    return telegramUserSchema.parse(JSON.parse(raw));
  } catch {
    throw new TelegramInitDataError("MALFORMED", "Telegram user data is invalid");
  }
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) throw new TypeError(`${name} must be a non-negative finite number`);
}
