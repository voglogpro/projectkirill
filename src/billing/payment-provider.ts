import type { PaidBillingPlanCode } from "./plans.js";

export type ProviderPaymentStatus = "pending" | "succeeded" | "canceled";

export interface ProviderPayment {
  id: string;
  status: ProviderPaymentStatus;
  amountMinor: number;
  currency: "RUB";
  metadata: {
    checkoutId: string;
    userId: string;
    planCode: PaidBillingPlanCode;
  };
  confirmationUrl?: string;
  paidAt?: Date;
  paymentMethodId?: string;
}

export interface CreateProviderPaymentInput {
  idempotencyKey: string;
  amountMinor: number;
  currency: "RUB";
  description: string;
  returnUrl: string;
  metadata: ProviderPayment["metadata"];
}

/** Provider-neutral boundary. Production and tests must depend on this interface. */
export interface PaymentProvider {
  createPayment(input: CreateProviderPaymentInput): Promise<ProviderPayment>;
  getPayment(providerPaymentId: string): Promise<ProviderPayment>;
}

