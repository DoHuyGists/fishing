import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from 'playwright-core';

const css = readFileSync(new URL('../src/styles/theme.css', import.meta.url), 'utf8');
const paletteSource = readFileSync(new URL('../src/utils/themePalette.ts', import.meta.url), 'utf8');
const palette = Object.fromEntries([...css.matchAll(/--color-([a-z]+): (#[\da-f]{6});/g)].map(([, key, value]) => [key, value]));
for (const [key, value] of Object.entries(palette)) assert.ok(paletteSource.includes(`${key}: '${value}'`), `${key} palette mismatch`);
const luminance = rgb => rgb.map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
for (const foreground of ['content', 'accent', 'sky', 'danger', 'special']) {
  for (const background of ['primary', 'surface', 'white']) {
    const ratio = contrast(rgb(palette[foreground]), rgb(palette[background]));
    assert.ok(ratio >= 4.5, `${foreground}/${background}: ${ratio.toFixed(2)}`);
  }
}
for (const background of ['accent', 'sky', 'danger', 'special']) {
  assert.ok(contrast(rgb(palette.white), rgb(palette[background])) >= 4.5, `white/${background}`);
}
assert.ok(contrast(rgb(palette.content), rgb(palette.gold)) >= 4.5, 'currency text/gold');

const executablePath = process.env.THEME_TEST_BROWSER ?? [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium',
].find(existsSync);
assert.ok(executablePath, 'Set THEME_TEST_BROWSER to an installed Chromium browser.');
const server = await createServer({ configFile: false, envDir: false, appType: 'custom',
  server: { host: '127.0.0.1', port: 0, hmr: false },
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://theme-test.supabase.co'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key') },
  plugins: [vue(), tailwindcss(), {
    name: 'theme-contrast-fixture',
    configureServer(instance) {
      instance.middlewares.use('/__theme', (_req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<!doctype html><html class="ocean-theme"><body><div id="app"></div><script type="module" src="/__theme_fixture.ts"></script></body></html>');
      });
    },
    resolveId(id) { if (id === '/__theme_fixture.ts') return id; },
    load(id) {
      if (id !== '/__theme_fixture.ts') return;
      return `
        import { createApp, h } from 'vue';
        import { createPinia } from 'pinia';
        import FeatureTable from '/src/components/player/player-world-map/FeatureTable.vue';
        import Tab from '/src/components/shared/Tab.vue';
        import Pagination from '/src/components/shared/Pagination.vue';
        import Hint from '/src/components/shared/Hint.vue';
        import { useFeatureAvailabilityStore } from '/src/stores/player-feature-availability-store.ts';
        import { FEATURE_CATALOG } from '/src/data/featureAvailability.ts';
        import { i18n } from '/src/i18n/index.ts';
        import '/src/styles/index.css';
        import '/src/styles/story.css';
        const pinia = createPinia();
        const features = useFeatureAvailabilityStore(pinia);
        features.ready = true;
        features.flags = Object.fromEntries(FEATURE_CATALOG.map(f => [f.key, { feature_key: f.key, enabled: true }]));
        window.themeTest = { features };
        const app = createApp({ render: () => h('div', { class: 'bg-primary text-content p-4 flex gap-6' }, [
          h(FeatureTable),
          h('div', { class: 'w-96 bg-surface p-4' }, [
            h(Tab, { tabs: [{ key: 'a', label: 'Active', badge: 2 }, { key: 'b', label: 'Inactive', badge: 3 }] }),
            h(Pagination, { page: 1, total: 20, pageSize: 10 }),
            h(Hint, { text: 'Help' }),
            h('button', { class: 'ocean-primary-action' }, 'Action'),
            h('div', { class: 'story-view' }, [
              h('button', { class: 'story-choice' }, 'Choice'),
              h('button', { class: 'story-hud-button' }, 'HUD'),
            ]),
          ]),
        ]) });
        app.use(pinia); app.use(i18n); app.mount('#app');
      `;
    },
  }],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0] + '__theme');
  await page.locator('.lobby-menu__button').first().waitFor();
  await page.evaluate(() => document.getAnimations().forEach(animation => animation.finish()));
  async function check(selector, background = 'primary') {
    const colors = await page.locator(selector).evaluateAll(elements => elements.map(el => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d');
      context.fillStyle = getComputedStyle(el).color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
    }));
    assert.ok(colors.length, `${selector} missing`);
    for (const color of colors) {
      const ratio = contrast(color, rgb(palette[background]));
      assert.ok(ratio >= 4.5, `${selector} on ${background}: ${ratio.toFixed(2)}`);
    }
  }
  await check('.lobby-menu__button');
  await check('.shared-tabs__tab[aria-selected="false"]');
  await check('.shared-tabs__tab[aria-selected="true"]', 'accent');
  await check('.shared-tabs__badge', 'gold');
  await check('.shared-pagination button');
  await check('.ocean-primary-action', 'gold');
  await check('.story-choice', 'content');
  await check('.story-hud-button', 'content');
  await page.locator('.story-choice').hover();
  await page.waitForTimeout(200);
  await check('.story-choice');
  await page.locator('.lobby-menu__button').first().hover();
  await page.waitForTimeout(200);
  await check('.lobby-menu__button');
  await page.locator('.shared-tabs__tab[aria-selected="true"]').hover();
  await page.waitForTimeout(200);
  await check('.shared-tabs__tab[aria-selected="true"]', 'white');
  await page.locator('.shared-tabs__tab[aria-selected="false"]').click();
  await page.mouse.move(1200, 800);
  await page.waitForTimeout(200);
  await check('.shared-tabs__tab[aria-selected="true"]', 'accent');
  await page.locator('.lobby-menu__button').first().focus();
  const outline = await page.locator('.lobby-menu__button').first().evaluate(el => getComputedStyle(el).outlineColor);
  const outlineRgb = outline.match(/[\d.]+/g).slice(0, 3).map(Number);
  assert.ok(contrast(outlineRgb, rgb(palette.primary)) >= 3, 'focus indicator contrast');
  await page.evaluate(() => { window.themeTest.features.flags.story = { feature_key: 'story', enabled: false }; });
  await check('.lobby-menu__button[data-locked="true"]');
  assert.deepEqual(errors, []);
  if (process.env.THEME_TEST_SCREENSHOT) await page.screenshot({ path: process.env.THEME_TEST_SCREENSHOT, fullPage: true });
  console.log('PASS: synchronized palette, text contrast >= 4.5:1, focus >= 3:1, actual menu/tab/pagination/action styles and interaction states.');
} finally {
  await browser?.close();
  await server.close();
}
