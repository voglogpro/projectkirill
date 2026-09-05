// Isolated browser QA: no live accounts, tokens, billing or project writes.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const engines = require(process.env.KIRA_BROWSER_MODULE ?? 'playwright');
const engine = process.env.KIRA_QA_ENGINE ?? 'chromium';
const browser = await engines[engine].launch({ headless: true });
const base = process.env.KIRA_QA_URL ?? 'http://127.0.0.1:5174';
const output = new URL('../preview/qa/', import.meta.url);
await mkdir(output, { recursive: true });
const errors = [];
const project = {
  id: '11111111-1111-4111-8111-111111111111', name: 'Очень длинное название моего проекта для проверки телефона', status: 'draft', plan: 'free', kit: 'bot',
  activePageId: '22222222-2222-4222-8222-222222222222',
  pages: [{ id: '22222222-2222-4222-8222-222222222222', title: 'Главная', slug: 'home', blocks: [] }],
};

async function noOverflow(page, label) {
  await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1, undefined, { timeout: 3000 }).catch(() => undefined);
  const sizes = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  if (sizes.document > sizes.viewport + 1) console.log(await page.evaluate(() => Array.from(document.querySelectorAll('body *')).map((element) => ({ tag: element.tagName, className: element.className, x: element.getBoundingClientRect().x, right: element.getBoundingClientRect().right, width: element.getBoundingClientRect().width, scroll: element.scrollWidth, overflow: getComputedStyle(element).overflow, before: getComputedStyle(element, '::before').content })).filter((item) => item.width > 0 && (item.right > innerWidth + 1 || item.scroll > item.width + 1)).slice(0, 20)));
  assert.ok(sizes.document <= sizes.viewport + 1, `${label}: ${JSON.stringify(sizes)}`);
}

