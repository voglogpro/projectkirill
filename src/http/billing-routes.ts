import type { FastifyInstance } from "fastify";
import type { AccessTokenService } from "../auth/tokens.js";
import type { BillingService } from "../billing/billing-service.js";
import { BILLING_PLANS } from "../billing/plans.js";
import { requireAccess, sendHttpError } from "./http-utils.js";

export async function registerBillingRoutes(app: FastifyInstance, service: BillingService, accessTokens: AccessTokenService): Promise<void> {
  app.get("/v1/billing/plans", async () => ({
    data: Object.values(BILLING_PLANS).map((plan) => ({ code: plan.code, name: plan.name, monthlyPriceMinor: plan.monthlyPriceMinor, currency: plan.currency, maxProjects: plan.maxProjects, maxActiveBots: plan.maxActiveBots })),
  }));

  app.get("/v1/billing/entitlement", async (request, reply) => {
    try {
      const claims = requireAccess(request, accessTokens);
      return await reply.send({ data: await service.getEntitlement(claims.sub) });
    } catch (error) {
      const handled = await sendHttpError(error, reply);
      if (handled !== null) return handled;
      throw error;
    }
  });

  app.post("/v1/billing/checkouts", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    try {
      const claims = requireAccess(request, accessTokens);
      return await reply.code(201).send({ data: await service.createCheckout(claims.sub, request.body) });
    } catch (error) {
      const handled = await sendHttpError(error, reply);
      if (handled !== null) return handled;
      throw error;
    }
  });

  // The payload is never trusted: BillingService re-fetches the payment from
  // YooKassa with server credentials before changing subscription state.
  app.post("/v1/billing/webhooks/yookassa", async (request, reply) => {
    try {
      await service.handleWebhook(request.body);
      return await reply.code(200).send({ accepted: true });
    } catch (error) {
      const handled = await sendHttpError(error, reply);
      if (handled !== null) return handled;
      throw error;
    }
  });
}
