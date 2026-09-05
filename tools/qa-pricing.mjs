// Launch/price regression: isolated accounts, fake tokens and fully mocked APIs.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.KIRA_BROWSER_MODULE ?? "playwright");
const base = process.env.KIRA_QA_URL ?? "http://127.0.0.1:5174";
const output = new URL("../preview/qa/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const cases = [
  { kit: "bot", accountPlan: "free", paid: false, width: 1440, options: 2, checkout: "trio" },
  { kit: "bot-app", accountPlan: "free", paid: false, width: 390, options: 1, checkout: "studio" },
  { kit: "bot-app-site", accountPlan: "free", paid: false, width: 320, options: 1, checkout: "studio" },
  { kit: "bot-app", accountPlan: "trio", paid: true, existing: true, width: 390, options: 1, checkout: "studio" },
  { kit: "site", accountPlan: "free", paid: false, width: 390, options: 1, checkout: "solo" },
  { kit: "bot-app", accountPlan: "studio", paid: true, width: 1440, launch: true },
];

try {
  for (const config of cases) {
    const context = await browser.newContext({ viewport: { width: config.width, height: 900 }, isMobile: config.width < 600, hasTouch: config.width < 600 });
    const projectId = crypto.randomUUID();
    const startId = crypto.randomUUID(), helloId = crypto.randomUUID();
    const userId = `qa-pricing-${config.kit}-${config.accountPlan}`;
    const project = { id: projectId, name: "QA launch only", kit: config.kit, status: "draft", plan: config.accountPlan, pages: [], ...(config.existing ? { botUsername: "qa_fake_bot", botStatus: "active" } : {}) };
    let flow = {
      schemaVersion: 1, metadata: { name: "QA scenario" },
      nodes: [
        { id: startId, version: 1, type: "start", position: { x: 0, y: 0 }, props: { command: "start", description: "Start" } },
        { id: helloId, version: 1, type: "message", position: { x: 0, y: 180 }, props: { text: "Mock scenario only", buttons: [] } },
      ], edges: [{ id: "start-hello", from: startId, fromHandle: "next", to: helloId }],
    };
    const ent = { planCode: config.accountPlan, maxProjects: config.accountPlan === "trio" ? 3 : 1, maxActiveBots: config.paid ? config.accountPlan === "trio" ? 3 : 1 : 0, canPublish: config.paid };
    const calls = [];
    const checkouts = [];
    const unexpected = [];
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname.startsWith("/v1/")) {
        const path = url.pathname;
        calls.push(`${request.method()} ${path}`);
        if (path === `/v1/projects/${projectId}/flow`) {
          if (request.method() === "PUT") flow = request.postDataJSON().document;
          return route.fulfill({ json: { data: { document: flow, revision: calls.length } } });
        }
        if (path === `/v1/projects/${projectId}` && request.method() === "PATCH") return route.fulfill({ json: { data: project } });
        if (path === "/v1/billing/entitlement") return route.fulfill({ json: { data: ent } });
        if (path === "/v1/bot-connections/validate") return route.fulfill({ json: { data: { botId: "123456789", firstName: "QA fake bot", username: "qa_fake_bot" } } });
        if (path === "/v1/billing/checkouts") {
          checkouts.push(request.postDataJSON());
          return route.fulfill({ json: { data: { checkoutId: "qa-checkout", status: "pending", confirmationUrl: `${base}/qa-mock-payment` } } });
        }
        if (config.launch && path === `/v1/projects/${projectId}/publish`) return route.fulfill({ json: { data: { project: { ...project, publicId: "qa-only" } } } });
        if (config.launch && path === `/v1/projects/${projectId}/flow/publish`) return route.fulfill({ json: { data: { version: 1 } } });
        if (config.launch && path === "/v1/bot-connections" && request.method() === "POST") return route.fulfill({ json: { data: { botUsername: "qa_fake_bot", miniAppUrl: `${base}/app/qa-only` } } });
        unexpected.push(`${request.method()} ${path}`);
        return route.fulfill({ status: 409, json: { error: { message: "Unexpected call outside local QA" } } });
      }
      if (url.pathname === "/qa-mock-payment") return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Mock only</title>No real payment." });
      if (url.origin !== new URL(base).origin) return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(({ project, flow, userId }) => {
      sessionStorage.setItem("tma-studio-session", JSON.stringify({ accessToken: "qa-fake-only", refreshToken: "qa-fake-only", user: { id: userId, displayName: "QA", email: "qa@example.invalid" } }));
      localStorage.setItem(`tma-studio-project-v2:${userId}`, JSON.stringify(project));
      localStorage.setItem("tma-studio-flow-v1", JSON.stringify(flow));
    }, { project, flow, userId });
    await page.goto(`${base}/flow`);
    await page.locator(".flow-busy").waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Запустить", exact: true }).click();
    const modal = page.getByRole("dialog", { name: "Мастер запуска" });
    await modal.waitFor();
    if (!config.existing) {
      await modal.locator('input[name="bot-token"]').fill("123456789:QA-not-a-real-token-at-all");
      await modal.getByRole("button", { name: "Проверить и продолжить" }).click();
    }
    if (config.launch) {
      await modal.getByRole("heading", { name: "Всё готово к запуску" }).waitFor();
      assert.equal(calls.some((path) => path.endsWith("/publish")), false, "Opening wizard must not publish");
      await modal.getByRole("button", { name: "Опубликовать и запустить" }).click();
      await modal.getByRole("heading", { name: "Mini App запущен" }).waitFor();
      assert.deepEqual(calls.filter((path) => path.endsWith("/publish") || path === "POST /v1/bot-connections"), [
        `POST /v1/projects/${projectId}/publish`, `POST /v1/projects/${projectId}/flow/publish`, "POST /v1/bot-connections",
      ]);
      console.log("PASS studio account: explicit launch publishes pages, then saved scenario, then activates mock bot");
    } else {
      await modal.getByRole("heading", { name: "Выберите тариф" }).waitFor();
      assert.equal(await modal.locator(".plan-option").count(), config.options);
      if (config.checkout === "studio") {
        assert.match(await modal.locator(".plan-option").innerText(), /Студия.*Один бот \+ Mini App.*650/s);
        assert.equal(await modal.locator(".plan-option").filter({ hasText: "Три текстовых бота" }).count(), 0);
      }
      if (config.existing) {
        await modal.getByRole("button", { name: "Проверить действующую подписку" }).click();
        await modal.locator(".auth-error").filter({ hasText: "Для Mini App нужен тариф" }).waitFor();
        assert.equal(await modal.getByRole("heading", { name: "Всё готово к запуску" }).count(), 0, "Paid trio must not unlock a Mini App");
      }
      if (config.checkout === "trio") await modal.locator(".plan-option").filter({ hasText: "Три текстовых бота" }).click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await modal.evaluate((node) => node.scrollWidth <= node.clientWidth), true, "Wizard must not overflow horizontally");
      await page.screenshot({ path: fileURLToPath(new URL(`launch-${config.kit}-${config.accountPlan}-${config.width}.png`, output)) });
      await modal.getByRole("button", { name: "Перейти к оплате" }).click();
      await modal.getByRole("heading", { name: "Завершите оплату" }).waitFor();
      assert.equal(checkouts.length, 1);
      assert.equal(checkouts[0].planCode, config.checkout);
      assert.match(checkouts[0].clientRequestId, /^[a-f0-9-]{36}$/);
      assert.equal(calls.some((path) => path.endsWith("/publish") || path === "POST /v1/bot-connections"), false, "No publication/activation before suitable payment confirmation");
      console.log(`PASS ${config.kit}/${config.accountPlan}/${config.width}px: ${config.options} suitable tariff(s), checkout=${config.checkout}, no unpaid publication`);
    }
    assert.deepEqual(unexpected, []);
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
