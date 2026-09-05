import { z } from "zod";
import { BillingConflictError, BillingInputError } from "./errors.js";
import type { BillingCheckout, BillingRepository } from "./billing-repository.js";
import type { PaymentProvider, ProviderPayment } from "./payment-provider.js";
import { BILLING_PLANS, getBillingPlan, type PaidBillingPlanCode } from "./plans.js";
import { resolveEntitlement, type Entitlement } from "./entitlements.js";

const createCheckoutSchema = z
  .object({
    planCode: z.enum(["solo", "trio", "studio"]),
    clientRequestId: z.uuid(),
  })
  .strict();

const webhookSchema = z
  .object({
    type: z.literal("notification"),
    event: z.string().min(1).max(100),
    object: z.object({ id: z.string().min(1).max(128) }).passthrough(),
  })
  .passthrough();

export interface CheckoutResult {
  checkoutId: string;
  status: BillingCheckout["status"];
  confirmationUrl?: string;
}

export class BillingService {
  public constructor(
    private readonly repository: BillingRepository,
    private readonly provider: PaymentProvider,
    private readonly publicConsoleOrigin: URL,
  ) {
    if (publicConsoleOrigin.protocol !== "https:") {
      throw new TypeError("publicConsoleOrigin must use HTTPS");
    }
  }

  public async getEntitlement(userId: string): Promise<Entitlement> {
    return resolveEntitlement(await this.repository.getPaidSubscription(userId));
  }

  public async createCheckout(userId: string, untrustedInput: unknown): Promise<CheckoutResult> {
    const input = createCheckoutSchema.parse(untrustedInput);
    const plan = getBillingPlan(input.planCode);
    const reservation = await this.repository.getOrCreateCheckout({
      userId,
      planCode: input.planCode,
      amountMinor: plan.monthlyPriceMinor,
      currency: plan.currency,
      clientRequestId: input.clientRequestId,
    });

    if (!reservation.created && reservation.checkout.status !== "creating") {
      return existingCheckoutResult(reservation.checkout);
    }

    let payment: ProviderPayment;
    try {
      payment = await this.provider.createPayment({
        idempotencyKey: reservation.checkout.idempotencyKey,
        amountMinor: plan.monthlyPriceMinor,
        currency: plan.currency,
        description: `${plan.name} — доступ на 1 месяц`,
        // The redirect target is derived server-side to prevent an authenticated
        // user from turning checkout into an open redirect.
        returnUrl: new URL(
          `/billing/return?checkout=${encodeURIComponent(reservation.checkout.id)}`,
          this.publicConsoleOrigin,
        ).toString(),
        metadata: {
          checkoutId: reservation.checkout.id,
          userId,
          planCode: input.planCode,
        },
      });
      validatePaymentMatchesCheckout(payment, reservation.checkout);
    } catch (error) {
      // A network timeout is ambiguous: YooKassa may have created the payment.
      // Keep the checkout resumable with the same idempotency key in that case.
      if (error instanceof BillingInputError) {
        try {
          await this.repository.markCheckoutFailed(reservation.checkout.id, publicFailureReason(error));
        } catch {
          // The original validation failure remains the useful error.
        }
      }
      throw error;
    }

    let checkout = await this.repository.attachProviderPayment({
      checkoutId: reservation.checkout.id,
      providerPaymentId: payment.id,
      ...(payment.confirmationUrl === undefined ? {} : { confirmationUrl: payment.confirmationUrl }),
    });
    // Some payment methods can complete or cancel before createPayment returns.
    if (payment.status !== "pending") {
      checkout = await this.repository.applyVerifiedPayment(checkout, payment);
    }
    return toCheckoutResult(checkout);
  }

  /**
   * Webhook fields other than the provider object ID are deliberately ignored.
   * Authoritative status, amount and metadata are always re-fetched over the
   * authenticated provider API before local state changes.
   */
  public async handleWebhook(untrustedPayload: unknown): Promise<CheckoutResult | null> {
    const notification = webhookSchema.parse(untrustedPayload);
    const payment = await this.provider.getPayment(notification.object.id);
    if (payment.id !== notification.object.id) {
      throw new BillingInputError("Payment provider returned a different payment ID");
    }

    const checkout = await this.repository.findCheckoutByProviderPaymentId(payment.id);
    if (checkout === null) return null;
    validatePaymentMatchesCheckout(payment, checkout);
    return toCheckoutResult(await this.repository.applyVerifiedPayment(checkout, payment));
  }
}

function existingCheckoutResult(checkout: BillingCheckout): CheckoutResult {
  if (checkout.status === "creating") {
    throw new BillingConflictError("Checkout is already being created; retry shortly");
  }
  if (checkout.status === "failed") {
    throw new BillingConflictError("This checkout attempt failed; use a new request ID");
  }
  return toCheckoutResult(checkout);
}

function toCheckoutResult(checkout: BillingCheckout): CheckoutResult {
  return {
    checkoutId: checkout.id,
    status: checkout.status,
    ...(checkout.confirmationUrl === undefined ? {} : { confirmationUrl: checkout.confirmationUrl }),
  };
}

function validatePaymentMatchesCheckout(payment: ProviderPayment, checkout: BillingCheckout): void {
  if (
    payment.metadata.checkoutId !== checkout.id ||
    payment.metadata.userId !== checkout.userId ||
    payment.metadata.planCode !== checkout.planCode ||
    payment.amountMinor !== checkout.amountMinor ||
    payment.currency !== checkout.currency
  ) {
    throw new BillingInputError("Verified payment does not match the checkout");
  }
}

function publicFailureReason(error: unknown): string {
  // Provider errors can contain credentials or request bodies; persist only a class name.
  return error instanceof Error ? error.name.slice(0, 100) : "UnknownError";
}

export const PAID_PLAN_CODES = Object.freeze(
  Object.keys(BILLING_PLANS).filter((code): code is PaidBillingPlanCode => code !== "free"),
);
