import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { buildApp } from "./dist/server.js";
import { runMigrations } from "./migrate.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
await runMigrations(databaseUrl);

const app = await buildApp();
const webRoot = resolve("apps/web/dist");
const webAssetsRoot = resolve(webRoot, "assets");
const miniAppRoot = resolve("apps/miniapp/dist");

app.get("/assets/*", async (request, reply) => sendAsset(reply, webAssetsRoot, request.params["*"]));
app.get("/miniapp-assets/*", async (request, reply) => sendAsset(reply, miniAppRoot, request.params["*"]));
app.get("/robots.txt", async (_request, reply) => reply.type("text/plain; charset=utf-8").send("User-agent: *\nAllow: /\n"));
app.get("/llms.txt", async (_request, reply) => reply.type("text/plain; charset=utf-8").send("# TMA Studio\n\nNo-code constructor for Telegram bots and Mini Apps. Users can build a draft for free and pay only when publishing.\n"));
app.get("/app", async (_request, reply) => reply.code(302).header("location", "/workspace").send());
app.get("/app/*", async (_request, reply) => sendIndex(reply, miniAppRoot));

app.setNotFoundHandler(async (request, reply) => {
  if (request.method === "GET" && !request.url.startsWith("/v1/") && !request.url.startsWith("/health/")) {
    return sendIndex(reply, webRoot);
  }
  return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Route not found" } });
});

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("PORT is invalid");
await app.listen({ host: "0.0.0.0", port });

async function sendIndex(reply, root) {
  reply.header("cache-control", "no-cache");
  reply.header("content-security-policy", "default-src 'self'; script-src 'self' https://telegram.org; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.telegram.org; frame-ancestors https://web.telegram.org https://*.telegram.org");
  return reply.type("text/html; charset=utf-8").send(await readFile(resolve(root, "index.html")));
}

async function sendAsset(reply, root, untrustedPath) {
  let decoded;
  try { decoded = decodeURIComponent(untrustedPath); } catch { return reply.code(400).send(); }
  const path = resolve(root, decoded);
  if (!path.startsWith(`${root}${sep}`)) return reply.code(404).send();
  try {
    const content = await readFile(path);
    reply.header("cache-control", "public, max-age=31536000, immutable");
    return reply.type(mimeType(path)).send(content);
  } catch (error) {
    if (error?.code === "ENOENT") return reply.code(404).send();
    throw error;
  }
}

function mimeType(path) {
  return ({ ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2" })[extname(path).toLowerCase()] ?? "application/octet-stream";
}
