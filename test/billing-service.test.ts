import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { BillingCheckout, BillingRepository } from "../src/billing/billing-repository.js";
import { BillingService } from "../src/billing/billing-service.js";
import { transitionCheckout } from "../src/billing/checkout-state.js";
import type { PaidSubscriptionSnapshot } from "../src/billing/entitlements.js";
import { BillingInputError } from "../src/billing/errors.js";
import type { PaymentProvider, ProviderPayment } from "../src/billing/payment-provider.js";

class MemoryBillingRepository implements BillingRepository {
  public readonly checkouts = new Map<string, BillingCheckout>();
  public readonly requests = new Map<string, string>();
  public subscription: PaidSubscriptionSnapshot | null = null;
  public activationCount = 0;

  public async getOrCreateCheckout(input: {
    userId: string;
    planCode: "solo" | "trio";
    amountMinor: number;
    currency: "RUB";
    clientRequestId: string;
  }): Promise<{ checkout: BillingCheckout; created: boolean }> {
    const key = `${input.userId}:${input.clientRequestId}`;
    const existingId = this.requests.get(key);
    if (existingId !== undefined) return { checkout: this.require(existingId), created: false };
    const checkout: BillingCheckout = {
      id: randomUUID(),
      userId: input.userId,
      planCode: input.planCode,
      amountMinor: input.amountMinor,
      currency: input.currency,
      status: "creating",
      idempotencyKey: randomUUID(),
    };
    this.checkouts.set(checkout.id, checkout);
    this.requests.set(key, checkout.id);
    return { checkout: { ...checkout }, created: true };
  }

  public async attachProviderPayment(input: {
    checkoutId: string;
    providerPaymentId: string;
    confirmationUrl?: string;
  }): Promise<BillingCheckout> {
    const next: BillingCheckout = {
      ...this.require(input.checkoutId),
      status: "pending",
      providerPaymentId: input.providerPaymentId,
      ...(input.confirmationUrl === undefined ? {} : { confirmationUrl: input.confirmationUrl }),
    };
    this.checkouts.set(next.id, next);
    return { ...next };
  }

  public async markCheckoutFailed(checkoutId: string): Promise<void> {
    const checkout = this.require(checkoutId);
    this.checkouts.set(checkoutId, { ...checkout, status: "failed" });
  }

  public async findCheckoutByProviderPaymentId(providerPaymentId: string): Promise<BillingCheckout | null> {
    return [...this.checkouts.values()].find((item) => item.providerPaymentId === providerPaymentId) ?? null;
  }

  public async applyVerifiedPayment(checkout: BillingCheckout, payment: ProviderPayment): Promise<BillingCheckout> {
    const current = this.require(checkout.id);
    const status = transitionCheckout(current.status, payment.status);
    if (status === "succeeded" && current.status !== "succeeded") {
      this.activationCount += 1;
      const paidAt = payment.paidAt ?? new Date();
      this.subscription = {
        planCode: current.planCode,
        status: "active",
        currentPeriodEnd: new Date(paidAt.getTime() + 30 * 86_400_000),
      };
    }
    const next = { ...current, status };
    this.checkouts.set(next.id, next);
    return { ...next };
  }

  public async getPaidSubscription(): Promise<PaidSubscriptionSnapshot | null> {
    return this.subscription;
  }

  private require(id: string): BillingCheckout {
    const checkout = this.checkouts.get(id);
    if (checkout === undefined) throw new Error("missing checkout");
    return { ...checkout };
  }
}

