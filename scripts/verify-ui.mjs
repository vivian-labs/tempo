import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const url = process.env.TEMPO_UI_URL || 'http://127.0.0.1:4173';
let server;
if (!process.env.TEMPO_UI_URL && !process.env.TEMPO_CDP) {
  server = spawn(
    process.execPath,
    [
      'node_modules/vite/bin/vite.js',
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      '4173',
    ],
    { stdio: 'ignore' },
  );
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
}
const results = [],
  errors = [];
let browser;
try {
  browser = process.env.TEMPO_CDP
    ? await chromium.connectOverCDP(process.env.TEMPO_CDP)
    : await chromium.launch({
        headless: true,
        ...(process.env.TEMPO_CHROME
          ? { executablePath: process.env.TEMPO_CHROME }
          : {}),
      });
  const page = process.env.TEMPO_CDP
    ? browser.contexts()[0].pages()[0]
    : await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', (e) => errors.push(e.message));
  if (!process.env.TEMPO_CDP) await page.goto(url);
  await page.locator('#time-readout').waitFor();
  if (process.env.TEMPO_CDP) await page.evaluate(async () => {
    const invoke = window.__TAURI_INTERNALS__.invoke;
    await invoke('dispatch', {action: {type: 'dismiss'}});
    await invoke('dispatch', {action: {type: 'reset'}});
  });
  async function check(name, fn) {
    await fn();
    results.push(name);
    console.log('PASS', name);
  }
  async function duration(value) {
    await page.locator('#custom-duration').click();
    await page.locator('#duration-input').fill(value);
    await page.getByRole('button', { name: '设置时长', exact: true }).click();
  }
  await check('mechanical dial and depletion sector', async () => {
    await page.getByRole('button', { name: '倒计时', exact: true }).click();
    await page.getByRole('button', { name: '机械', exact: true }).click();
    await duration('0:08');
    assert.match(await page.locator('#time-readout').innerText(), /00:08/);
    assert.ok(await page.locator('#time-sector').getAttribute('d'));
  });
  await check('pause, stable remaining time and resume', async () => {
    await page.locator('#start').click();
    await page.waitForFunction(() => document.querySelector('#time-readout')?.textContent !== '00:08', {timeout: 4000});
    await page.locator('#start').click();
    await page.waitForFunction(() => document.querySelector('#start')?.textContent?.includes('继续专注'));
    const value = await page.locator('#time-readout').innerText();
    assert.notEqual(value, '00:08');
    await page.waitForTimeout(1200);
    assert.equal(await page.locator('#time-readout').innerText(), value);
    await page.locator('#start').click();
  });
  await check('timer survives view changes and rings once', async () => {
    await page.getByRole('button', { name: '翻页', exact: true }).click();
    await page
      .locator('#ring-dialog')
      .waitFor({ state: 'visible', timeout: 12000 });
    await page.getByRole('button', { name: '结束铃声', exact: true }).click();
    await page.waitForTimeout(1300);
    assert.equal(await page.locator('#ring-dialog').isVisible(), false);
  });
  await check('invalid duration is rejected', async () => {
    await page.locator('#custom-duration').click();
    await page.locator('#duration-input').fill('25:99');
    await page.getByRole('button', { name: '设置时长', exact: true }).click();
    assert.ok(await page.locator('#duration-error').innerText());
    await page.getByRole('button', { name: '取消', exact: true }).click();
  });
  await check('split-flap settles after time changes', async () => {
    await page.getByRole('button', { name: '时钟', exact: true }).click();
    await page.waitForTimeout(1400);
    assert.equal(await page.locator('.flip-card').count(), 3);
    assert.match(
      await page.locator('.flip-card').first().getAttribute('aria-label'),
      /\d\d/,
    );
  });
  await check('settings keyboard access and three themes', async () => {
    await page
      .getByRole('button', { name: '声音与外观设置', exact: true })
      .click();
    await page.getByRole('button', { name: '暖白', exact: true }).click();
    await page.waitForTimeout(200);
    assert.equal(
      await page.locator('.app-shell').getAttribute('data-theme'),
      'light',
    );
    await page.getByRole('button', { name: '纯黑', exact: true }).click();
    await page.waitForTimeout(200);
    assert.equal(
      await page.locator('.app-shell').getAttribute('data-theme'),
      'black',
    );
    await page.getByRole('button', { name: '墨黑', exact: true }).click();
    await page.keyboard.press('Escape');
    assert.equal(
      await page
        .getByRole('dialog', { name: '声音与外观设置', exact: true })
        .isVisible(),
      false,
    );
  });
  await check('alarm controls retain selected time', async () => {
    await page.getByRole('button', { name: '闹钟', exact: true }).click();
    await page.locator('#alarm-time').fill('23:58');
    await page.locator('#alarm-time').blur();
    await page.locator('#alarm-toggle').click();
    await page.waitForTimeout(1200);
    assert.equal(await page.locator('#alarm-time').inputValue(), '23:58');
    assert.equal(await page.locator('#alarm-toggle').innerText(), '关闭闹钟');
    await page.locator('#alarm-toggle').click();
  });
  await page.getByRole('button', { name: '倒计时', exact: true }).click();
  await duration('25:00');
  await mkdir('test-results', { recursive: true });
  // CDP viewport emulation is useful for visual layout; native window APIs are checked separately.
  for (const [width, height] of [
    [1600, 1120],
    [1440, 900],
    [620, 670],
  ]) {
    await page.setViewportSize({ width, height });
    for (const view of ['机械', '翻页']) {
      await page.getByRole('button', { name: view, exact: true }).click();
      await page.waitForTimeout(350);
      const bounds = await page.evaluate(() => ({
        w: innerWidth,
        h: innerHeight,
        sw: document.documentElement.scrollWidth,
        sh: document.documentElement.scrollHeight,
      }));
      assert.ok(
        bounds.sw <= bounds.w && bounds.sh <= bounds.h,
        JSON.stringify(bounds),
      );
      await page.screenshot({
        path: `test-results/${width}-${height}-${view === '机械' ? 'dial' : 'flip'}.png`,
      });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole('button', { name: '声音与外观设置', exact: true })
    .click();
  await page.screenshot({ path: 'test-results/settings.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '机械', exact: true }).click();
  await duration('0:50');
  await page.locator('#start').click();
  await page.waitForTimeout(1000);
  assert.match(
    await page.locator('.app-shell').getAttribute('class'),
    /urgent/,
  );
  await page.screenshot({ path: 'test-results/urgent.png' });
  await page.locator('#start').click();
  await page.locator('#reset').click();
  assert.deepEqual(errors, []);
  await writeFile(
    'test-results/ui-report.json',
    JSON.stringify(
      {
        environment: process.env.TEMPO_CDP
          ? 'native Windows WebView2'
          : 'browser preview',
        checks: results,
        screenshotCount: 8,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ passed: results.length, screenshots: 8, errors }),
  );
} finally {
  if (browser) await browser.close();
  if (server) server.kill();
}
