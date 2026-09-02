import "@fastify/jwt";
import type { preHandlerHookHandler } from "fastify";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: preHandlerHookHandler;
  }
}
