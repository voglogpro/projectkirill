// Browser regression against a local Vite build. All API traffic is mocked.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.KIRA_BROWSER_MODULE ?? "playwright");
const base = process.env.KIRA_QA_URL ?? "http://127.0.0.1:5174";
const output = new URL("../preview/qa/", import.meta.url);
await mkdir(output, { recursive: true });
const userId = "qa-hub-owner";
const project = {
  id: "11111111-1111-4111-8111-111111111111", name: "Мой существующий бот", status: "draft", plan: "free", kit: "bot",
  activePageId: "22222222-2222-4222-8222-222222222222",
  pages: [{ id: "22222222-2222-4222-8222-222222222222", title: "Главная", slug: "home", remoteRevision: 1, blocks: [{ id: "33333333-3333-4333-8333-333333333333", type: "heading", version: 1, props: { text: "Не менять: облачный проект", level: 1, align: "start" } }] }],
};
const flow = {
  schemaVersion: 1, metadata: { name: "Не менять: облачный сценарий" },
  nodes: [
    { id: "44444444-4444-4444-8444-444444444444", type: "start", version: 1, position: { x: 0, y: 0 }, props: { command: "start", description: "Начало" } },
    { id: "55555555-5555-4555-8555-555555555555", type: "message", version: 1, position: { x: 0, y: 190 }, props: { text: "Не менять", buttons: [] } },
  ],
  edges: [{ id: "existing-wire", from: "44444444-4444-4444-8444-444444444444", fromHandle: "next", to: "55555555-5555-4555-8555-555555555555" }],
};
const projectKey = `tma-studio-project-v2:${userId}`;
const browser = await chromium.launch({ headless: true });
const errors = [];
const writes = [];
const unexpectedReads = [];

async function open(width, height) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 600, hasTouch: width < 600 });
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.startsWith("/v1/")) {
      if (request.method() !== "GET") { writes.push(`${request.method()} ${url.pathname}`); return route.fulfill({ status: 409, json: { error: { message: "Unexpected write in free preview" } } }); }
      if (url.pathname === "/v1/projects") return route.fulfill({ json: { data: [project] } });
      if (url.pathname === `/v1/projects/${project.id}`) return route.fulfill({ json: { data: project } });
      if (url.pathname === `/v1/projects/${project.id}/pages`) return route.fulfill({ json: { data: project.pages.map((page) => ({ ...page, revision: 1, document: { blocks: page.blocks } })) } });
      if (url.pathname === `/v1/projects/${project.id}/flow`) return route.fulfill({ json: { data: { document: flow, revision: 1 } } });
      if (url.pathname === `/v1/bot-connections/${project.id}`) return route.fulfill({ json: { data: null } });
      if (url.pathname === "/v1/billing/entitlement") return route.fulfill({ json: { data: { planCode: "free", maxProjects: 1, maxActiveBots: 0, canPublish: false } } });
      unexpectedReads.push(url.pathname);
      return route.fulfill({ status: 404, json: { error: { message: "Outside mocked QA scope" } } });
    }
    if (url.origin !== new URL(base).origin) return route.abort();
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(({ project, flow, userId, projectKey }) => {
    sessionStorage.setItem("tma-studio-session", JSON.stringify({ accessToken: "qa-not-a-real-token", refreshToken: "qa-not-a-real-refresh", user: { id: userId, displayName: "Кирилл", email: "qa@example.invalid" } }));
    if (!localStorage.getItem(projectKey)) localStorage.setItem(projectKey, JSON.stringify(project));
    if (!localStorage.getItem("tma-studio-flow-v1")) localStorage.setItem("tma-studio-flow-v1", JSON.stringify(flow));
  }, { project, flow, userId, projectKey });
  await page.goto(`${base}/hub`);
  await page.locator(".hub-v2-projects button").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  return { page, context };
}

async function originalUnchanged(page) {
  const stored = await page.evaluate((key) => [JSON.parse(localStorage.getItem(key)), JSON.parse(localStorage.getItem("tma-studio-flow-v1"))], projectKey);
  assert.deepEqual(stored[0], project, "The existing project must never be overwritten by a preview");
  assert.deepEqual(stored[1], flow, "The existing flow must never be overwritten by a preview");
  assert.deepEqual(writes, [], "A free preview must not create, update or delete API data");
}

