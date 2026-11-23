import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from 'playwright-core';

const executablePath = process.env.HOME_BROWSER ?? [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium',
].find(existsSync);
assert.ok(executablePath, 'Set HOME_BROWSER to an installed Chromium browser.');

// Validate keys stored in presentation data as well as literal template references.
const data = readFileSync('src/data/home.ts', 'utf8');
for (const locale of ['vi', 'en']) {
  const messages = JSON.parse(readFileSync(`src/i18n/locales/${locale}.json`, 'utf8')).HomeView;
  for (const [, key] of data.matchAll(/"HomeView\.([^"]+)"/g)) {
    assert.ok(messages[key], `${locale}: missing HomeView.${key}`);
  }
}

const server = await createServer({
  configFile: false, envDir: false, appType: 'custom', cacheDir: 'node_modules/.vite-home-browser',
  server: { host: '127.0.0.1', port: 0, hmr: false },
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://home-test.supabase.co'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key'),
  },
  plugins: [vue(), tailwindcss(), {
    name: 'home-browser-fixture',
    configureServer(instance) {
      instance.middlewares.use('/__home', (_req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<!doctype html><html class="ocean-theme"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script type="module" src="/__home_fixture.ts"></script></body></html>');
      });
    },
    resolveId(id) { if (id === '/__home_fixture.ts') return id; },
    load(id) {
      if (id !== '/__home_fixture.ts') return;
      return `
        import { createApp, h } from 'vue';
        import { createPinia } from 'pinia';
        import { createMemoryHistory, createRouter, RouterView } from 'vue-router';
        import HomeView from '/src/views/HomeView.vue';
        import HomeLayout from '/src/layouts/HomeLayout.vue';
        import { useAuthStore } from '/src/stores/auth.ts';
        import { i18n } from '/src/i18n/index.ts';
        import '/src/styles/index.css';
        import '/src/styles/animation.css';
        const pinia = createPinia();
        const auth = useAuthStore(pinia);
        auth.initialized = true;
        const router = createRouter({ history: createMemoryHistory(), routes: [
          { path: '/', component: HomeLayout, children: [{ path: '', name: 'home', component: HomeView }] },
          { path: '/login', name: 'login', component: { render: () => h('div', { id: 'login-page' }, 'Login') } },
          { path: '/lobby', name: 'lobby', component: { render: () => h('div', { id: 'lobby-page' }, 'Lobby') } },
        ] });
        const app = createApp({ render: () => h(RouterView) });
        app.use(pinia); app.use(i18n); app.use(router);
        await router.push('/'); await router.isReady(); app.mount('#app');
        window.homeTest = { i18n, router, auth };
      `;
    },
  }],
});

