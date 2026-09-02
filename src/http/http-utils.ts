import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import type { AccessTokenService } from "../auth/tokens.js";
import { AuthenticationError } from "../auth/errors.js";
import { DomainError } from "../domain/errors.js";

export function requireAccess(request: FastifyRequest, tokens: AccessTokenService) {
  const authorization = request.headers.authorization;
  if (authorization === undefined || !authorization.startsWith("Bearer ")) throw new AuthenticationError("Access token required");
  try {
    return tokens.verify(authorization.slice(7));
  } catch {
    throw new AuthenticationError("Invalid access token");
  }
}

export function bearerToken(request: FastifyRequest): string {
  const authorization = request.headers.authorization;
  if (authorization === undefined || !authorization.startsWith("Bearer ")) throw new AuthenticationError("Access token required");
  return authorization.slice(7);
}

export async function sendHttpError(error: unknown, reply: FastifyReply): Promise<FastifyReply | null> {
  if (error instanceof ZodError) {
    return await reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "Request validation failed", details: error.issues } });
  }
  if (error instanceof DomainError) {
    return await reply.code(error.httpStatus).send({ error: { code: error.code, message: error.message } });
  }
  return null;
}

export function sessionContext(request: FastifyRequest): { userAgent?: string; ipAddress?: string } {
  const userAgent = request.headers["user-agent"];
  return {
    ...(userAgent === undefined ? {} : { userAgent: userAgent.slice(0, 500) }),
    ...(request.ip.length === 0 ? {} : { ipAddress: request.ip }),
  };
}
