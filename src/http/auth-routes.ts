import type { FastifyInstance } from "fastify";
import type { AuthService } from "../application/auth-service.js";
import { bearerToken, sendHttpError, sessionContext } from "./http-utils.js";

export async function registerAuthRoutes(app: FastifyInstance, service: AuthService): Promise<void> {
  app.post("/v1/auth/register", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    try {
      return await reply.code(201).send({ data: await service.register(request.body, sessionContext(request)) });
    } catch (error) {
      const handled = await sendHttpError(error, reply);
      if (handled !== null) return handled;
      throw error;
    }
  });

  app.post("/v1/auth/login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    try {
      return await reply.send({ data: await service.login(request.body, sessionContext(request)) });
    } catch (error) {
      const handled = await sendHttpError(error, reply);
      if (handled !== null) return handled;
      throw error;
    }
  });

  app.post("/v1/auth/refresh", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    try {
      return await reply.send({ data: await service.refresh(request.body, sessionContext(request)) });
    } catch (error) {
      const handled = await sendHttpError(error, reply);
      if (handled !== null) return handled;
      throw error;
    }
  });

  app.post("/v1/auth/logout", async (request, reply) => {
    try {
      await service.logout(bearerToken(request));
      return await reply.code(204).send();
    } catch (error) {
      const handled = await sendHttpError(error, reply);
      if (handled !== null) return handled;
      throw error;
    }
  });
}