let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const origin = server.resolvedUrls.local[0];
  await page.goto(origin + '__home');
  await page.getByRole('heading', { level: 1 }).waitFor();
  assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1);
  assert.equal(await page.locator('main h1, main h2, main h3, main p, main ul, main ol, main li').count(), 0);
  assert.equal(await page.locator('.home-play-link').first().getAttribute('href'), '/login');
  await page.waitForFunction(() => {
    const image = document.querySelector('.home-hero img');
    return image?.complete && image.naturalWidth > 0;
  });
  assert.equal(await page.locator('.home-hero > div').first().evaluate(el => getComputedStyle(el).position), 'absolute');

  const contrastChecks = await page.evaluate(() => {
    const context = document.createElement('canvas').getContext('2d');
    function rgb(color) {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
    }
    function luminance(channels) {
      return channels.map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    }
    function contrast(foreground, background) {
      const a = luminance(foreground), b = luminance(background);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    }
    const css = getComputedStyle(document.documentElement);
    const palette = key => rgb(css.getPropertyValue('--color-' + key).trim());
    const results = ['#home-intro-title', 'nav a', '.home-play-link', '[role="tab"]'].flatMap(selector =>
      [...document.querySelectorAll(selector)].map(el => {
        let background = getComputedStyle(el).backgroundColor;
        for (let parent = el.parentElement; background === 'rgba(0, 0, 0, 0)' && parent; parent = parent.parentElement) {
          background = getComputedStyle(parent).backgroundColor;
        }
        return { selector, ratio: contrast(rgb(getComputedStyle(el).color), rgb(background)) };
      })
    );
    // White is the worst possible underlying image pixel at the text's 88% shade.
    results.push({ selector: 'hero text over brightest image pixel', ratio: contrast(palette('white'), palette('content').map(channel => channel * 0.88 + 255 * 0.12)) });
    return results;
  });
  for (const { selector, ratio } of contrastChecks) assert.ok(ratio >= 4.5, `${selector}: contrast ${ratio.toFixed(2)}`);

  await page.keyboard.press('Tab');
  assert.equal(await page.locator('.home-skip-link').evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('main').evaluate(el => el === document.activeElement), true);

  const tabs = page.getByRole('tab');
  await tabs.nth(1).focus();
  assert.notEqual(await tabs.nth(1).evaluate(el => getComputedStyle(el).outlineStyle), 'none', 'Gallery keyboard focus must be visible.');
  await page.keyboard.press('ArrowRight');
  assert.equal(await tabs.nth(2).getAttribute('aria-selected'), 'true');
  assert.equal(await tabs.nth(2).evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('End');
  assert.equal(await tabs.nth(3).getAttribute('aria-selected'), 'true');
  await page.keyboard.press('ArrowRight');
  assert.equal(await tabs.nth(0).getAttribute('aria-selected'), 'true');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await tabs.nth(3).getAttribute('aria-selected'), 'true');
  await page.keyboard.press('Home');
  assert.equal(await tabs.nth(0).getAttribute('aria-selected'), 'true');
  for (const tab of await tabs.all()) {
    assert.equal(await page.locator('#' + await tab.getAttribute('aria-controls')).count(), 1);
  }
  assert.equal(await page.getByRole('tabpanel').count(), 1);

  await page.getByRole('combobox').selectOption('en');
  await page.getByRole('heading', { level: 1, name: /Cast a line/ }).waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.equal(await page.evaluate(() => localStorage.getItem('fishing.locale')), 'en');
  assert.equal(await tabs.nth(0).getAttribute('aria-selected'), 'true');
  assert.equal(await page.getByRole('tab', { name: 'Dawn', exact: true }).count(), 1);
  assert.equal(await page.getByText('A selection of species', { exact: true }).count(), 1);

  for (const locale of ['en', 'vi']) {
    await page.getByRole('combobox').selectOption(locale);
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      assert.equal(overflow, false, `${locale}: horizontal overflow at ${width}px`);
      await page.waitForFunction(expected => document.querySelectorAll('#home-species-slides [aria-hidden="false"] img').length === expected, width >= 1024 ? 3 : width >= 640 ? 2 : 1);
      assert.equal(await page.locator('#home-species-slides [aria-hidden="false"] img').count(), width >= 1024 ? 3 : width >= 640 ? 2 : 1, `${locale}: carousel cards at ${width}px`);
      for (const link of await page.locator('nav a, .home-play-link').all()) {
        const bounds = await link.boundingBox();
        assert.ok(bounds.height >= 44, `${locale}: undersized action at ${width}px`);
      }
    }
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const tab of await tabs.all()) {
    await tab.click();
    await page.waitForFunction(() => {
      const image = document.querySelector('[role="tabpanel"]:not([style*="display: none"]) img');
      return image?.complete && image.naturalWidth > 0;
    });
  }
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  await page.clock.install();
  const species = page.locator('#bo-suu-tap');
  const settleSlide = async () => {
    await species.locator('.home-species-track').evaluate(track => track.dispatchEvent(new TransitionEvent('transitionend', { propertyName: 'transform' })));
  };
  const activePage = async () => {
    await settleSlide();
    return species.locator('button[aria-current="true"]').getAttribute('aria-label');
  };
  await species.scrollIntoViewIfNeeded();
  await page.mouse.move(1, 1);
  await page.waitForFunction(() => document.querySelector('#bo-suu-tap span[aria-live]')?.getAttribute('aria-live') === 'off');
  await page.waitForFunction(() => [...document.querySelectorAll('#bo-suu-tap [aria-hidden="false"] img')].every(image => image.complete && image.naturalWidth > 0));
  assert.equal(await page.locator('#bo-suu-tap img').count(), 12, 'Loop includes cloned cards at both ends');
  assert.equal(await species.getByRole('img').count(), 3, 'Only the current carousel page is accessible');
  let before = await activePage();
  await page.clock.fastForward(2400);
  assert.equal(await activePage(), before, 'Carousel waits for the 2.5-second interval');
  await page.clock.fastForward(200);
  assert.notEqual(await activePage(), before, 'Visible carousel automatically advances');
  assert.equal(await species.locator('button[aria-current="true"]').getAttribute('aria-label'), 'Xem trang cá 2', 'Autoplay advances exactly one fish');
  assert.equal(await species.getByRole('img').count(), 3, 'Three fish remain accessible after advancing');

  await species.getByRole('img').first().hover();
  before = await activePage();
  await page.clock.fastForward(5100);
  assert.equal(await activePage(), before, 'Hover pauses autoplay');
  await page.mouse.move(1, 1);
  await species.getByRole('button', { name: 'Trang sau', exact: true }).focus();
  await species.getByRole('button', { name: 'Trang trước', exact: true }).focus();
  await page.clock.fastForward(5100);
  assert.equal(await activePage(), before, 'Focus within the carousel pauses autoplay');
  await page.evaluate(() => document.activeElement?.blur());

  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.clock.fastForward(5100);
  assert.equal(await activePage(), before, 'Hidden browser tabs pause autoplay');
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.clock.fastForward(5100);
  assert.notEqual(await activePage(), before, 'Autoplay resumes after visibility returns');

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => document.querySelector('#bo-suu-tap span[aria-live]')?.getAttribute('aria-live') === 'polite');
  before = await activePage();
  await page.clock.fastForward(5100);
  assert.equal(await activePage(), before, 'Offscreen carousel pauses autoplay');
  await species.scrollIntoViewIfNeeded();
  await species.getByRole('button', { name: 'Dừng tự chạy', exact: true }).click();
  await page.mouse.move(1, 1);
  await page.evaluate(() => document.activeElement?.blur());
  before = await activePage();
  await page.clock.fastForward(5100);
  assert.equal(await activePage(), before, 'Explicit pause survives leaving the controls');
  await species.getByRole('button', { name: 'Tiếp tục tự chạy', exact: true }).click();
  await page.mouse.move(1, 1);
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForFunction(() => document.querySelector('#bo-suu-tap span[aria-live]')?.getAttribute('aria-live') === 'off');
  await page.clock.fastForward(5100);
  assert.notEqual(await activePage(), before, 'Explicit resume restarts autoplay');

  await species.getByRole('button', { name: 'Xem trang cá 1', exact: true }).click();
  await settleSlide();
  await species.getByRole('button', { name: 'Trang trước', exact: true }).click();
  assert.equal(await activePage(), 'Xem trang cá 6', 'Previous wraps to the last fish');
  await page.keyboard.press('ArrowRight');
  assert.equal(await activePage(), 'Xem trang cá 1');
  await page.keyboard.press('End');
  assert.equal(await activePage(), 'Xem trang cá 6');
  await page.keyboard.press('Home');
  assert.equal(await activePage(), 'Xem trang cá 1');
  await page.mouse.move(1, 1);
  await page.evaluate(() => document.activeElement?.blur());
  await page.clock.fastForward(5100);
  assert.equal(await activePage(), 'Xem trang cá 1', 'Manual navigation stops autoplay');

  await species.getByRole('button', { name: 'Tiếp tục tự chạy', exact: true }).click();
  await page.mouse.move(1, 1);
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForFunction(() => document.querySelector('#bo-suu-tap span[aria-live]')?.getAttribute('aria-live') === 'off');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await species.getByRole('button', { name: 'Đã tắt tự chạy', exact: true }).waitFor();
  assert.equal(await species.getByRole('button', { name: 'Đã tắt tự chạy', exact: true }).isDisabled(), true);
  assert.equal(await species.locator('.home-species-track').evaluate(el => getComputedStyle(el).transitionDuration), '0s');
  await page.clock.fastForward(5100);
  assert.equal(await activePage(), 'Xem trang cá 1', 'Reduced motion prevents autoplay');
  await page.clock.resume();
  await tabs.nth(1).click();
  assert.equal(await page.locator('[role="tabpanel"]:visible .slide-fade-in').evaluate(el => getComputedStyle(el).animationName), 'none');

  // Failed images retain accessible descriptions; another scene still loads.
  await page.route('**/home/night.webp', route => route.abort());
  await tabs.nth(3).click();
  await page.getByRole('tabpanel').getByText('Chưa tải được hình ảnh', { exact: true }).waitFor();
  assert.equal(await page.getByRole('tabpanel').getByRole('img').getAttribute('aria-label'), 'Khung cảnh vùng biển trong game vào ban đêm');
  await tabs.nth(1).click();
  await page.getByRole('tabpanel').locator('img').waitFor();

  if (process.env.HOME_TEST_SCREENSHOTS) {
    mkdirSync(process.env.HOME_TEST_SCREENSHOTS, { recursive: true });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('tabpanel').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
      const image = document.querySelector('[role="tabpanel"]:not([style*="display: none"]) img');
      return image?.complete && image.naturalWidth > 0;
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator('.home-hero img').evaluate(image => image.decode());
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: `${process.env.HOME_TEST_SCREENSHOTS}/desktop.png`, fullPage: true, animations: 'disabled' });
    await page.locator('.home-hero').screenshot({ path: `${process.env.HOME_TEST_SCREENSHOTS}/hero.png`, animations: 'disabled' });
    await page.setViewportSize({ width: 375, height: 900 });
    await page.locator('.home-hero img').evaluate(image => image.decode());
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: `${process.env.HOME_TEST_SCREENSHOTS}/mobile.png`, fullPage: true, animations: 'disabled' });
  }

  await page.locator('.home-play-link').first().click();
  await page.locator('#login-page').waitFor();
  await page.evaluate(() => homeTest.router.push('/'));
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.getByRole('combobox').selectOption('en');
  await page.reload();
  await page.getByRole('heading', { level: 1, name: /Cast a line/ }).waitFor();
  await page.evaluate(() => { homeTest.auth.session = { user: { id: 'home-test-user' } }; });
  await page.locator('#lobby-page').waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: VI/EN, 320–1440px layouts, species carousel autoplay/pause/resume/wrap/keyboard/visibility/reduced motion, contrast, gallery, images, login CTA and authenticated redirect.');
} finally {
  await browser?.close();
  await server.close();
}
