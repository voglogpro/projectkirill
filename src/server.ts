import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { AuthService } from "./application/auth-service.js";
import { ConnectBotService } from "./application/connect-bot.js";
import { CoreService } from "./application/core-service.js";
import { FormSubmissionService } from "./application/form-submission-service.js";
import { ScryptPasswordHasher, StaticPepperProvider } from "./auth/password.js";
import { AccessTokenService, OpaqueRefreshTokens } from "./auth/tokens.js";
import { BillingService } from "./billing/billing-service.js";
import { MockPaymentProvider } from "./billing/mock-payment-provider.js";
import { PostgresEntitlementGate } from "./billing/postgres-entitlement-gate.js";
import { PostgresBillingRepository } from "./billing/postgres-billing-repository.js";
import type { PaymentProvider } from "./billing/payment-provider.js";
import { YooKassaPaymentProvider } from "./billing/yookassa-payment-provider.js";
import { loadConfig } from "./config.js";
import { EnvelopeTokenVault, LocalAesKek } from "./crypto/token-vault.js";
import { PostgresAuthRepository } from "./db/postgres-auth-repository.js";
import { PostgresBotConnectionRepository } from "./db/postgres-bot-repository.js";
import { PostgresCoreRepository } from "./db/postgres-core-repository.js";
import { PostgresFormSubmissionRepository } from "./db/postgres-form-submission-repository.js";
import { PostgresTelegramUpdateRepository } from "./db/postgres-telegram-update-repository.js";
import { PostgresTelegramUpdateJobRepository } from "./db/postgres-telegram-update-job-repository.js";
import { registerAuthRoutes } from "./http/auth-routes.js";
import { registerBillingRoutes } from "./http/billing-routes.js";
import { registerBotRoutes } from "./http/bot-routes.js";
import { registerCoreRoutes } from "./http/core-routes.js";
import { registerFormRoutes } from "./http/form-routes.js";
import { registerTelegramWebhookRoutes } from "./http/telegram-webhook-routes.js";
import { TelegramBotApiClient } from "./telegram/telegram-client.js";
import { TelegramWebhookService } from "./telegram/telegram-webhook.js";
import { TelegramUpdateWorker } from "./telegram/telegram-update-worker.js";

export async function buildApp() {
  const config = loadConfig();
  const trustProxy = config.TRUST_PROXY_HOPS === 0
    ? false
    : (_address: string, hop: number) => hop < config.TRUST_PROXY_HOPS;
  const app = Fastify({
    logger: {
      redact: {
        paths: ["req.headers.authorization", "req.body.botToken", "botToken", "token"],
        censor: "[REDACTED]",
      },
    },
    bodyLimit: 32 * 1024,
    // Set an explicit proxy CIDR/function at deployment time. Trusting arbitrary
    // X-Forwarded-For would make IP rate limits spoofable.
    trustProxy,
  });

  await app.register(rateLimit, { global: false });
  const allowedOrigins = new Set([
    config.PUBLIC_CONSOLE_ORIGIN.origin,
    config.PUBLIC_TMA_ORIGIN.origin,
  ]);
  app.addHook("onRequest", async (request, reply) => {
    const origin = request.headers.origin;
    if (origin !== undefined && allowedOrigins.has(origin)) {
      reply.header("access-control-allow-origin", origin);
      reply.header("vary", "Origin");
      reply.header("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      reply.header("access-control-allow-headers", "Authorization,Content-Type,X-Telegram-Init-Data,X-Idempotency-Key");
    }
    if (request.method === "OPTIONS") {
      if (origin === undefined || !allowedOrigins.has(origin)) return await reply.code(403).send();
      return await reply.code(204).send();
    }
  });
  app.addHook("onSend", async (_request, reply) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "no-referrer");
    reply.header("permissions-policy", "camera=(), microphone=(), geolocation=()");
  });

  const sql = postgres(config.DATABASE_URL, { max: 20, idle_timeout: 20, connect_timeout: 10 });
  let stopTelegramWorker: (() => Promise<void>) | undefined;

  const accessTokens = new AccessTokenService(Buffer.from(config.SESSION_JWT_SECRET, "utf8"), config.JWT_ISSUER, config.JWT_AUDIENCE);
  const authService = new AuthService(
    new PostgresAuthRepository(sql),
    new ScryptPasswordHasher(new StaticPepperProvider(config.PASSWORD_PEPPER_ID, decodeBase64Key(config.PASSWORD_PEPPER_BASE64, "PASSWORD_PEPPER_BASE64"))),
    accessTokens,
    new OpaqueRefreshTokens(decodeBase64Key(config.REFRESH_TOKEN_HASH_KEY_BASE64, "REFRESH_TOKEN_HASH_KEY_BASE64")),
  );
  const entitlements = new PostgresEntitlementGate(sql);
  const coreService = new CoreService(new PostgresCoreRepository(sql), () => Date.now(), entitlements);
  const telegram = new TelegramBotApiClient();
  const vault = new EnvelopeTokenVault(new LocalAesKek(config.TOKEN_KEK_BASE64, config.TOKEN_KEK_ID));
  const connectBotService = new ConnectBotService(new PostgresBotConnectionRepository(sql), telegram, vault, config.PUBLIC_TMA_ORIGIN, entitlements, config.PUBLIC_API_ORIGIN);
  const paymentProvider: PaymentProvider = config.PAYMENT_PROVIDER === "yookassa"
    ? new YooKassaPaymentProvider({ shopId: config.YOOKASSA_SHOP_ID!, secretKey: config.YOOKASSA_SECRET_KEY! })
    : new MockPaymentProvider();
  const billingService = new BillingService(new PostgresBillingRepository(sql), paymentProvider, config.PUBLIC_CONSOLE_ORIGIN);
  const formService = new FormSubmissionService(new PostgresFormSubmissionRepository(sql), coreService, vault);

  await registerAuthRoutes(app, authService);
  await registerCoreRoutes(app, coreService, accessTokens);
  await registerBillingRoutes(app, billingService, accessTokens);
  await registerBotRoutes(app, connectBotService, accessTokens);
  await registerFormRoutes(app, formService, accessTokens);
  await registerTelegramWebhookRoutes(app, new TelegramWebhookService(new PostgresTelegramUpdateRepository(sql)));

  if (config.RUN_TELEGRAM_WORKER) {
    const updateWorker = new TelegramUpdateWorker(new PostgresTelegramUpdateJobRepository(sql), vault, telegram);
    let stopped = false;
    let workerLoop: Promise<void> | undefined;
    app.addHook("onReady", async () => {
      workerLoop = (async () => {
        while (!stopped) {
          try {
            const result = await updateWorker.runOnce();
            if (result === "idle") await wait(500);
          } catch {
            // Never log worker error objects: an upstream cause could carry a token URL.
            app.log.error("Telegram update worker iteration failed");
            await wait(1_000);
          }
        }
      })();
    });
    stopTelegramWorker = async () => { stopped = true; await workerLoop; };
  }

  app.addHook("onClose", async () => {
    await stopTelegramWorker?.();
    await sql.end();
  });

  app.get("/health/live", async () => ({ status: "ok" }));
  app.get("/health/ready", async (_request, reply) => {
    await sql`SELECT 1`;
    return reply.send({ status: "ok" });
  });
  return app;
}

function decodeBase64Key(value: string, name: string): Buffer {
  const key = Buffer.from(value, "base64");
  if (key.byteLength < 32) throw new Error(`${name} must decode to at least 32 bytes`);
  return key;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const isMainModule = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  const app = await buildApp();
  const config = loadConfig();
  await app.listen({ host: "0.0.0.0", port: config.PORT });
}
