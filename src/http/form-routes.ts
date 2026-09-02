import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { FormSubmissionService } from "../application/form-submission-service.js";
import { sendHttpError } from "./http-utils.js";

const paramsSchema = z.object({ publicId: z.uuid() });
export async function registerFormRoutes(app: FastifyInstance, service: FormSubmissionService): Promise<void> {
  app.post("/v1/public/apps/:publicId/forms", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    try {
      const initData = request.headers["x-telegram-init-data"];
      const requestId = request.headers["x-idempotency-key"];
      if (typeof initData !== "string" || typeof requestId !== "string") return await reply.code(400).send({ error: { code: "MISSING_SECURITY_HEADERS", message: "Telegram session and idempotency key are required" } });
      const result = await service.submit(paramsSchema.parse(request.params).publicId, requestId, initData, request.body);
      return await reply.code(result.duplicate ? 200 : 201).send({ data: result });
    } catch (error) {
      const handled = await sendHttpError(error, reply); if (handled !== null) return handled; throw error;
    }
  });
}
