import { randomUUID } from "node:crypto";
import { PaymentProviderError } from "./errors.js";
import type {
  CreateProviderPaymentInput,
  PaymentProvider,
  ProviderPayment,
  ProviderPaymentStatus,
} from "./payment-provider.js";

/** Deterministic in-memory provider for local development and unit tests only. */
export class MockPaymentProvider implements PaymentProvider {
  private readonly payments = new Map<string, ProviderPayment>();
  private readonly paymentsByIdempotencyKey = new Map<string, string>();

  public async createPayment(input: CreateProviderPaymentInput): Promise<ProviderPayment> {
    const existingId = this.paymentsByIdempotencyKey.get(input.idempotencyKey);
    if (existingId !== undefined) return this.requirePayment(existingId);

    const id = `mock_${randomUUID()}`;
    const payment: ProviderPayment = {
      id,
      status: "succeeded",
      amountMinor: input.amountMinor,
      currency: input.currency,
      metadata: { ...input.metadata },
      paidAt: new Date(),
      paymentMethodId: `mock_method_${id}`,
    };
    this.payments.set(id, payment);
    this.paymentsByIdempotencyKey.set(input.idempotencyKey, id);
    return clonePayment(payment);
  }

  public async getPayment(providerPaymentId: string): Promise<ProviderPayment> {
    return this.requirePayment(providerPaymentId);
  }

  public setStatus(providerPaymentId: string, status: ProviderPaymentStatus, paidAt = new Date()): void {
    const current = this.payments.get(providerPaymentId);
    if (current === undefined) throw new PaymentProviderError("Mock payment not found");
    this.payments.set(providerPaymentId, {
      ...current,
      status,
      ...(status === "succeeded" ? { paidAt, paymentMethodId: `mock_method_${providerPaymentId}` } : {}),
    });
  }

  private requirePayment(id: string): ProviderPayment {
    const payment = this.payments.get(id);
    if (payment === undefined) throw new PaymentProviderError("Mock payment not found");
    return clonePayment(payment);
  }
}

function clonePayment(payment: ProviderPayment): ProviderPayment {
  return {
    ...payment,
    metadata: { ...payment.metadata },
    ...(payment.paidAt === undefined ? {} : { paidAt: new Date(payment.paidAt) }),
  };
}
