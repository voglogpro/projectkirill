import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { PostgresBotFlowRepository } from "../db/postgres-bot-flow-repository.js";
import type { AccessTokenService } from "../auth/tokens.js";
import { botFlowDocumentSchema, createEmptyBotFlow } from "../domain/bot-flow.js";
import { requireAccess, sendHttpError } from "./http-utils.js";
import type { CoreEntitlementGate } from "../application/core-service.js";

const params = z.object({ projectId: z.uuid() });
const saveBody = z.object({ expectedRevision: z.number().int().positive(), document: botFlowDocumentSchema }).strict();

export async function registerBotFlowRoutes(
  app: FastifyInstance,
  flows: PostgresBotFlowRepository,
  accessTokens: AccessTokenService,
  entitlements?: CoreEntitlementGate,
): Promise<void> {
  app.get("/v1/projects/:projectId/flow", async (request, reply) => {
    try {
      const claims = requireAccess(request, accessTokens);
      const { projectId } = params.parse(request.params);
      const draft = await flows.getDraft(claims.sub, projectId, createEmptyBotFlow("Мой бот"));
      return await reply.send({ data: draft });
    } catch (error) {
      const handled = await sendHttpError(error, reply);
      if (handled !== null) return handled;
      throw error;
    }
  });

  app.put("/v1/projects/:projectId/flow", async (request, reply) => {
    try {
      const claims = requireAccess(request, accessTokens);
      const { projectId } = params.parse(request.params);
      const input = saveBody.parse(request.body);
      const draft = await flows.saveDraft(claims.sub, projectId, input.document, input.expectedRevision);
      return await reply.send({ data: draft });
    } catch (error) {
      const handled = await sendHttpError(error, reply);
      if (handled !== null) return handled;
      throw error;
    }
  });

  app.post("/v1/projects/:projectId/flow/publish", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    try {
      const claims = requireAccess(request, accessTokens);
      const { projectId } = params.parse(request.params);
      await entitlements?.assertCanPublish(claims.sub, projectId);
      return await reply.send({ data: await flows.publish(claims.sub, projectId) });
    } catch (error) {
      const handled = await sendHttpError(error, reply);
      if (handled !== null) return handled;
      throw error;
    }
  });
}
