import { z } from "zod";
import { PaymentProviderError } from "./errors.js";
import type {
  CreateProviderPaymentInput,
  PaymentProvider,
  ProviderPayment,
  ProviderPaymentStatus,
} from "./payment-provider.js";

const responseSchema = z.object({
  id: z.string().min(1).max(128),
  status: z.enum(["pending", "waiting_for_capture", "succeeded", "canceled"]),
  amount: z.object({ value: z.string().regex(/^\d+\.\d{2}$/), currency: z.literal("RUB") }),
  metadata: z.object({
    checkout_id: z.uuid(),
    user_id: z.uuid(),
    plan_code: z.enum(["solo", "trio"]),
  }),
  confirmation: z.object({ confirmation_url: z.url() }).optional(),
  paid_at: z.iso.datetime({ offset: true }).optional(),
  payment_method: z.object({ id: z.string().min(1).max(256) }).optional(),
});

export interface YooKassaCredentials {
  shopId: string;
  secretKey: string;
}

export class YooKassaPaymentProvider implements PaymentProvider {
  public constructor(
    private readonly credentials: YooKassaCredentials,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly baseUrl = "https://api.yookassa.ru/v3",
  ) {
    if (!credentials.shopId.trim() || !credentials.secretKey.trim()) {
      throw new TypeError("YooKassa credentials are required");
    }
  }

  public async createPayment(input: CreateProviderPaymentInput): Promise<ProviderPayment> {
    return this.call("/payments", {
      method: "POST",
      headers: { "Idempotence-Key": input.idempotencyKey },
      body: JSON.stringify({
        amount: { value: minorToRub(input.amountMinor), currency: input.currency },
        capture: true,
        confirmation: { type: "redirect", return_url: input.returnUrl },
        description: input.description.slice(0, 128),
        save_payment_method: true,
        metadata: {
          checkout_id: input.metadata.checkoutId,
          user_id: input.metadata.userId,
          plan_code: input.metadata.planCode,
        },
      }),
    });
  }

  public async getPayment(providerPaymentId: string): Promise<ProviderPayment> {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(providerPaymentId)) {
      throw new PaymentProviderError("Invalid provider payment ID");
    }
    return this.call(`/payments/${encodeURIComponent(providerPaymentId)}`, { method: "GET" });
  }

  private async call(path: string, init: RequestInit): Promise<ProviderPayment> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${this.credentials.shopId}:${this.credentials.secretKey}`).toString("base64")}`,
          ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
          ...init.headers,
        },
        signal: AbortSignal.timeout(8_000),
      });
    } catch (error) {
      throw new PaymentProviderError("YooKassa request failed", { cause: error });
    }

    if (!response.ok) {
      // Do not include provider response text: it may echo request data.
      throw new PaymentProviderError(`YooKassa returned HTTP ${response.status}`);
    }

    try {
      return normalizePayment(responseSchema.parse(await response.json()));
    } catch (error) {
      throw new PaymentProviderError("YooKassa returned an invalid response", { cause: error });
    }
  }
}

function normalizePayment(value: z.infer<typeof responseSchema>): ProviderPayment {
  const status: ProviderPaymentStatus = value.status === "waiting_for_capture" ? "pending" : value.status;
  return {
    id: value.id,
    status,
    amountMinor: rubToMinor(value.amount.value),
    currency: value.amount.currency,
    metadata: {
      checkoutId: value.metadata.checkout_id,
      userId: value.metadata.user_id,
      planCode: value.metadata.plan_code,
    },
    ...(value.confirmation === undefined ? {} : { confirmationUrl: value.confirmation.confirmation_url }),
    ...(value.paid_at === undefined ? {} : { paidAt: new Date(value.paid_at) }),
    ...(value.payment_method === undefined ? {} : { paymentMethodId: value.payment_method.id }),
  };
}

function minorToRub(amountMinor: number): string {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new TypeError("amountMinor must be a positive safe integer");
  }
  return `${Math.floor(amountMinor / 100)}.${String(amountMinor % 100).padStart(2, "0")}`;
}

function rubToMinor(value: string): number {
  const [rublesRaw, kopecksRaw] = value.split(".");
  const rubles = Number(rublesRaw);
  const kopecks = Number(kopecksRaw);
  const amount = rubles * 100 + kopecks;
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Invalid amount");
  return amount;
}

