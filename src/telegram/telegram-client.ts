import { TelegramTokenError, TelegramUpstreamError } from "../domain/errors.js";

export interface TelegramBotIdentity {
  id: string;
  isBot: true;
  firstName: string;
  username?: string;
}

interface TelegramEnvelope<T> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
  parameters?: { retry_after?: number };
}

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

export interface TelegramApi {
  getMe(token: string): Promise<TelegramBotIdentity>;
  setChatMenuButton(token: string, text: string, url: string): Promise<void>;
  clearChatMenuButton?(token: string): Promise<void>;
  setWebhook(token: string, options: TelegramWebhookOptions): Promise<void>;
  sendMessage(token: string, options: TelegramSendMessageOptions): Promise<{ messageId: number }>;
  /** Clears the spinner Telegram shows on a pressed inline button. */
  answerCallbackQuery(token: string, callbackQueryId: string): Promise<void>;
}

export interface TelegramWebhookOptions {
  url: string;
  secretToken: string;
  allowedUpdates?: readonly string[];
  dropPendingUpdates?: boolean;
}

/** One button per row: scenario buttons are labels, not a keyboard layout. */
export type TelegramInlineButton =
  | { text: string; callbackData: string }
  | { text: string; url: string }
  | { text: string; webAppUrl: string };

export interface TelegramSendMessageOptions {
  chatId: string;
  text: string;
  webAppButton?: { text: string; url: string };
  buttons?: readonly TelegramInlineButton[];
}

export class TelegramBotApiClient implements TelegramApi {
  public constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly baseUrl = "https://api.telegram.org",
  ) {}

  public async getMe(token: string): Promise<TelegramBotIdentity> {
    validateTokenShape(token);
    const user = await this.call<TelegramUser>(token, "getMe", {});
    if (!user.is_bot) throw new TelegramTokenError("The supplied token does not belong to a bot");
    return {
      id: String(user.id),
      isBot: true,
      firstName: user.first_name,
      ...(user.username === undefined ? {} : { username: user.username }),
    };
  }

  public async setChatMenuButton(token: string, text: string, url: string): Promise<void> {
    if (text.length === 0 || text.length > 64) throw new TypeError("Menu button text must contain 1 to 64 characters");
    assertHttpsUrl(url, "Mini App URL");
    await this.call<true>(token, "setChatMenuButton", {
      menu_button: { type: "web_app", text, web_app: { url } },
    });
  }

  public async setWebhook(token: string, options: TelegramWebhookOptions): Promise<void> {
    assertHttpsUrl(options.url, "Webhook URL");
    if (!/^[A-Za-z0-9_-]{1,256}$/.test(options.secretToken)) {
      throw new TypeError("Telegram webhook secret has an invalid format");
    }

    await this.call<true>(token, "setWebhook", {
      url: options.url,
      secret_token: options.secretToken,
      allowed_updates: [...(options.allowedUpdates ?? ["message", "callback_query"])],
      drop_pending_updates: options.dropPendingUpdates ?? false,
    });
  }

  public async clearChatMenuButton(token: string): Promise<void> {
    await this.call<true>(token, "setChatMenuButton", { menu_button: { type: "commands" } });
  }

  public async sendMessage(token: string, options: TelegramSendMessageOptions): Promise<{ messageId: number }> {
    if (options.text.length === 0 || options.text.length > 4_096) {
      throw new TypeError("Telegram message text must contain 1 to 4096 characters");
    }
    if (options.webAppButton !== undefined) assertHttpsUrl(options.webAppButton.url, "Mini App URL");

    const rows = [
      ...(options.webAppButton === undefined ? [] : [[{ text: options.webAppButton.text, web_app: { url: options.webAppButton.url } }]]),
      ...(options.buttons ?? []).map((button) => [toInlineButton(button)]),
    ];

    const message = await this.call<{ message_id: number }>(token, "sendMessage", {
      chat_id: options.chatId,
      text: options.text,
      ...(rows.length === 0 ? {} : { reply_markup: { inline_keyboard: rows } }),
    });
    return { messageId: message.message_id };
  }

  public async answerCallbackQuery(token: string, callbackQueryId: string): Promise<void> {
    await this.call(token, "answerCallbackQuery", { callback_query_id: callbackQueryId });
  }

  private async call<T>(token: string, method: string, body: unknown): Promise<T> {
    validateTokenShape(token);
    // Token is intentionally never included in an error or application log.
    const endpoint = `${this.baseUrl}/bot${token}/${method}`;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await this.fetchImpl(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(8_000),
        });
        const payload = (await response.json()) as TelegramEnvelope<T>;

        if (response.status === 401 || response.status === 404) throw new TelegramTokenError();
        if (response.ok && payload.ok && payload.result !== undefined) return payload.result;

        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable || attempt === 1) {
          throw new TelegramUpstreamError(safeTelegramMessage(payload.description));
        }
        await delay(Math.min((payload.parameters?.retry_after ?? 1) * 1_000, 2_000));
      } catch (error) {
        if (error instanceof TelegramTokenError || error instanceof TelegramUpstreamError) throw error;
        if (attempt === 1) break;
      }
    }
    // Fetch errors can embed the requested URL (and therefore the bot token).
    // Do not attach the original error as a cause to an application-visible or
    // loggable exception.
    throw new TelegramUpstreamError("Telegram API request failed");
  }
}

function validateTokenShape(token: string): void {
  // Deliberately permissive about length so future Telegram formats remain valid.
  if (token.length < 20 || token.length > 256 || !/^[0-9]+:[A-Za-z0-9_-]+$/.test(token)) {
    throw new TelegramTokenError("Bot token has an invalid format");
  }
}

function assertHttpsUrl(value: string, label: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(`${label} must be an absolute HTTPS URL`);
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "") {
    throw new TypeError(`${label} must be an absolute HTTPS URL without credentials`);
  }
}

function safeTelegramMessage(description: string | undefined): string {
  return description === undefined ? "Telegram API rejected the request" : description.slice(0, 300);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function toInlineButton(button: TelegramInlineButton): Record<string, unknown> {
  if (button.text.length === 0 || button.text.length > 64) {
    throw new TypeError("Telegram button text must contain 1 to 64 characters");
  }
  if ("webAppUrl" in button) {
    assertHttpsUrl(button.webAppUrl, "Mini App URL");
    return { text: button.text, web_app: { url: button.webAppUrl } };
  }
  if ("url" in button) return { text: button.text, url: button.url };
  // Telegram rejects callback data over 64 bytes, and silently for some clients.
  if (Buffer.byteLength(button.callbackData, "utf8") > 64) {
    throw new TypeError("Telegram callback data must not exceed 64 bytes");
  }
  return { text: button.text, callback_data: button.callbackData };
}
