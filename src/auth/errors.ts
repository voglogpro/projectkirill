import { DomainError } from "../domain/errors.js";

export class AuthenticationError extends DomainError {
  public constructor(message = "Invalid credentials") {
    super("AUTHENTICATION_FAILED", message, 401);
  }
}

export class RefreshReuseError extends DomainError {
  public constructor() {
    super("REFRESH_TOKEN_REUSE", "The session has been revoked", 401);
  }
}
