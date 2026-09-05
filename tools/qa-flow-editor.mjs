// Local browser regression. Supply KIRA_BROWSER_MODULE if Playwright is installed outside this repo.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.KIRA_BROWSER_MODULE ?? "playwright");
const base = process.env.KIRA_QA_URL ?? "http://127.0.0.1:5174";
const output = new URL("../preview/qa/", import.meta.url);
await mkdir(output, { recursive: true });
const ids = { start: crypto.randomUUID(), message: crypto.randomUUID(), question: crypto.randomUUID(), end: crypto.randomUUID() };
const fixture = {
  schemaVersion: 1, metadata: { name: "Проверка цепочки" },
  nodes: [
    { id: ids.start, type: "start", version: 1, position: { x: 0, y: 0 }, props: { command: "start", description: "Начало" } },
    { id: ids.message, type: "message", version: 1, position: { x: 0, y: 190 }, props: { text: "Здравствуйте! Начнём?", buttons: [{ id: "go", kind: "next", label: "Начать" }] } },
    { id: ids.question, type: "question", version: 1, position: { x: 360, y: 190 }, props: { text: "Как вас зовут?", variable: "name", expects: "any", retryText: "Напишите имя" } },
    { id: ids.end, type: "handoff", version: 1, position: { x: 360, y: 430 }, props: { text: "Спасибо! Передаю оператору." } },
  ],
  edges: [
    { id: "wire-start", from: ids.start, fromHandle: "next", to: ids.message },
    { id: "wire-message", from: ids.message, fromHandle: "go", to: ids.question },
    { id: "wire-question", from: ids.question, fromHandle: "next", to: ids.end },
  ],
};
const browser = await chromium.launch({ headless: true });
const errors = [];
const documentOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("tma-studio-flow-v1")));
const node = (page, id) => page.locator(`.react-flow__node[data-id="${id}"]`);
const edge = (page, id) => page.locator(`.react-flow__edge[data-id="${id}"]`);
async function eventually(check) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Condition did not become true");
}
async function drag(page, source, target) {
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  assert(from && to, "Drag endpoints must be visible");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 });
  await page.mouse.up();
}
async function open(options) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript((flow) => {
    if (!localStorage.getItem("tma-studio-flow-v1")) localStorage.setItem("tma-studio-flow-v1", JSON.stringify(flow));
  }, fixture);
  await page.goto(`${base}/flow`);
  await node(page, ids.message).waitFor();
  await page.waitForFunction(() => document.querySelector(".react-flow__node")?.getBoundingClientRect().width > 0);
  return { context, page };
}
try {
  const { context, page } = await open({ viewport: { width: 1440, height: 1000 } });
  await drag(page, edge(page, "wire-message").locator(".react-flow__edgeupdater-target"), node(page, ids.end).locator(".target"));
  await eventually(async () => (await documentOf(page)).edges.find((item) => item.id === "wire-message").to === ids.end);
  await page.getByRole("button", { name: "Отменить действие", exact: true }).click();
  await eventually(async () => (await documentOf(page)).edges.find((item) => item.id === "wire-message").to === ids.question);
  await page.getByRole("button", { name: "Повторить действие", exact: true }).click();
  await eventually(async () => (await documentOf(page)).edges.find((item) => item.id === "wire-message").to === ids.end);
  console.log("PASS desktop: reconnect target, undo, redo");

  // Dropping in empty space must keep the original edge, never silently delete it.
  const anchor = await edge(page, "wire-message").locator(".react-flow__edgeupdater-target").boundingBox();
  await page.mouse.move(anchor.x + anchor.width / 2, anchor.y + anchor.height / 2);
  await page.mouse.down();
  await page.mouse.move(700, 150, { steps: 12 });
  await page.mouse.up();
  assert.equal((await documentOf(page)).edges.find((item) => item.id === "wire-message").to, ids.end);
  const linePoint = await edge(page, "wire-message").locator(".react-flow__edge-path").evaluate((path) => {
    const point = path.getPointAtLength(path.getTotalLength() * 0.25);
    const screen = new DOMPoint(point.x, point.y).matrixTransform(path.getScreenCTM());
    return { x: screen.x, y: screen.y };
  });
  await page.mouse.click(linePoint.x, linePoint.y);
  await page.getByRole("button", { name: "Удалить связь", exact: true }).waitFor();
  await page.keyboard.press("Delete");
  await eventually(async () => !(await documentOf(page)).edges.some((item) => item.id === "wire-message"));
  await page.keyboard.press("Control+z");
  await eventually(async () => (await documentOf(page)).edges.some((item) => item.id === "wire-message"));
  console.log("PASS desktop: invalid drop preserved, Delete and keyboard undo");
  await drag(page, edge(page, "wire-question").locator(".react-flow__edgeupdater-source"), node(page, ids.message).locator('.source[data-handleid="go"]'));
  await eventually(async () => (await documentOf(page)).edges.find((item) => item.id === "wire-question")?.from === ids.message);
  assert.equal((await documentOf(page)).edges.some((item) => item.id === "wire-message"), false);
  await page.keyboard.press("Control+z");
  await eventually(async () => (await documentOf(page)).edges.length === 3);
  await node(page, ids.start).locator(".flow-node-body").click();
  await page.keyboard.press("Delete");
  assert.equal((await documentOf(page)).nodes.some((item) => item.id === ids.start), true);
  assert.equal(await node(page, ids.start).isVisible(), true);
  console.log("PASS desktop: reconnect source replaces occupied exit, /start is protected");

  const beforeMove = (await documentOf(page)).nodes.find((item) => item.id === ids.message).position;
  const box = await node(page, ids.message).locator(".flow-node-head").boundingBox();
  await page.mouse.move(box.x + 40, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 105, box.y + 40, { steps: 12 });
  await page.mouse.up();
  await eventually(async () => (await documentOf(page)).nodes.find((item) => item.id === ids.message).position.x !== beforeMove.x);
  await page.reload();
  await node(page, ids.message).waitFor();
  assert.notEqual((await documentOf(page)).nodes.find((item) => item.id === ids.message).position.x, beforeMove.x);
  await page.screenshot({ path: fileURLToPath(new URL("flow-desktop.png", output)), fullPage: true });
  console.log("PASS desktop: move block, persist and reload");
  await context.close();

  const phone = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await phone.page.locator(".flow-screen.compact").waitFor();
  await node(phone.page, ids.message).locator(".flow-node-body").tap();
  await phone.page.getByRole("tab", { name: "Связи", exact: true }).tap();
  const next = phone.page.getByRole("combobox", { name: "Следующий шаг: Начать" });
  await next.selectOption(ids.end);
  await eventually(async () => (await documentOf(phone.page)).edges.find((item) => item.id === "wire-message").to === ids.end);
  assert.equal(await phone.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await phone.page.screenshot({ path: fileURLToPath(new URL("flow-phone-settings.png", output)), fullPage: true });
  await phone.page.getByRole("button", { name: "Закрыть", exact: true }).tap();
  await phone.page.getByRole("button", { name: "Двигать блоки", exact: true }).tap();
  assert.equal(await phone.page.getByRole("button", { name: "Готово", exact: true }).getAttribute("aria-pressed"), "true");
  const touchBox = await node(phone.page, ids.message).locator(".flow-node-head").boundingBox();
  const phoneBefore = (await documentOf(phone.page)).nodes.find((item) => item.id === ids.message).position;
  const cdp = await phone.context.newCDPSession(phone.page);
  const touch = (x, y) => [{ x, y, id: 1, radiusX: 3, radiusY: 3 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: touch(touchBox.x + 30, touchBox.y + 10) });
  for (let step = 1; step <= 10; step++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: touch(touchBox.x + 30 + step * 3, touchBox.y + 10 + step * 4) });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await eventually(async () => (await documentOf(phone.page)).nodes.find((item) => item.id === ids.message).position.x !== phoneBefore.x);
  await phone.page.getByRole("button", { name: "Готово", exact: true }).tap();
  await phone.page.screenshot({ path: fileURLToPath(new URL("flow-phone.png", output)), fullPage: true });
  console.log("PASS phone: touch inspector, next-step connection, move mode, no horizontal overflow");
  await phone.page.goto(base);
  await phone.page.locator("video").scrollIntoViewIfNeeded();
  await phone.page.waitForFunction(() => document.querySelector("video")?.readyState >= 2);
  assert.match(await phone.page.locator("video source").first().getAttribute("src"), /kira-build-tall/);
  await phone.page.setViewportSize({ width: 1200, height: 850 });
  await phone.page.waitForFunction(() => document.querySelector("video source")?.getAttribute("src") === "/media/kira-build.webm");
  await phone.page.locator("video").scrollIntoViewIfNeeded();
  await phone.page.waitForFunction(() => document.querySelector("video")?.readyState >= 2);
  console.log("PASS video: mobile asset loads, resize switches to desktop asset");
  await phone.context.close();

  // Cloud saves use mocked HTTP only; never contact Neon, Telegram or a real account.
  const cloud = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  let remote = fixture;
  let revision = 1;
  const writes = [];
  let published;
  const cloudProject = { id: "11111111-1111-4111-8111-111111111111", name: "QA cloud bot", kit: "bot", status: "draft", plan: "free", pages: [] };
  await cloud.route("**/v1/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (request.url().endsWith("/flow/publish")) {
      published = remote;
      return route.fulfill({ json: { data: { version: 1 } } });
    }
    if (pathname === `/v1/projects/${cloudProject.id}` && request.method() === "PATCH") return route.fulfill({ json: { data: cloudProject } });
    if (pathname === "/v1/billing/entitlement") return route.fulfill({ json: { data: { planCode: "free", maxProjects: 1, maxActiveBots: 0, canPublish: false } } });
    if (!request.url().endsWith("/flow")) return route.fulfill({ status: 503, json: { error: { message: "Outside scenario test scope" } } });
    if (request.method() === "PUT") {
      const body = request.postDataJSON();
      assert.equal(body.expectedRevision, revision);
      writes.push(body.document);
      await new Promise((resolve) => setTimeout(resolve, 150));
      remote = body.document;
      revision++;
    }
    return route.fulfill({ json: { data: { document: remote, revision } } });
  });
  const cloudPage = await cloud.newPage();
  cloudPage.on("pageerror", (error) => errors.push(error.message));
  await cloudPage.addInitScript(({ flow, project }) => {
    localStorage.setItem("tma-studio-flow-v1", JSON.stringify(flow));
    localStorage.setItem("tma-studio-project-v2:qa", JSON.stringify(project));
    sessionStorage.setItem("tma-studio-session", JSON.stringify({ accessToken: "local-qa-only", refreshToken: "local-qa-only", user: { id: "qa", displayName: "QA", email: "qa@example.test" } }));
  }, { flow: fixture, project: cloudProject });
  await cloudPage.goto(`${base}/flow`);
  await cloudPage.locator(".flow-busy").waitFor({ state: "hidden" });
  await cloudPage.getByRole("textbox", { name: "Текст", exact: true }).fill("Первая правка");
  await eventually(() => writes.length === 1);
  await cloudPage.getByRole("textbox", { name: "Текст", exact: true }).fill("Вторая правка");
  await eventually(() => writes.length === 2 && revision === 3);
  await new Promise((resolve) => setTimeout(resolve, 2300));
  assert.equal(writes.length, 2, "Revision responses must not start another autosave");
  await cloudPage.getByRole("textbox", { name: "Текст", exact: true }).fill("Сохранить перед запуском");
  await cloudPage.getByRole("button", { name: "Запустить", exact: true }).click();
  await cloudPage.getByRole("dialog", { name: "Мастер запуска" }).waitFor();
  assert.equal(remote.nodes.find((item) => item.id === ids.message).props.text, "Сохранить перед запуском");
  assert.equal(published, undefined, "A free account must save its draft, not publish before the launch wizard");
  console.log("PASS cloud mock: serial revisions, no autosave loop, latest draft flushed before wizard, no free publication");
  await cloud.close();
  assert.deepEqual(errors, [], "No browser runtime errors");
} finally { await browser.close(); }
