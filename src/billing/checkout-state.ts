import { BillingConflictError } from "./errors.js";
import type { ProviderPaymentStatus } from "./payment-provider.js";

export type CheckoutStatus = "creating" | "pending" | "succeeded" | "canceled" | "failed";

/**
 * Provider state is fetched from the provider API before this transition is used.
 * Terminal local states never regress when delayed/replayed webhooks arrive.
 */
export function transitionCheckout(
  current: CheckoutStatus,
  verifiedProviderStatus: ProviderPaymentStatus,
): CheckoutStatus {
  if (current === "succeeded" || current === "canceled") return current;
  if (current === "failed") {
    throw new BillingConflictError("A failed checkout cannot be reconciled");
  }
  if (verifiedProviderStatus === "succeeded") return "succeeded";
  if (verifiedProviderStatus === "canceled") return "canceled";
  return "pending";
}

