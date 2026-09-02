export class DomainError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  public constructor(message = "Resource not found") {
    super("NOT_FOUND", message, 404);
  }
}

export class ConflictError extends DomainError {
  public constructor(message: string) {
    super("CONFLICT", message, 409);
  }
}

export class TelegramTokenError extends DomainError {
  public constructor(message = "Telegram rejected the bot token") {
    super("INVALID_BOT_TOKEN", message, 422);
  }
}

export class TelegramUpstreamError extends DomainError {
  public constructor(message = "Telegram API is temporarily unavailable", options?: ErrorOptions) {
    super("TELEGRAM_UPSTREAM_ERROR", message, 502, options);
  }
}
