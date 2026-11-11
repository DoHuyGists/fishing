import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Check Edge Function types locally without requiring a Deno installation.
const compilerOptions = { noEmit: true, strict: true, skipLibCheck: true, allowImportingTsExtensions: true,
  module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, target: ts.ScriptTarget.ES2022, types: [] };
const host = ts.createCompilerHost(compilerOptions);
const originalGetSourceFile = host.getSourceFile.bind(host);
host.getSourceFile = (fileName, ...args) => fileName === 'paypal-deno-runtime.d.ts'
  ? ts.createSourceFile(fileName, 'declare namespace Deno { const env: { get(name: string): string | undefined }; function serve(handler: (request: Request) => Promise<Response>): void; }', ts.ScriptTarget.ES2022)
  : originalGetSourceFile(fileName, ...args);
host.resolveModuleNames = (names, containingFile) => names.map(name => ts.resolveModuleName(
  name.startsWith('npm:@supabase/supabase-js@') ? '@supabase/supabase-js' : name, containingFile, compilerOptions, host,
).resolvedModule);
const program = ts.createProgram(['paypal-deno-runtime.d.ts', 'supabase/functions/paypal-donation/index.ts', 'supabase/functions/paypal-webhook/index.ts'], compilerOptions, host);
const diagnostics = ts.getPreEmitDiagnostics(program);
assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
  getCanonicalFileName: file => file, getCurrentDirectory: () => process.cwd(), getNewLine: () => '\n',
}));

