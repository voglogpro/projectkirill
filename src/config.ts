import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  DATABASE_URL: z.string().min(1),
  PUBLIC_TMA_ORIGIN: z.url().transform((value) => new URL(value)),
  PUBLIC_CONSOLE_ORIGIN: z.url().transform((value) => new URL(value)),
  PUBLIC_API_ORIGIN: z.url().transform((value) => new URL(value)),
  SESSION_JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().min(1).default("tma-studio-api"),
  JWT_AUDIENCE: z.string().min(1).default("tma-studio-console"),
  PASSWORD_PEPPER_BASE64: z.string().min(1),
  PASSWORD_PEPPER_ID: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).default("password-v1"),
  REFRESH_TOKEN_HASH_KEY_BASE64: z.string().min(1),
  TOKEN_KEK_BASE64: z.string().min(1),
  TOKEN_KEK_ID: z.string().min(1).max(100),
  PAYMENT_PROVIDER: z.enum(["mock", "yookassa"]).default("mock"),
  RUN_TELEGRAM_WORKER: z.enum(["true", "false"]).default("true").transform((value) => value === "true"),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(3).default(0),
  YOOKASSA_SHOP_ID: z.string().optional(),
  YOOKASSA_SECRET_KEY: z.string().optional(),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const bothostOrigin = environment.DOMAIN?.trim() ? `https://${environment.DOMAIN.trim()}` : undefined;
  const config = configSchema.parse({
    ...environment,
    PUBLIC_TMA_ORIGIN: environment.PUBLIC_TMA_ORIGIN ?? bothostOrigin,
    PUBLIC_CONSOLE_ORIGIN: environment.PUBLIC_CONSOLE_ORIGIN ?? bothostOrigin,
    PUBLIC_API_ORIGIN: environment.PUBLIC_API_ORIGIN ?? bothostOrigin,
  });
  if (config.NODE_ENV === "production" && config.PUBLIC_TMA_ORIGIN.protocol !== "https:") {
    throw new Error("PUBLIC_TMA_ORIGIN must use HTTPS in production");
  }
  if (config.NODE_ENV === "production" && process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    throw new Error("NODE_TLS_REJECT_UNAUTHORIZED=0 is forbidden in production");
  }
  if (config.PAYMENT_PROVIDER === "yookassa" && (!config.YOOKASSA_SHOP_ID || !config.YOOKASSA_SECRET_KEY)) {
    throw new Error("YooKassa credentials are required when PAYMENT_PROVIDER=yookassa");
  }
  return config;
}
