import type { Sql } from "postgres";
import type { BillingCheckout, BillingRepository } from "./billing-repository.js";
import { transitionCheckout, type CheckoutStatus } from "./checkout-state.js";
import type { PaidSubscriptionSnapshot } from "./entitlements.js";
import { BillingConflictError } from "./errors.js";
import type { ProviderPayment } from "./payment-provider.js";
import type { PaidBillingPlanCode } from "./plans.js";

interface CheckoutRow {
  id: string;
  user_id: string;
  plan_code: PaidBillingPlanCode;
  amount_minor: string;
  currency: "RUB";
  status: CheckoutStatus;
  idempotency_key: string;
  provider_payment_id: string | null;
  confirmation_url: string | null;
}

export class PostgresBillingRepository implements BillingRepository {
  public constructor(private readonly sql: Sql) {}

  public async getOrCreateCheckout(input: {
    userId: string;
    planCode: PaidBillingPlanCode;
    amountMinor: number;
    currency: "RUB";
    clientRequestId: string;
  }): Promise<{ checkout: BillingCheckout; created: boolean }> {
    const inserted = await this.sql<CheckoutRow[]>`
      INSERT INTO billing_checkouts (
        user_id, plan_code, amount_minor, currency, client_request_id
      ) VALUES (
        ${input.userId}, ${input.planCode}, ${input.amountMinor},
        ${input.currency}, ${input.clientRequestId}
      )
      ON CONFLICT (user_id, client_request_id) DO NOTHING
      RETURNING id, user_id, plan_code, amount_minor, currency, status,
                idempotency_key, provider_payment_id, confirmation_url
    `;
    const insertedRow = inserted[0];
    if (insertedRow !== undefined) return { checkout: mapCheckout(insertedRow), created: true };

    const existing = await this.sql<CheckoutRow[]>`
      SELECT id, user_id, plan_code, amount_minor, currency, status,
             idempotency_key, provider_payment_id, confirmation_url
      FROM billing_checkouts
      WHERE user_id = ${input.userId} AND client_request_id = ${input.clientRequestId}
      LIMIT 1
    `;
    const row = existing[0];
    if (row === undefined) throw new BillingConflictError("Checkout reservation was lost");
    if (
      row.plan_code !== input.planCode ||
      Number(row.amount_minor) !== input.amountMinor ||
      row.currency !== input.currency
    ) {
      throw new BillingConflictError("The request ID is already used for a different checkout");
    }
    return { checkout: mapCheckout(row), created: false };
  }

  public async attachProviderPayment(input: {
    checkoutId: string;
    providerPaymentId: string;
    confirmationUrl?: string;
  }): Promise<BillingCheckout> {
    return this.sql.begin(async (transaction) => {
      const rows = await transaction<CheckoutRow[]>`
        UPDATE billing_checkouts
        SET provider_payment_id = ${input.providerPaymentId},
            confirmation_url = ${input.confirmationUrl ?? null},
            status = 'pending',
            updated_at = now()
        WHERE id = ${input.checkoutId} AND status = 'creating'
        RETURNING id, user_id, plan_code, amount_minor, currency, status,
                  idempotency_key, provider_payment_id, confirmation_url
      `;
      let row = rows[0];
      if (row === undefined) {
        const existing = await transaction<CheckoutRow[]>`
          SELECT id, user_id, plan_code, amount_minor, currency, status,
                 idempotency_key, provider_payment_id, confirmation_url
          FROM billing_checkouts
          WHERE id = ${input.checkoutId}
          LIMIT 1
        `;
        row = existing[0];
        if (row === undefined || row.provider_payment_id !== input.providerPaymentId) {
          throw new BillingConflictError("Checkout is no longer attachable");
        }
      }

      await transaction`
        INSERT INTO billing_payments (
          checkout_id, provider_payment_id, status, amount_minor, currency
        ) VALUES (
          ${row.id}, ${input.providerPaymentId}, 'pending', ${row.amount_minor}, ${row.currency}
        )
        ON CONFLICT (provider_payment_id) DO NOTHING
      `;
      return mapCheckout(row);
    });
  }

  public async markCheckoutFailed(checkoutId: string, publicReason: string): Promise<void> {
    await this.sql`
      UPDATE billing_checkouts
      SET status = 'failed', failure_reason = ${publicReason.slice(0, 100)}, updated_at = now()
      WHERE id = ${checkoutId} AND status = 'creating'
    `;
  }