const require = createRequire(import.meta.url);
const settings = {
  SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
  PAYPAL_ENVIRONMENT: 'sandbox', PAYPAL_CLIENT_ID: 'test-client', PAYPAL_CLIENT_SECRET: 'test-secret',
  PAYPAL_MERCHANT_ID: 'MERCHANT', PAYPAL_WEBHOOK_ID: 'WEBHOOK', DONATION_ALLOWED_ORIGINS: 'https://game.example',
};
let row;
let providerStatus = 'CREATED';
let captureStatus = 'COMPLETED';
let signature = 'SUCCESS';
let captureCalls = 0;
let createCalls = 0;
let timeoutAfterCapture = false;
let authCalls = 0;
let handler;
let prepareError;
let prepareAsArray = true;
let providerFailureAt = '';
const errorLogs = [];
const id = '12345678-1234-4123-8123-123456789abc';
const order = () => ({ id: 'ORDER', intent: 'CAPTURE', status: providerStatus, purchase_units: [{
  custom_id: id, amount: { currency_code: 'USD', value: '5.00' }, payee: { merchant_id: 'MERCHANT' },
  ...(providerStatus === 'COMPLETED' ? { payments: { captures: [{ id: 'CAPTURE' }] } } : {}),
}] });
const db = {
  auth: { getUser: async token => {
    authCalls++;
    return { data: { user: token === 'valid' ? { id: 'USER' } : null }, error: null };
  } },
  rpc: async (name, args) => {
    if (name === 'prepare_paypal_donation') {
      if (prepareError) return { data: null, error: prepareError };
      row ??= { id: args.p_id, user_id: args.p_user_id, amount_cents: args.p_amount_cents, currency: 'USD',
        status: 'CREATED', paypal_order_id: null, paypal_capture_id: null, created_at: new Date().toISOString() };
      return { data: prepareAsArray ? [{ ...row }] : { ...row }, error: null };
    }
    row.status = args.p_status;
    row.paypal_capture_id = args.p_capture_id;
    return { data: row.status, error: null };
  },
  from: () => {
    const filters = [];
    let update;
    const query = {
      select: () => query,
      update: values => { update = values; return query; },
      eq: (key, value) => { filters.push([key, value]); return query; },
      maybeSingle: async () => ({ data: row && filters.every(([key, value]) => row[key] === value) ? { ...row } : null, error: null }),
      then: resolve => { if (row && filters.every(([key, value]) => row[key] === value)) Object.assign(row, update); resolve({ error: null }); },
    };
    return query;
  },
};
const fetchMock = async (url, options = {}) => {
  if (providerFailureAt === 'oauth' && url.endsWith('/v1/oauth2/token')) return Response.json({
    error: 'invalid_client', error_description: 'test-secret must never be returned',
  }, { status: 401, headers: { 'paypal-debug-id': 'abc1234567890' } });
  if (providerFailureAt === 'non-json' && url.endsWith('/v1/oauth2/token')) return new Response('Upstream unavailable test-secret', { status: 503 });
  if (providerFailureAt === 'create' && url.endsWith('/v2/checkout/orders')) return Response.json({
    name: 'UNPROCESSABLE_ENTITY', debug_id: 'def1234567890',
    details: [{ issue: 'PAYEE_ACCOUNT_INVALID', value: 'test-secret', description: 'Private payee data' }],
  }, { status: 422 });
  if (url.endsWith('/v1/oauth2/token')) return Response.json({ access_token: 'token', expires_in: 3600 });
  if (url.endsWith('/verify-webhook-signature')) return Response.json({ verification_status: signature });
  if (url.endsWith('/v2/checkout/orders') && options.method === 'POST') {
    createCalls++;
    const body = JSON.parse(options.body);
    assert.equal(body.purchase_units[0].amount.value, '5.00');
    assert.equal(body.purchase_units[0].payee.merchant_id, 'MERCHANT');
    assert.equal(options.headers['PayPal-Request-Id'], id);
    return Response.json(order());
  }
  if (url.endsWith('/ORDER/capture')) {
    captureCalls++;
    assert.equal(options.headers['PayPal-Request-Id'], `capture-${id}`);
    providerStatus = 'COMPLETED';
    if (timeoutAfterCapture) throw new Error('Simulated timeout after charge');
    return Response.json(order());
  }
  if (url.endsWith('/v2/checkout/orders/ORDER')) return Response.json(order());
  if (url.endsWith('/v2/payments/captures/CAPTURE')) return Response.json({ id: 'CAPTURE', status: captureStatus,
    amount: { currency_code: 'USD', value: '5.00' }, supplementary_data: { related_ids: { order_id: 'ORDER' } } });
  throw new Error(`Unexpected provider request: ${url}`);
};
function load(path, dependencies = {}) {
  const output = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true,
  });
  assert.equal(output.diagnostics?.filter(item => item.category === ts.DiagnosticCategory.Error).length, 0);
  const exports = {};
  const context = { exports, require: name => dependencies[name] ?? require(name),
    Deno: { env: { get: name => settings[name] }, serve: fn => { handler = fn; } },
    fetch: fetchMock, Response, Request, AbortSignal, console: { ...console, error: (...args) => errorLogs.push(args) }, btoa, Date, Error, crypto: globalThis.crypto,
    sessionStorage: storage,
  };
  vm.runInNewContext(output.outputText, context, { filename: path });
  return exports;
}
const saved = new Map();
const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) };
const shared = load('supabase/functions/_shared/paypal.ts', { 'npm:@supabase/supabase-js@2.112.4': { createClient: () => db } });
load('supabase/functions/paypal-donation/index.ts', { '../_shared/paypal.ts': shared });
const invoke = (body, token = 'valid', origin = 'https://game.example') => handler(new Request('https://example/functions/v1/paypal-donation', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), Origin: origin }, body: JSON.stringify(body),
}));
assert.equal((await invoke({ action: 'create', donationId: id, amountCents: 500 }, '')).status, 401);
assert.equal((await invoke({ action: 'create', donationId: id, amountCents: 500 }, 'invalid')).status, 401);
assert.equal((await invoke({ action: 'create', donationId: id, amountCents: 500 }, 'valid', 'https://evil.example')).status, 403);
for (const amountCents of [0, 99, 100001, 500.5, '500', null]) {
  assert.equal((await invoke({ action: 'create', donationId: id, amountCents })).status, 400);
}
assert.equal(createCalls, 0);
prepareError = { code: 'PGRST202', message: 'RPC missing from schema cache' };
let failure = await invoke({ action: 'create', donationId: id, amountCents: 500 });
assert.equal(failure.status, 503);
assert.equal((await failure.json()).code, 'DATABASE_NOT_READY');
prepareError = { code: '42501', message: 'Permission denied' };
failure = await invoke({ action: 'create', donationId: id, amountCents: 500 });
assert.equal(failure.status, 500);
assert.equal((await failure.json()).code, 'DATABASE_ERROR');
prepareError = undefined;
delete settings.PAYPAL_MERCHANT_ID;
failure = await invoke({ action: 'create', donationId: id, amountCents: 500 });
assert.equal(failure.status, 503);
const missingConfiguration = await failure.json();
assert.equal(missingConfiguration.code, 'MISSING_CONFIGURATION');
assert.equal(missingConfiguration.variable, 'PAYPAL_MERCHANT_ID');
assert.equal(typeof missingConfiguration.requestId, 'string');
settings.PAYPAL_MERCHANT_ID = 'MERCHANT';
providerFailureAt = 'oauth';
failure = await invoke({ action: 'create', donationId: id, amountCents: 500 });
assert.equal(failure.status, 502);
let providerFailure = await failure.json();
assert.equal(providerFailure.code, 'PROVIDER_UNAVAILABLE');
assert.equal(providerFailure.provider.providerOperation, 'oauth');
assert.equal(providerFailure.provider.providerStatus, 401);
assert.equal(providerFailure.provider.providerError, 'invalid_client');
assert.equal(providerFailure.provider.paypalDebugId, 'abc1234567890');
assert.equal(JSON.stringify(providerFailure).includes('test-secret'), false);
providerFailureAt = 'non-json';
failure = await invoke({ action: 'create', donationId: id, amountCents: 500 });
assert.equal(failure.status, 502);
assert.equal((await failure.json()).provider.providerStatus, 503);
providerFailureAt = 'create';
failure = await invoke({ action: 'create', donationId: id, amountCents: 500 });
assert.equal(failure.status, 502);
providerFailure = await failure.json();
assert.equal(providerFailure.provider.providerOperation, 'api');
assert.equal(providerFailure.provider.providerStatus, 422);
assert.equal(providerFailure.provider.providerIssue, 'PAYEE_ACCOUNT_INVALID');
assert.equal(providerFailure.provider.paypalDebugId, 'def1234567890');
assert.equal(JSON.stringify(providerFailure).includes('test-secret'), false);
providerFailureAt = '';
for (let retry = 0; retry < 2; retry++) {
  prepareAsArray = retry === 0;
  assert.equal((await invoke({ action: 'create', donationId: id, amountCents: 500 })).status, 200);
}
assert.equal(createCalls, 1, 'retry must reuse the stored PayPal order');
row.user_id = 'OTHER';
assert.equal((await invoke({ action: 'capture', donationId: id })).status, 404);
row.user_id = 'USER';
assert.equal((await (await invoke({ action: 'capture', donationId: id })).json()).status, 'CREATED');
assert.equal(captureCalls, 0, 'unapproved orders must never be captured');
providerStatus = 'APPROVED';
settings.PAYPAL_MERCHANT_ID = 'WRONG';
assert.equal((await invoke({ action: 'capture', donationId: id })).status, 409);
assert.equal(captureCalls, 0);
settings.PAYPAL_MERCHANT_ID = 'MERCHANT';
timeoutAfterCapture = true;
assert.equal((await (await invoke({ action: 'capture', donationId: id })).json()).status, 'COMPLETED');
assert.equal((await (await invoke({ action: 'capture', donationId: id })).json()).status, 'COMPLETED');
assert.equal(captureCalls, 1, 'capture timeout/retry must not cause a second charge');
captureStatus = 'PENDING';
row.status = 'APPROVED';
assert.equal((await (await invoke({ action: 'status', donationId: id })).json()).status, 'PENDING');
row.amount_cents = 600;
assert.equal((await invoke({ action: 'status', donationId: id })).status, 409);
row.amount_cents = 500;