async function carouselCheck(page) {
  const pageSize = 3;
  const titles = page.locator('.tcard h3');
  const centralTitle = () => titles.nth(1).innerText();
  assert.equal(await titles.count(), pageSize, 'The default catalogue is a compact carousel');
  const first = await centralTitle();
  await page.getByRole('button', { name: 'Посмотреть все (18)', exact: true }).click();
  const all = await titles.allTextContents();
  assert.equal(all.length, 18);
  await page.getByRole('button', { name: 'Вернуть ленту', exact: true }).click();
  assert.equal(await titles.count(), pageSize);
  const previous = page.getByRole('button', { name: 'Предыдущие решения', exact: true });
  const next = page.getByRole('button', { name: 'Следующие решения', exact: true });
  await previous.click();
  assert.equal(await centralTitle(), all.at(-1), 'Previous wraps from first to last');
  await next.click();
  assert.equal(await centralTitle(), first, 'Next wraps from last to first');
  const visited = new Set();
  for (let index = 0; index < all.length; index += 1) {
    visited.add(await centralTitle());
    await next.click();
  }
  assert.equal(visited.size, 18, 'Every solution is reachable around the loop');
  assert.equal(await centralTitle(), first);
  assert.equal(await page.locator('.tcard.is-focused h3').innerText(), first, 'Central card is initially sharp');
  if (page.viewportSize().width > 760) {
    const neighbour = page.locator('.tcard').first();
    await neighbour.hover();
    assert.equal(await neighbour.evaluate(node => node.classList.contains('is-focused')), true, 'Hover reveals a neighbour');
    assert.equal(await page.locator('.tcard').nth(1).evaluate(node => node.classList.contains('is-focused')), false, 'Previous selection becomes blurred');
    await page.locator('.tcatalog-results').hover();
    assert.equal(await page.locator('.tcard.is-focused h3').innerText(), first, 'Leaving restores the central highlight');
    await neighbour.locator('.tcard-look').focus();
    assert.equal(await neighbour.evaluate(node => node.classList.contains('is-focused')), true, 'Keyboard focus also reveals a neighbour');
    await next.focus();
  }
  if (page.viewportSize().width <= 760) {
    // Exercise the touch handlers separately from the buttons; vertical gestures must not advance.
    const grid = page.locator('.tcatalog-grid');
    await grid.dispatchEvent('touchstart', { touches: [{ identifier: 1, clientX: 250, clientY: 200 }] });
    await grid.dispatchEvent('touchend', { changedTouches: [{ identifier: 1, clientX: 100, clientY: 205 }] });
    assert.equal(await centralTitle(), all[1], 'Left swipe advances');
    await grid.dispatchEvent('touchstart', { touches: [{ identifier: 1, clientX: 100, clientY: 200 }] });
    await grid.dispatchEvent('touchend', { changedTouches: [{ identifier: 1, clientX: 250, clientY: 205 }] });
    assert.equal(await centralTitle(), first, 'Right swipe goes back');
    await grid.dispatchEvent('touchstart', { touches: [{ identifier: 1, clientX: 100, clientY: 200 }] });
    await grid.dispatchEvent('touchend', { changedTouches: [{ identifier: 1, clientX: 110, clientY: 400 }] });
    assert.equal(await centralTitle(), first, 'Vertical scroll does not change cards');
  }
  assert.equal(await page.title(), 'KIRA - Конструктор ботов миниаппов сайтов');
  assert.equal(await page.locator('.price-summary').count(), 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
}

async function catalogCheck(page) {
  const search = page.getByRole("searchbox", { name: "Поиск готовых сценариев" });
  await search.fill("отзывы");
  assert.equal(await page.locator(".tcard").count(), 1);
  assert.match(await page.locator(".tcard h3").innerText(), /Отзывы/);
  await search.fill("no-such-scenario-qa");
  await page.getByRole("heading", { name: "Пока ничего не нашлось" }).waitFor();
  await page.getByRole("button", { name: "Сбросить фильтры" }).click();
  await page.getByRole('button', { name: 'Посмотреть все (18)', exact: true }).click();
  assert.equal(await page.locator(".tcard").count(), 18);
  assert.equal(await page.locator(".tcard .solution-art").count(), 18, "Every solution needs an explanatory visual");
  assert.equal(await page.locator(".solution-art").evaluateAll((nodes) => new Set(nodes.map((node) => node.innerHTML)).size), 18, "The artwork must distinguish all 18 solutions");
  const setup = page.locator(".tcard-setup").first();
  await setup.locator("summary").click();
  assert.equal(await setup.locator("li").count(), 3, "A ready solution explains what the owner must customize");
  assert.equal(await setup.evaluate((node) => node.open), true);
  await setup.locator("summary").click();
  await page.locator(".tcatalog-filters button").filter({ hasText: "Поддержка" }).click();
  assert.equal(await page.locator(".tcard").count(), 2);
  await page.locator(".tcatalog-filters button").filter({ hasText: "Все решения" }).click();
  const look = page.locator(".tcard.is-focused .tcard-look");
  await look.click();
  const simulator = page.locator(".tcatalog-preview-root .simulator");
  await simulator.waitFor();
  const before = await page.locator(".sim-line").count();
  await page.locator(".sim-button:not(:disabled)").first().click();
  assert((await page.locator(".sim-line").count()) > before, "Simulator must run a real scenario branch");
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  assert.equal(await page.locator(".tcatalog-preview-root").count(), 0);
  assert.equal(await look.evaluate((node) => node === document.activeElement), true, "Closing preview restores focus");
}

try {
  for (const [width, height] of [[1440, 1000], [390, 844], [320, 720]]) {
    const { page, context } = await open(width, height);
    const columns = width > 900 ? 4 : 2;
    for (const grid of [".hub-v2-kit-grid", ".hub-v2-price-grid"]) {
      assert.equal(await page.locator(grid).evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(" ").length), columns);
      assert.equal(await page.locator(`${grid} > *`).count(), 4);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `No horizontal overflow at ${width}px`);
    assert.equal(await page.locator(".hub-v2-content > section").first().getAttribute("class"), "hub-v2-guide");
    assert.equal(await page.locator(".hub-v2-content > section").last().getAttribute("id"), "hub-pricing");
    await page.locator('.hub-v2-header a[href="#hub-pricing"]').click();
    await page.waitForFunction(() => { const box = document.getElementById("hub-pricing").getBoundingClientRect(); return box.top < innerHeight && box.bottom > 0; });
    // Wait for the anchor's smooth scroll to settle before capturing its destination.
    await page.evaluate(() => new Promise((resolve) => {
      let previous = scrollY;
      let stableSince = performance.now();
      const tick = () => {
        if (scrollY !== previous) { previous = scrollY; stableSince = performance.now(); }
        if (performance.now() - stableSince >= 250) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }));
    await page.screenshot({ path: fileURLToPath(new URL(`hub-pricing-${width}.png`, output)), fullPage: false });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: fileURLToPath(new URL(`hub-${width}.png`, output)), fullPage: true });
    await carouselCheck(page);
    await catalogCheck(page);
    await originalUnchanged(page);
    console.log(`PASS ${width}px: layout ${columns} columns, section order, tariff anchor, no overflow, catalogue search/filter/reset/simulator`);
    if (width === 1440) {
      for (const kit of ["bot", "bot-app", "bot-app-site", "site"]) {
        await page.goto(`${base}/hub`);
        await page.locator(`.hub-v2-kit-${kit}`).click();
        const editor = kit === "bot" ? ".flow-screen" : ".builder";
        await page.locator(editor).waitFor();
        const draftId = new URL(page.url()).searchParams.get("draft");
        assert.match(draftId ?? "", /^[a-f0-9-]{36}$/);
        const key = `kira-preview-${userId}-${draftId}-project`;
        assert.equal(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).kit, key), kit);
        if (kit !== "bot") {
          page.once("dialog", (dialog) => dialog.accept(`QA ${kit} сохранён`));
          await page.locator(".project-switcher").click();
          await page.waitForFunction(({ key, name }) => JSON.parse(localStorage.getItem(key)).name === name, { key, name: `QA ${kit} сохранён` });
        } else {
          await page.locator('.react-flow__node').filter({ has: page.locator('.flow-node-body') }).nth(1).click();
          const textarea = page.locator(".flow-screen .inspector textarea").first();
          await textarea.fill("QA сценарий сохранён");
          await page.waitForFunction((key) => localStorage.getItem(key)?.includes("QA сценарий сохранён"), `kira-preview-${userId}-${draftId}-flow`);
        }
        await page.waitForTimeout(1200); // Covers the cloud autosave debounce if it regresses.
        await originalUnchanged(page);
        await page.reload();
        await page.locator(editor).waitFor();
        if (kit !== "bot") assert.match(await page.locator(".project-switcher").innerText(), /QA .* сохранён/);
        else assert.match(await page.locator(".flow-screen").innerText(), /QA сценарий сохранён/);
        await originalUnchanged(page);
        console.log(`PASS free ${kit}: one occupied account slot, actual editing, local persistence after reload, no API writes`);
      }
      await page.goto(`${base}/hub`);
      await page.locator(".tcard-use").first().click();
      await page.locator(".flow-screen").waitFor();
      assert(new URL(page.url()).searchParams.get("draft"));
      await originalUnchanged(page);
      console.log("PASS template Use opens an isolated editable scenario without an API write");
    }
    await page.goto(base);
    await page.locator('.tcard').first().waitFor();
    await carouselCheck(page);
    await page.locator('.tcatalog-pagination').scrollIntoViewIfNeeded();
    await page.screenshot({ path: fileURLToPath(new URL(`landing-carousel-${width}.png`, output)), fullPage: false });
    await page.getByRole('button', { name: 'Посмотреть все (18)', exact: true }).click();
    assert.equal(await page.locator('.tcard').count(), 18);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    console.log(`PASS ${width}px: landing and hub cyclic arrows, all 18 reachable, expand/collapse, mobile swipe, brand and prices`);
    await context.close();
  }
  assert.deepEqual(errors, [], "No unhandled browser errors");
  assert.deepEqual(unexpectedReads, [], "All API routes must be explicitly mocked");
  console.log("PASS start hub regression: no unhandled browser errors or unexpected network requests");
} finally {
  await browser.close();
}
