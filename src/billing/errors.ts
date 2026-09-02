import { DomainError } from "../domain/errors.js";

export class BillingInputError extends DomainError {
  public constructor(message: string) {
    super("INVALID_BILLING_INPUT", message, 422);
  }
}

export class BillingConflictError extends DomainError {
  public constructor(message: string) {
    super("BILLING_CONFLICT", message, 409);
  }
}

export class PaymentProviderError extends DomainError {
  public constructor(message = "Payment provider is temporarily unavailable", options?: ErrorOptions) {
    super("PAYMENT_PROVIDER_ERROR", message, 502, options);
  }
}

export class EntitlementError extends DomainError {
  public constructor(message: string) {
    super("PLAN_LIMIT_REACHED", message, 402);
  }
}