load('supabase/functions/paypal-webhook/index.ts', { '../_shared/paypal.ts': shared });
const webhook = event => handler(new Request('https://example/functions/v1/paypal-webhook', { method: 'POST',
  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event) }));
const event = { event_type: 'PAYMENT.CAPTURE.COMPLETED', create_time: new Date().toISOString(),
  resource: { id: 'CAPTURE', supplementary_data: { related_ids: { order_id: 'ORDER' } } } };
signature = 'FAILURE';
const prior = row.status;
assert.equal((await webhook(event)).status, 401);
assert.equal(row.status, prior, 'forged webhooks must not update the ledger');
signature = 'SUCCESS';
captureStatus = 'COMPLETED';
assert.equal((await webhook(event)).status, 204);
assert.equal(row.status, 'COMPLETED');
captureStatus = 'REFUNDED';
assert.equal((await webhook({ ...event, event_type: 'PAYMENT.CAPTURE.REFUNDED', resource: {
  id: 'REFUND', links: [{ rel: 'up', href: 'https://api-m.sandbox.paypal.com/v2/payments/captures/CAPTURE' }],
} })).status, 204);
assert.equal(row.status, 'REFUNDED');

const { createPinia, setActivePinia } = require('pinia');
setActivePinia(createPinia());
let requests = [];
let resultStatus = 'COMPLETED';
let failRequest = false;
const repository = { request: async (action, donationId, amountCents) => {
  requests.push({ action, donationId, amountCents });
  if (failRequest) throw new Error('CAPTURE_UNCONFIRMED');
  return { donationId, orderId: 'STORE-ORDER', status: action === 'create' ? 'CREATED' : resultStatus };
} };
const { useInformationModalStore } = load('src/stores/informationModal.ts');
const translations = JSON.parse(fs.readFileSync('src/locales/vi.json', 'utf8'));
const { useDonationStore } = load('src/stores/donation.ts', {
  '../data/supabaseDonationRepository': { supabaseDonationRepository: repository },
  '../i18n': { getFormattingLocale: () => 'vi-VN', t: (key, values = {}) => {
    const [section, name] = key.split('.');
    return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), translations[section][name]);
  } },
  './informationModal': { useInformationModalStore },
});
const store = useDonationStore();
const information = useInformationModalStore();
store.bindUser('USER');
assert.equal(store.amount, '', 'new checkout must not suggest an amount');
assert.equal(store.validAmount, false);
for (const amount of ['0', '1000.01', '5.001', 'NaN', '1e2', '5,50']) { store.amount = amount; assert.equal(store.validAmount, false); }
store.amount = '5.25';
assert.equal(store.amountCents, 525);
await store.createOrder();
await store.createOrder();
assert.equal(requests[0].donationId, requests[1].donationId);
const attemptId = store.attempt.id;
failRequest = true;
await store.verify(true);
assert.equal(store.errorCode, 'CAPTURE_UNCONFIRMED');
assert.equal(information.content, null, 'unconfirmed capture must not show a thank-you popup');
assert.equal(store.attempt.id, attemptId);
store.bindUser('OTHER');
assert.equal(store.attempt, null);
store.bindUser('USER');
assert.equal(store.attempt.id, attemptId, 'reopening restores the same attempt for its owner');
failRequest = false;
resultStatus = 'PENDING';
await store.verify(true);
assert.equal(store.settled, false);
assert.equal(information.content, null, 'pending payment must not show a thank-you popup');
store.resetAttempt();
assert.equal(store.attempt.id, attemptId, 'pending payment cannot start a new attempt');
resultStatus = 'COMPLETED';
await store.verify();
assert.equal(store.settled, true);
assert.equal(information.content.name, translations.donationPayment.thankYouTitle);
assert.ok(information.content.description.includes('5,25'));
assert.ok(information.content.description.includes('USD'));
information.close();
await store.verify();
assert.equal(information.content, null, 'rechecking a completed donation must not repeat the popup');
assert.equal(saved.has('fishing.paypal-donation.USER'), false);
store.resetAttempt();
assert.equal(store.attempt, null);
assert.equal(store.amount, '', 'starting a new contribution must clear the previous amount');
store.amount = '5.25';
await store.createOrder();
await store.verify(true);
assert.equal(information.content.name, translations.donationPayment.thankYouTitle, 'a new completed contribution gets its own popup');
information.close();
store.resetAttempt();
store.amount = '5.25';
await store.createOrder();
resultStatus = 'DECLINED';
await store.verify(true);
assert.equal(information.content, null, 'declined payment must not show a thank-you popup');
assert.ok(authCalls > 0);
assert.ok(errorLogs.some(args => args.join(' ').includes('PGRST202')));
for (const secret of ['test-secret', 'test-service-key']) assert.equal(JSON.stringify(errorLogs).includes(secret), false);
console.log('Validated donation auth, ownership, amount/merchant checks, composite RPC responses, setup diagnostics, safe logs, retry safety, capture timeout recovery, webhook verification/refunds, and store recovery with mocked services.');
