// Local-only visual and interaction regression. WebKit is not a physical iPhone.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const engine = process.env.KIRA_QA_ENGINE ?? 'chromium';
const playwright = require(process.env.KIRA_BROWSER_MODULE ?? 'playwright');
const base = process.env.KIRA_QA_URL ?? 'http://127.0.0.1:5174';
const output = new URL('../preview/qa/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await playwright[engine].launch({ headless: true });
const errors = [];
try {
  for (const [width, height] of [[320,568], [375,667], [390,844], [393,659], [414,896], [430,932], [844,390], [1024,768], [1366,768]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 900, hasTouch: width < 900, reducedMotion: 'reduce' });
    await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('.hero .price-summary,.hero-mobile-price').count(), 0);
    const geometry = await page.evaluate(() => {
      const r = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
      return { overflow: document.documentElement.scrollWidth > innerWidth, header: r('.landing-nav'), cta: r('.hero-actions button'), video: r('.hero video'), pieces: r('.piece-grid') };
    });
    assert.equal(geometry.overflow, false, `${engine} ${width}: page overflow`);
    assert(geometry.cta.x >= 0 && geometry.cta.right <= width && geometry.cta.height >= 44, 'Primary action fits and is touch sized');
    if (width <= 430) {
      assert(geometry.header.height <= 72 && geometry.cta.bottom <= height, 'Compact first-screen navigation and CTA');
      assert(geometry.video.width >= width - 34 && geometry.video.x >= 0 && geometry.video.right <= width, 'Readable video without horizontal bleed');
      assert(geometry.pieces.height < 320, 'Three product summaries are compact');
    }
    if (width <= 1150) {
      const summary = page.locator('.landing-mobile-menu > summary');
      await summary.click();
      assert(await page.locator('.landing-mobile-menu').evaluate(e => e.open));
      const menu = page.locator('nav[aria-label="Мобильная навигация"]');
      for (const link of await menu.locator('a,button').all()) {
        const box = await link.boundingBox();
        assert(box.x >= 0 && box.x + box.width <= width && box.height >= 44, 'Every menu item fits and has a comfortable target');
      }
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.landing-mobile-menu').evaluate(e => e.open), false);
      assert(await summary.evaluate(e => document.activeElement === e), 'Escape restores focus');
      await summary.click();
      await menu.getByRole('link', { name: 'Тарифы', exact: true }).click();
      assert.equal(await page.locator('.landing-mobile-menu').evaluate(e => e.open), false);
      await page.waitForFunction(() => document.getElementById('pricing').getBoundingClientRect().top < 160);
      const tariffs = await page.locator('#pricing').boundingBox();
      assert(tariffs.y >= 65, 'Tariff heading is not underneath the sticky header');
    }
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: fileURLToPath(new URL(`mobile-design-${engine}-${width}.png`, output)) });
    if (width === 390) {
      await page.locator('#pieces').screenshot({ path: fileURLToPath(new URL(`mobile-pieces-${engine}.png`, output)) });
      // Text enlargement must not produce a horizontal page. Native zoom remains enabled.
      await page.addStyleTag({ content: '.landing { font-size: 200%; } .landing .landing-nav a,.landing .landing-nav button,.landing .landing-nav summary { font-size: 18px; }' });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    if (width === 320) {
      await page.getByRole('button', { name: 'Войти', exact: true }).first().click();
      const modal = page.getByRole('dialog', { name: 'С возвращением' });
      await modal.waitFor();
      // A shortened visual viewport approximates keyboard space, not an actual OS keyboard.
      await page.setViewportSize({ width, height: 380 });
      const email = modal.locator('input[name="email"]');
      await email.focus();
      await email.scrollIntoViewIfNeeded();
      assert.equal(await email.evaluate(e => e.getBoundingClientRect().left >= 0 && e.getBoundingClientRect().right <= innerWidth), true);
      const submit = modal.locator('button[type="submit"]');
      await submit.scrollIntoViewIfNeeded();
      const submitBox = await submit.boundingBox();
      assert(submitBox.y >= 0 && submitBox.y + submitBox.height <= 380, 'Auth submit remains reachable with a short viewport');
      await page.keyboard.press('Escape');
      assert.equal(await modal.isVisible(), false);
    }
    console.log(`PASS ${engine} ${width}x${height}: layout, disclosure, focus, touch targets, pricing anchor`);
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
