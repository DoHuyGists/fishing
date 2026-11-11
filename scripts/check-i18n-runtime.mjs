import assert from 'node:assert/strict';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { createPinia } from 'pinia';
import { computed, createRenderer, createSSRApp, h, nextTick } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { createMemoryHistory, createRouter } from 'vue-router';
import * as Vue from 'vue';
import fs from 'node:fs';
import ts from 'typescript';
import { compileScript, parse } from '@vue/compiler-sfc';

const server = await createServer({ configFile: false, plugins: [vue()], appType: 'custom', server: { middlewareMode: true, hmr: false } });
const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
const saved = new Map([['fishing.locale', 'en']]);
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: key => saved.get(key) ?? null,
  setItem: (key, value) => saved.set(key, value),
} });
Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: { lang: '' } } });

function node(type, text = '') { return { type, text, children: [], props: {}, parent: null }; }
const renderer = createRenderer({
  createElement: type => node(type), createText: text => node('#text', text), createComment: text => node('#comment', text),
  setText: (target, value) => { target.text = value; },
  setElementText: (target, value) => { target.text = value; target.children = []; },
  parentNode: target => target.parent,
  nextSibling: target => target.parent?.children[target.parent.children.indexOf(target) + 1] ?? null,
  patchProp: (target, key, _previous, value) => { target.props[key] = value; },
  insert(target, parent, anchor = null) {
    if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1);
    target.parent = parent;
    const index = anchor ? parent.children.indexOf(anchor) : -1;
    parent.children.splice(index < 0 ? parent.children.length : index, 0, target);
  },
  remove(target) { target.parent?.children.splice(target.parent.children.indexOf(target), 1); target.parent = null; },
});
const textContent = target => target.text + target.children.map(textContent).join('');

try {
  const { i18n, t, getFormattingLocale } = await server.ssrLoadModule('/src/i18n/index.ts');
  const { useLocaleStore } = await server.ssrLoadModule('/src/stores/locale.ts');
  const { useCurrencyStore } = await server.ssrLoadModule('/src/stores/currency.ts');
  const { useDayPhaseStore } = await server.ssrLoadModule('/src/stores/dayPhase.ts');
  const { formatDuration } = await server.ssrLoadModule('/src/components/player/aquaculture/pondPresentation.ts');
  const pinia = createPinia();
  const locale = useLocaleStore(pinia);
  const currency = useCurrencyStore(pinia);
  const phases = useDayPhaseStore(pinia);
  const label = computed(() => t('LoginView.dang_nhap'));
  currency.cash = 12345;
  assert.equal(locale.locale, 'en');
  assert.equal(document.documentElement.lang, 'en');
  assert.equal(currency.formattedCash, '12,345');
  assert.equal(label.value, 'Sign in');
  assert.equal(formatDuration(3900), '1 h 5 min');
  const englishPhase = phases.currentPhase.label;
  locale.setLocale('vi');
  assert.equal(label.value, 'Đăng nhập');
  assert.equal(getFormattingLocale(), 'vi-VN');
  assert.equal(currency.formattedCash, '12.345');
  assert.equal(saved.get('fishing.locale'), 'vi');
  assert.equal(document.documentElement.lang, 'vi');
  assert.notEqual(phases.currentPhase.label, englishPhase);
  assert.equal(formatDuration(3900), '1 giờ 5 phút');
  assert.equal(t('Fishfarm.confirmTransfer', { value0: 3 }), 'Chuyển 3 cá đã chọn vào kho cá?');
  locale.setLocale('fr');
  assert.equal(locale.locale, 'vi');

  const { useAuthStore } = await server.ssrLoadModule('/src/stores/auth.ts');
  const { useUserProfileStore } = await server.ssrLoadModule('/src/stores/userProfile.ts');
  const { supabaseUserProfileRepository } = await server.ssrLoadModule('/src/data/supabaseUserProfileRepository.ts');
  const auth = useAuthStore(pinia);
  const profile = useUserProfileStore(pinia);
  const originalUpdateLanguage = supabaseUserProfileRepository.updateLanguage;
  const languageWrites = [];
  try {
    supabaseUserProfileRepository.updateLanguage = async (id, language) => {
      languageWrites.push({ id, language });
    };
    auth.user = { id: 'language-test-user' };
    auth.profile = { id: auth.user.id, language: 'en' };
    await nextTick();
    assert.equal(locale.locale, 'en');
    assert.equal(languageWrites.length, 0);
    profile.profile = { id: auth.user.id, language: 'en' };
    await nextTick();
    await locale.setLocale('vi');
    assert.deepEqual(languageWrites, [{ id: auth.user.id, language: 'vi' }]);
    assert.equal(auth.profile.language, 'vi');
    assert.equal(profile.profile.language, 'vi');
    assert.equal(saved.get('fishing.locale'), 'vi');
    supabaseUserProfileRepository.updateLanguage = async () => { throw new Error('Save failed'); };
    await locale.setLocale('en');
    assert.equal(locale.locale, 'vi');
    assert.equal(saved.get('fishing.locale'), 'vi');
    assert.equal(profile.profile.language, 'vi');
    assert.equal(locale.error, t('language.save_error'));
    assert.equal(locale.saving, false);
    profile.profile = { id: 'other-user', language: 'en' };
    await nextTick();
    assert.equal(locale.locale, 'vi');
  } finally {
    supabaseUserProfileRepository.updateLanguage = originalUpdateLanguage;
    auth.user = null;
    auth.profile = null;
    profile.profile = null;
    await nextTick();
  }

  // Compile a client render function so locale changes can be checked on one mounted instance.
  const descriptor = parse(fs.readFileSync('src/components/shared/TwoOptionsModal.vue', 'utf8')).descriptor;
  const component = compileScript(descriptor, { id: 'i18n-confirm-check', inlineTemplate: true });
  const compiled = ts.transpileModule(component.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  new Function('require', 'exports', compiled.outputText)(name => {
    if (name === 'vue') return Vue;
    if (name === '../../i18n') return { t };
    throw new Error(`Unexpected component import: ${name}`);
  }, exports);
  const Confirm = exports.default;
  const root = node('root');
  const app = renderer.createApp({ render: () => h(Confirm, { title: 'Test' }) });
  app.use(i18n).mount(root);
  assert.match(textContent(root), /Hủy/);
  locale.setLocale('en');
  await nextTick();
  assert.match(textContent(root), /Cancel/);
  assert.match(textContent(root), /Confirm/);
  assert.doesNotMatch(textContent(root), /Hủy/);
  app.unmount();

  const { default: Login } = await server.ssrLoadModule('/src/views/LoginView.vue');
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: Login }] });
  await router.push('/login');
  await router.isReady();
  for (const [language, expected] of [['vi', 'Mật khẩu'], ['en', 'Password']]) {
    locale.setLocale(language);
    const page = createSSRApp(Login);
    page.use(pinia).use(i18n).use(router);
    const html = await renderToString(page);
    assert.ok(html.includes(expected), `Login must render ${language} translations`);
    assert.ok(!html.includes('LoginView.'), 'Login must render messages rather than message keys');
  }
  console.log('Validated persisted language, reactive labels, formatting, interpolation, modal updates and login rendering in both locales.');
} finally {
  if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
  else delete globalThis.localStorage;
  if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor);
  else delete globalThis.document;
  await server.close();
}