function fixture() {
  const repository = new MemoryBillingRepository();
  const payments = new Map<string, ProviderPayment>();
  const provider: PaymentProvider = {
    createPayment: vi.fn(async (input) => {
      const payment: ProviderPayment = {
        id: `payment_${randomUUID()}`,
        status: "pending",
        amountMinor: input.amountMinor,
        currency: input.currency,
        metadata: { ...input.metadata },
        confirmationUrl: "https://payments.example/confirm",
      };
      payments.set(payment.id, payment);
      return payment;
    }),
    getPayment: vi.fn(async (id) => {
      const payment = payments.get(id);
      if (payment === undefined) throw new Error("missing payment");
      return { ...payment, metadata: { ...payment.metadata } };
    }),
  };
  return {
    repository,
    payments,
    provider,
    service: new BillingService(repository, provider, new URL("https://app.example")),
  };
}

describe("BillingService", () => {
  it("returns free or paid server-side entitlements", async () => {
    const { service, repository } = fixture();
    await expect(service.getEntitlement(randomUUID())).resolves.toMatchObject({
      planCode: "free", maxProjects: 1, maxActiveBots: 0, canPublish: false,
    });
    repository.subscription = { planCode: "solo", status: "active", currentPeriodEnd: new Date(Date.now() + 86_400_000) };
    await expect(service.getEntitlement(randomUUID())).resolves.toMatchObject({
      planCode: "solo", maxProjects: 1, maxActiveBots: 1, canPublish: true,
    });
  });

  it("creates a checkout using the server-side plan price and is idempotent", async () => {
    const { service, provider } = fixture();
    const userId = randomUUID();
    const clientRequestId = randomUUID();
    const input = { planCode: "solo", clientRequestId };

    const first = await service.createCheckout(userId, input);
    const second = await service.createCheckout(userId, input);

    expect(first).toEqual(second);
    expect(provider.createPayment).toHaveBeenCalledOnce();
    expect(vi.mocked(provider.createPayment).mock.calls[0]?.[0]).toMatchObject({
      amountMinor: 35_000,
      returnUrl: `https://app.example/billing/return?checkout=${first.checkoutId}`,
    });
  });

  it("ignores claimed webhook status and activates only after provider refetch", async () => {
    const { service, provider, payments, repository } = fixture();
    const userId = randomUUID();
    const created = await service.createCheckout(userId, {
      planCode: "trio",
      clientRequestId: randomUUID(),
    });
    const checkout = repository.checkouts.get(created.checkoutId);
    const paymentId = checkout?.providerPaymentId;
    if (paymentId === undefined) throw new Error("missing payment ID");

    const stillPending = await service.handleWebhook({
      type: "notification",
      event: "payment.succeeded",
      object: { id: paymentId, status: "succeeded" },
    });
    expect(stillPending?.status).toBe("pending");
    expect(repository.subscription).toBeNull();

    const payment = payments.get(paymentId);
    if (payment === undefined) throw new Error("missing payment");
    payments.set(paymentId, { ...payment, status: "succeeded", paidAt: new Date("2026-09-02T12:00:00Z") });
    await service.handleWebhook({ type: "notification", event: "anything", object: { id: paymentId } });
    await service.handleWebhook({ type: "notification", event: "replay", object: { id: paymentId } });

    expect(provider.getPayment).toHaveBeenCalledTimes(3);
    expect(repository.subscription?.planCode).toBe("trio");
    expect(repository.activationCount).toBe(1);
  });

  it("rejects a provider payment with a mismatched amount", async () => {
    const { service, payments, repository } = fixture();
    const created = await service.createCheckout(randomUUID(), {
      planCode: "solo",
      clientRequestId: randomUUID(),
    });
    const checkout = repository.checkouts.get(created.checkoutId);
    const paymentId = checkout?.providerPaymentId;
    if (paymentId === undefined) throw new Error("missing payment ID");
    const payment = payments.get(paymentId);
    if (payment === undefined) throw new Error("missing payment");
    payments.set(paymentId, { ...payment, status: "succeeded", amountMinor: 1 });

    await expect(
      service.handleWebhook({ type: "notification", event: "payment.succeeded", object: { id: paymentId } }),
    ).rejects.toBeInstanceOf(BillingInputError);
    expect(repository.subscription).toBeNull();
  });
});
