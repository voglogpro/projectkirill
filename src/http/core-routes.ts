import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { CoreService } from "../application/core-service.js";
import type { AccessTokenService } from "../auth/tokens.js";
import { requireAccess, sendHttpError } from "./http-utils.js";

const projectParams = z.object({ projectId: z.uuid() });
const pageParams = z.object({ projectId: z.uuid(), pageId: z.uuid() });
const publicParams = z.object({ publicId: z.uuid() });
const previewParams = z.object({ token: z.string().min(32).max(256) });

export async function registerCoreRoutes(app: FastifyInstance, service: CoreService, accessTokens: AccessTokenService): Promise<void> {
  const route = async <T>(operation: () => Promise<T>, reply: Parameters<typeof sendHttpError>[1], successCode = 200) => {
    try {
      return await reply.code(successCode).send({ data: await operation() });
    } catch (error) {
      const handled = await sendHttpError(error, reply);
      if (handled !== null) return handled;
      throw error;
    }
  };

  app.post("/v1/projects", async (request, reply) => {
    return await route(() => service.createProject(requireAccess(request, accessTokens).sub, request.body), reply, 201);
  });
  app.get("/v1/projects", async (request, reply) => {
    return await route(() => service.listProjects(requireAccess(request, accessTokens).sub), reply);
  });
  app.get("/v1/projects/:projectId", async (request, reply) => {
    return await route(() => {
      const claims = requireAccess(request, accessTokens);
      return service.getProject(claims.sub, projectParams.parse(request.params).projectId);
    }, reply);
  });
  app.patch("/v1/projects/:projectId", async (request, reply) => {
    return await route(() => {
      const claims = requireAccess(request, accessTokens);
      return service.updateProject(claims.sub, projectParams.parse(request.params).projectId, request.body);
    }, reply);
  });
  app.get("/v1/projects/:projectId/pages", async (request, reply) => {
    return await route(() => {
      const claims = requireAccess(request, accessTokens);
      return service.listPages(claims.sub, projectParams.parse(request.params).projectId);
    }, reply);
  });
  app.post("/v1/projects/:projectId/pages", async (request, reply) => {
    return await route(() => {
      const claims = requireAccess(request, accessTokens);
      return service.createPage(claims.sub, projectParams.parse(request.params).projectId, request.body);
    }, reply, 201);
  });
  app.put("/v1/projects/:projectId/pages/:pageId", async (request, reply) => {
    return await route(() => {
      const claims = requireAccess(request, accessTokens);
      const { projectId, pageId } = pageParams.parse(request.params);
      return service.updatePage(claims.sub, projectId, pageId, request.body);
    }, reply);
  });
  app.delete("/v1/projects/:projectId/pages/:pageId", async (request, reply) => {
    try {
      const claims = requireAccess(request, accessTokens);
      const { projectId, pageId } = pageParams.parse(request.params);
      await service.deletePage(claims.sub, projectId, pageId);
      return await reply.code(204).send();
    } catch (error) {
      const handled = await sendHttpError(error, reply);
      if (handled !== null) return handled;
      throw error;
    }
  });
  app.post("/v1/projects/:projectId/publish", async (request, reply) => {
    return await route(() => {
      const claims = requireAccess(request, accessTokens);
      return service.publish(claims.sub, projectParams.parse(request.params).projectId);
    }, reply, 201);
  });
  app.post("/v1/projects/:projectId/preview-grants", async (request, reply) => {
    return await route(() => {
      const claims = requireAccess(request, accessTokens);
      return service.createPreviewGrant(claims.sub, projectParams.parse(request.params).projectId, request.body);
    }, reply, 201);
  });
  app.get("/v1/public/apps/:publicId", async (request, reply) => {
    try {
      const manifest = await service.getPublicApp(publicParams.parse(request.params).publicId);
      reply.header("etag", `\"${manifest.release.contentHash}\"`);
      reply.header("cache-control", "public, max-age=60, stale-while-revalidate=300");
      return await reply.send({ data: manifest });
    } catch (error) {
      const handled = await sendHttpError(error, reply);
      if (handled !== null) return handled;
      throw error;
    }
  });
  app.get("/preview/v1/:token", async (request, reply) => {
    reply.header("cache-control", "private, no-store");
    return await route(() => service.getPreviewApp(previewParams.parse(request.params).token), reply);
  });
}
