import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { PaymentProviderError } from "../src/billing/errors.js";
import { YooKassaPaymentProvider } from "../src/billing/yookassa-payment-provider.js";

function responseBody(overrides: Record<string, unknown> = {}) {
  return {
    id: "payment_123",
    status: "pending",
    amount: { value: "350.00", currency: "RUB" },
    metadata: {
      checkout_id: randomUUID(),
      user_id: randomUUID(),
      plan_code: "solo",
    },
    confirmation: { confirmation_url: "https://yookassa.example/confirm/payment_123" },
    ...overrides,
  };
}

describe("YooKassaPaymentProvider", () => {
  it("creates a captured reusable payment with an idempotency key", async () => {
    const checkoutId = randomUUID();
    const userId = randomUUID();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(responseBody({ metadata: { checkout_id: checkoutId, user_id: userId, plan_code: "solo" } })), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const provider = new YooKassaPaymentProvider(
      { shopId: "shop", secretKey: "secret" },
      fetchMock,
      "https://provider.example/v3",
    );

    const payment = await provider.createPayment({
      idempotencyKey: randomUUID(),
      amountMinor: 35_000,
      currency: "RUB",
      description: "Один бот",
      returnUrl: "https://app.example/billing/return",
      metadata: { checkoutId, userId, planCode: "solo" },
    });

    expect(payment).toMatchObject({ id: "payment_123", amountMinor: 35_000, status: "pending" });
    const request = fetchMock.mock.calls[0];
    expect(request?.[0]).toBe("https://provider.example/v3/payments");
    const init = request?.[1];
    const headers = new Headers(init?.headers);
    expect(headers.get("Idempotence-Key")).toMatch(/^[0-9a-f-]{36}$/);
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      amount: { value: "350.00", currency: "RUB" },
      capture: true,
      save_payment_method: true,
      confirmation: { type: "redirect", return_url: "https://app.example/billing/return" },
    });
  });

  it("does not expose credentials or an upstream body in errors", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ description: "secret reflected by upstream" }), { status: 401 }),
    );
    const provider = new YooKassaPaymentProvider({ shopId: "shop", secretKey: "top-secret" }, fetchMock);

    const error = await provider.getPayment("payment_123").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(PaymentProviderError);
    expect(String(error)).not.toContain("top-secret");
    expect(String(error)).not.toContain("reflected");
  });
});