try {
  for (const width of [320, 375, 390, 430]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/v1/')) return route.fulfill({ status: 404, json: { error: { message: 'QA blocks external writes' } } });
      if (url.origin !== new URL(base).origin) return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript((value) => {
      const kit = new URLSearchParams(location.search).get('kit');
      localStorage.setItem('tma-studio-project-v2:guest', JSON.stringify({ ...value, kit: kit ?? value.kit }));
    }, project);
    await page.goto(`${base}/workspace`);
    await page.locator('.workspace').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await noOverflow(page, `${engine} workspace ${width}`);
    assert.equal(await page.locator('.mobile-nav button').count(), 4);
    const barBackground = await page.locator('.mobile-workspace-bar').evaluate((element) => getComputedStyle(element).backgroundColor);
    assert.notEqual(barBackground, 'rgba(255, 255, 255, 0.96)', 'Old white chrome must not return');
    const selectStyle = await page.locator('.mobile-workspace-bar select').evaluate((element) => { const style = getComputedStyle(element); return { appearance: style.appearance, scheme: style.colorScheme, background: style.backgroundColor, color: style.color }; });
    assert.equal(selectStyle.appearance, 'none', 'Safari must not paint a white native select over its dark background');
    assert.equal(selectStyle.scheme, 'dark');
    const luminance = (color) => { const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map((channel) => { const value = channel / 255; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; }); return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722; };
    const light = Math.max(luminance(selectStyle.color), luminance(selectStyle.background));
    const dark = Math.min(luminance(selectStyle.color), luminance(selectStyle.background));
    assert.ok((light + 0.05) / (dark + 0.05) >= 4.5, `Project select must have readable contrast: ${JSON.stringify(selectStyle)}`);
    await page.getByRole('button', { name: 'Ещё', exact: true }).click();
    const menu = page.getByRole('dialog', { name: 'Ваш проект' });
    await menu.waitFor();
    await noOverflow(page, `Menu ${width}`);
    assert.equal(await menu.getByRole('button', { name: 'Mini App', exact: true }).count(), 0, 'Text bot should not expose a Mini App tab');
    await menu.getByRole('button', { name: 'Настройки', exact: true }).click();
    await page.getByRole('heading', { name: 'Настройки проекта' }).waitFor();
    await noOverflow(page, `Settings ${width}`);
    await page.getByRole('button', { name: 'Ещё', exact: true }).click();
    await menu.getByRole('button', { name: 'Помощь', exact: true }).click();
    await page.getByRole('heading', { name: 'Запуск без технических настроек' }).waitFor();
    await noOverflow(page, `Help ${width}`);
    await page.getByRole('button', { name: 'Ещё', exact: true }).click();
    await page.keyboard.press('Escape');
    assert.equal(await menu.isVisible(), false);
    assert.equal(await page.getByRole('button', { name: 'Ещё', exact: true }).evaluate((element) => element === document.activeElement), true);
    await page.locator('.mobile-nav').getByRole('button', { name: 'Главная', exact: true }).click();
    await page.screenshot({ path: fileURLToPath(new URL(`workspace-${engine}-${width}.png`, output)) });
    await page.locator('.mobile-nav').getByRole('button', { name: 'Редактор', exact: true }).click();
    await page.waitForURL('**/flow');
    await page.goto(`${base}/workspace?kit=site`);
    await page.getByRole('button', { name: 'Ещё', exact: true }).click();
    assert.equal(await menu.getByRole('button', { name: 'Сценарий', exact: true }).count(), 0, 'Site menu must not offer a text-bot canvas');
    await menu.getByRole('button', { name: 'Закрыть меню проекта' }).click();
    await page.locator('.status-banner').getByRole('button', { name: 'Продолжить' }).click();
    await page.waitForURL('**/builder');

    await page.goto(base);
    await page.getByRole('button', { name: 'Войти', exact: true }).first().click();
    const auth = page.getByRole('dialog', { name: 'С возвращением' });
    await auth.waitFor();
    await noOverflow(page, `Login ${width}`);
    assert.equal(await page.locator('.auth-steps').isVisible(), false);
    assert.equal(await page.locator('.auth-fields input[name=email]').evaluate((element) => getComputedStyle(element).fontSize), '16px');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'auth-title', 'Mobile login should not force open the keyboard');
    const demo = auth.getByRole('button', { name: 'Открыть демо без регистрации' });
    await demo.focus();
    await page.keyboard.press('Tab');
    assert.equal(await auth.getByRole('button', { name: 'Закрыть окно' }).evaluate((element) => element === document.activeElement), true, 'Tab must remain in the dialog');
    await auth.getByRole('button', { name: 'Нет аккаунта? Зарегистрироваться' }).click();
    await page.getByRole('heading', { name: 'Создайте аккаунт' }).waitFor();
    await page.getByRole('button', { name: 'Показать пароль' }).click();
    assert.equal(await page.locator('input[name=password]').getAttribute('type'), 'text');
    await noOverflow(page, `Registration ${width}`);
    await page.screenshot({ path: fileURLToPath(new URL(`auth-${engine}-${width}.png`, output)) });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.auth-modal').count(), 0);
    await context.close();
    console.log(`${engine}: workspace, menu, login and registration ${width}px passed`);
  }
  const desktop = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await desktop.route('**/v1/**', (route) => route.fulfill({ status: 404, json: { error: { message: 'QA only' } } }));
  const desktopPage = await desktop.newPage();
  await desktopPage.addInitScript((value) => localStorage.setItem('tma-studio-project-v2:guest', JSON.stringify({ ...value, name: 'Мой проект' })), project);
  await desktopPage.goto(`${base}/workspace`);
  await desktopPage.locator('.app-sidebar').waitFor();
  await noOverflow(desktopPage, 'Desktop cabinet');
  assert.equal(await desktopPage.locator('.mobile-nav').isVisible(), false);
  assert.equal(await desktopPage.locator('.app-sidebar').isVisible(), true);
  await desktopPage.screenshot({ path: fileURLToPath(new URL(`workspace-${engine}-1366.png`, output)) });
  await desktop.close();
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
