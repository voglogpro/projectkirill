import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import type { ConnectBotService } from "../application/connect-bot.js";
import type { AccessTokenService } from "../auth/tokens.js";
import { DomainError } from "../domain/errors.js";
import { requireAccess, sendHttpError } from "./http-utils.js";

export async function registerBotRoutes(app: FastifyInstance, service: ConnectBotService, accessTokens: AccessTokenService): Promise<void> {
  app.get("/v1/bot-connections/:projectId", async (request, reply) => {
    try { const claims = requireAccess(request, accessTokens); return await reply.send({ data: await service.getStatus(claims.sub, z.object({ projectId: z.uuid() }).parse(request.params).projectId) }); }
    catch (error) { if (error instanceof ZodError) return await reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "Request validation failed" } }); const handled = await sendHttpError(error, reply); if (handled !== null) return handled; throw error; }
  });
  app.post("/v1/bot-connections/validate", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    try {
      const result = await service.validate(requireAccess(request, accessTokens).sub, request.body);
      return await reply.code(200).send({ data: result });
    } catch (error) {
      if (error instanceof ZodError) return await reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "Request validation failed", details: error.issues } });
      if (error instanceof DomainError) return await reply.code(error.httpStatus).send({ error: { code: error.code, message: error.message } });
      throw error;
    }
  });

  app.post(
    "/v1/bot-connections",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      try {
        const result = await service.execute(requireAccess(request, accessTokens).sub, request.body);
        return await reply.code(200).send({ data: result });
      } catch (error) {
        if (error instanceof ZodError) {
          return await reply.code(400).send({
            error: { code: "VALIDATION_ERROR", message: "Request validation failed", details: error.issues },
          });
        }
        if (error instanceof DomainError) {
          return await reply.code(error.httpStatus).send({ error: { code: error.code, message: error.message } });
        }
        request.log.error({ err: error }, "Bot connection failed");
        throw error;
      }
    },
  );
}
