// Read-only browser regression: local assets only, no account or production APIs.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.KIRA_BROWSER_MODULE ?? 'playwright');
const base = process.env.KIRA_QA_URL ?? 'http://127.0.0.1:5174';
const output = new URL('../preview/qa/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  for (const [width, height] of [[1366,768], [1280,720], [1920,1080], [768,1024], [390,844], [320,720]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 600, hasTouch: width < 600 });
    await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.evaluate(() => document.fonts.ready);
    assert(await page.locator('#pricing').evaluate(node => Boolean(node.compareDocumentPosition(document.getElementById('kinds')) & Node.DOCUMENT_POSITION_FOLLOWING)), 'Costs precede solutions on the landing');
    const metrics = await page.evaluate(() => {
      const box = s => document.querySelector(s).getBoundingClientRect().toJSON();
      return { hero: box('.hero'), video: box('.hero video'), price: box('.hero .price-summary'), title: box('.hero h1'), priceFont: parseFloat(getComputedStyle(document.querySelector('.hero .price-summary strong')).fontSize), overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.equal(metrics.overflow, false, `No overflow at ${width}`);
    if (width >= 1200) {
      assert(metrics.price.bottom <= height, `All prices visible at ${width}: ${metrics.price.bottom}`);
      assert(metrics.video.top < 250 && metrics.video.bottom < height, 'Video is in the first viewport');
      assert(metrics.priceFont >= 28, 'Hosting prices remain readable');
    }
    if (width === 768) assert(metrics.video.top < metrics.price.top, 'Tablet video does not drop below prices');
    await page.screenshot({ path: fileURLToPath(new URL(`compact-hero-${width}.png`, output)) });
    await page.evaluate(() => document.getElementById('kinds').scrollIntoView({ behavior: 'instant' }));
    const card = await page.locator('.tcard-slot:not([inert]) .tcard.is-focused').first().boundingBox();
    if (width >= 1200) {
      assert(card.height < 460, `Compact card at ${width}: ${card.height}`);
      assert(card.y + card.height <= height, `Card actions fit viewport at ${width}: ${card.y + card.height}`);
    }
    await page.screenshot({ path: fileURLToPath(new URL(`compact-carousel-${width}.png`, output)) });
    // The rail moves by scrolling, so movement is measured on the rail itself.
    const before = await page.locator('.tcatalog-rail').evaluate((node) => node.scrollLeft);
    await page.getByRole('button', { name: 'Следующее решение', exact: true }).click();
    await page.waitForFunction((from) => Math.abs(document.querySelector('.tcatalog-rail').scrollLeft - from) > 40, before);
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Посмотреть все (18)', exact: true }).click();
    assert.equal(await page.locator('.tcatalog-grid .tcard').count(), 18);
    if (width <= 480) assert.equal(await page.locator('.tcatalog-grid').evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length), 1);
    console.log(`PASS ${width}x${height}: hero, prices, compact cards, rail scrolls, expanded layout`);
    await context.close();
  }
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(base);
  assert(await page.locator('.hero video').evaluate(e => e.paused), 'Reduced motion starts video paused');
  await page.getByRole('button', { name: 'Воспроизвести видео' }).click();
  await page.getByRole('button', { name: 'Приостановить видео' }).waitFor();
  await page.getByRole('button', { name: 'Приостановить видео' }).click();
  assert(await page.locator('.hero video').evaluate(e => e.paused), 'Explicit pause works');
  await page.getByRole('button', { name: 'Следующее решение', exact: true }).click();
  assert.equal(await page.locator('.tcatalog-rail .tcard').first().evaluate((node) => getComputedStyle(node).transitionDuration), '0s', 'Reduced motion drops the focus transition');
  console.log('PASS reduced motion: no card transition, video can be explicitly played and paused');
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const hub = await mobile.newPage();
  hub.on('pageerror', error => errors.push(error.message));
  await hub.goto(`${base}/hub`);
  await hub.evaluate(() => document.fonts.ready);
  const video = hub.locator('#hub-video video');
  assert(await video.evaluate(node => node.paused), 'Hub reduced motion starts on the poster');
  const box = await video.boundingBox();
  assert(box.width >= 388 && box.height >= 468, 'Hub instruction fills the phone in 4:5');
  assert(await hub.locator('#hub-pricing').evaluate(node => Boolean(node.compareDocumentPosition(document.getElementById('hub-templates')) & Node.DOCUMENT_POSITION_FOLLOWING)));
  assert.equal(await hub.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await hub.screenshot({ path: fileURLToPath(new URL('first-visit-hub-390.png', output)) });
  await hub.getByRole('button', { name: 'Смотреть видеоинструкцию', exact: true }).click();
  await hub.waitForFunction(() => { const v = document.querySelector('#hub-video video'); return !v.paused && v.readyState >= 2; });
  await hub.getByRole('button', { name: 'Приостановить видео', exact: true }).click();
  assert(await video.evaluate(node => node.paused), 'The big poster button really plays the video, and pause works');
  console.log('PASS first-visit mobile hub: prices before solutions, full-width video, poster playback and pause');
  await mobile.close();
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