  public async findCheckoutByProviderPaymentId(providerPaymentId: string): Promise<BillingCheckout | null> {
    const rows = await this.sql<CheckoutRow[]>`
      SELECT id, user_id, plan_code, amount_minor, currency, status,
             idempotency_key, provider_payment_id, confirmation_url
      FROM billing_checkouts
      WHERE provider_payment_id = ${providerPaymentId}
      LIMIT 1
    `;
    const row = rows[0];
    return row === undefined ? null : mapCheckout(row);
  }

  public async applyVerifiedPayment(checkout: BillingCheckout, payment: ProviderPayment): Promise<BillingCheckout> {
    return this.sql.begin(async (transaction) => {
      const locked = await transaction<CheckoutRow[]>`
        SELECT id, user_id, plan_code, amount_minor, currency, status,
               idempotency_key, provider_payment_id, confirmation_url
        FROM billing_checkouts
        WHERE id = ${checkout.id}
        FOR UPDATE
      `;
      const row = locked[0];
      if (row === undefined || row.provider_payment_id !== payment.id) {
        throw new BillingConflictError("Payment is not attached to this checkout");
      }

      const nextStatus = transitionCheckout(row.status, payment.status);
      const firstSuccess = nextStatus === "succeeded" && row.status !== "succeeded";
      await transaction`
        UPDATE billing_checkouts
        SET status = ${nextStatus},
            provider_status = ${payment.status},
            paid_at = CASE
              WHEN ${firstSuccess} THEN ${payment.paidAt ?? new Date()}
              ELSE paid_at
            END,
            updated_at = now()
        WHERE id = ${row.id}
      `;
      await transaction`
        UPDATE billing_payments
        SET status = ${nextStatus},
            paid_at = CASE
              WHEN ${firstSuccess} THEN ${payment.paidAt ?? new Date()}
              ELSE paid_at
            END,
            provider_payment_method_id = COALESCE(
              ${payment.paymentMethodId ?? null}, provider_payment_method_id
            ),
            updated_at = now()
        WHERE provider_payment_id = ${payment.id}
      `;

      if (firstSuccess) {
        const paidAt = payment.paidAt ?? new Date();
        await transaction`
          INSERT INTO billing_subscriptions (
            user_id, plan_code, status, current_period_start, current_period_end,
            provider_payment_method_id
          ) VALUES (
            ${row.user_id}, ${row.plan_code}, 'active', ${paidAt},
            ${paidAt}::timestamptz + interval '1 month', ${payment.paymentMethodId ?? null}
          )
          ON CONFLICT (user_id) DO UPDATE SET
            plan_code = EXCLUDED.plan_code,
            status = 'active',
            current_period_start = CASE
              WHEN billing_subscriptions.plan_code = EXCLUDED.plan_code
                AND billing_subscriptions.current_period_end > EXCLUDED.current_period_start
              THEN billing_subscriptions.current_period_start
              ELSE EXCLUDED.current_period_start
            END,
            current_period_end = CASE
              WHEN billing_subscriptions.plan_code = EXCLUDED.plan_code
                AND billing_subscriptions.current_period_end > EXCLUDED.current_period_start
              THEN billing_subscriptions.current_period_end + interval '1 month'
              ELSE EXCLUDED.current_period_end
            END,
            provider_payment_method_id = COALESCE(
              EXCLUDED.provider_payment_method_id,
              billing_subscriptions.provider_payment_method_id
            ),
            updated_at = now()
        `;
      }

      return {
        ...mapCheckout(row),
        status: nextStatus,
      };
    });
  }

  public async getPaidSubscription(userId: string): Promise<PaidSubscriptionSnapshot | null> {
    const rows = await this.sql<{
      plan_code: PaidBillingPlanCode;
      status: "active" | "past_due" | "canceled";
      current_period_end: Date;
    }[]>`
      SELECT plan_code, status, current_period_end
      FROM billing_subscriptions
      WHERE user_id = ${userId}
      LIMIT 1
    `;
    const row = rows[0];
    return row === undefined
      ? null
      : { planCode: row.plan_code, status: row.status, currentPeriodEnd: row.current_period_end };
  }
}

function mapCheckout(row: CheckoutRow): BillingCheckout {
  const amountMinor = Number(row.amount_minor);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error("Invalid billing amount stored in database");
  }
  return {
    id: row.id,
    userId: row.user_id,
    planCode: row.plan_code,
    amountMinor,
    currency: row.currency,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    ...(row.provider_payment_id === null ? {} : { providerPaymentId: row.provider_payment_id }),
    ...(row.confirmation_url === null ? {} : { confirmationUrl: row.confirmation_url }),
  };
}
