import type { CheckoutStatus } from "./checkout-state.js";
import type { PaidSubscriptionSnapshot } from "./entitlements.js";
import type { ProviderPayment } from "./payment-provider.js";
import type { PaidBillingPlanCode } from "./plans.js";

export interface BillingCheckout {
  id: string;
  userId: string;
  planCode: PaidBillingPlanCode;
  amountMinor: number;
  currency: "RUB";
  status: CheckoutStatus;
  idempotencyKey: string;
  providerPaymentId?: string;
  confirmationUrl?: string;
}

export interface BillingRepository {
  getOrCreateCheckout(input: {
    userId: string;
    planCode: PaidBillingPlanCode;
    amountMinor: number;
    currency: "RUB";
    clientRequestId: string;
  }): Promise<{ checkout: BillingCheckout; created: boolean }>;

  attachProviderPayment(input: {
    checkoutId: string;
    providerPaymentId: string;
    confirmationUrl?: string;
  }): Promise<BillingCheckout>;

  markCheckoutFailed(checkoutId: string, publicReason: string): Promise<void>;
  findCheckoutByProviderPaymentId(providerPaymentId: string): Promise<BillingCheckout | null>;
  applyVerifiedPayment(checkout: BillingCheckout, payment: ProviderPayment): Promise<BillingCheckout>;
  getPaidSubscription(userId: string): Promise<PaidSubscriptionSnapshot | null>;
}

