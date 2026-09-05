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
    const card = await page.locator('.tcard.is-focused').boundingBox();
    if (width >= 1200) {
      assert(card.height < 460, `Compact card at ${width}: ${card.height}`);
      assert(card.y + card.height <= height, `Card actions fit viewport at ${width}: ${card.y + card.height}`);
    }
    await page.screenshot({ path: fileURLToPath(new URL(`compact-carousel-${width}.png`, output)) });
    const sliding = await page.evaluate(async () => {
      document.querySelector('[aria-label="Следующие решения"]').click();
      await new Promise(requestAnimationFrame);
      return document.querySelector('.tcatalog-grid').getAnimations({ subtree: true }).filter(a => a.effect.getKeyframes().some(k => k.translate)).length;
    });
    assert(sliding > 0, 'Real positional animation runs between cards');
    await page.evaluate(() => Promise.all(document.querySelector('.tcatalog-grid').getAnimations({ subtree: true }).map(a => a.finished.catch(() => {}))));
    await page.getByRole('button', { name: 'Посмотреть все (18)', exact: true }).click();
    assert.equal(await page.locator('.tcard').count(), 18);
    if (width <= 480) assert.equal(await page.locator('.tcatalog-grid').evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length), 1);
    console.log(`PASS ${width}x${height}: hero, prices, compact cards, sliding animation, expanded layout`);
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
  await page.getByRole('button', { name: 'Следующие решения' }).click();
  assert.equal(await page.locator('.tcatalog-grid').evaluate(e => e.getAnimations({ subtree: true }).filter(a => a.effect.getKeyframes().some(k => k.translate)).length), 0);
  console.log('PASS reduced motion: no slide animation, video can be explicitly played and paused');
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
