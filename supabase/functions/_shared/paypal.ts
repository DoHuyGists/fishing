import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

export function env(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new HttpError(503, 'MISSING_CONFIGURATION', { variable: name });
  return value;
}

export function database() {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export class HttpError extends Error {
  constructor(public status: number, public code: string, public diagnostics?: Record<string, string | number>) { super(code); }
}

export function databaseFailure(error: { code?: string }, operation: string): HttpError {
  const databaseCode = error.code ?? 'UNKNOWN';
  const missingSchema = ['PGRST202', 'PGRST205', '42883', '42P01'].includes(databaseCode);
  return new HttpError(missingSchema ? 503 : 500, missingSchema ? 'DATABASE_NOT_READY' : 'DATABASE_ERROR', {
    operation, databaseCode,
  });
}

function apiBase() {
  const mode = env('PAYPAL_ENVIRONMENT');
  if (mode !== 'sandbox' && mode !== 'live') throw new HttpError(503, 'INVALID_CONFIGURATION', { variable: 'PAYPAL_ENVIRONMENT' });
  return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

async function providerFailure(response: Response, operation: 'oauth' | 'api'): Promise<HttpError> {
  let payload: any;
  try { payload = await response.json(); } catch { /* PayPal may return a non-JSON gateway error. */ }
  const errorCode = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined;
    if (/^[A-Z][A-Z0-9_]{0,99}$/.test(value) || ['invalid_client', 'invalid_request', 'invalid_scope', 'unsupported_grant_type'].includes(value)) return value;
    return undefined;
  };
  const providerError = errorCode(payload?.name) ?? errorCode(payload?.error);
  const providerIssue = errorCode(payload?.details?.[0]?.issue);
  const debugId = response.headers.get('paypal-debug-id') ?? payload?.debug_id;
  // Only machine codes and PayPal's correlation ID are safe to expose; omit descriptions, values and request bodies.
  return new HttpError(502, 'PROVIDER_UNAVAILABLE', {
    providerOperation: operation, providerStatus: response.status,
    ...(providerError ? { providerError } : {}),
    ...(providerIssue ? { providerIssue } : {}),
    ...(typeof debugId === 'string' && /^[a-f0-9]{8,64}$/i.test(debugId) ? { paypalDebugId: debugId } : {}),
  });
}

let token: { value: string; expires: number } | undefined;
export async function paypal(path: string, method = 'GET', body?: unknown, requestId?: string): Promise<any> {
  const base = apiBase();
  if (!token || token.expires <= Date.now()) {
    const response = await fetch(`${base}/v1/oauth2/token`, {
      method: 'POST', headers: {
        Authorization: `Basic ${btoa(`${env('PAYPAL_CLIENT_ID')}:${env('PAYPAL_CLIENT_SECRET')}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      }, body: 'grant_type=client_credentials', signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw await providerFailure(response, 'oauth');
    const data = await response.json();
    token = { value: data.access_token, expires: Date.now() + Math.max(0, data.expires_in - 60) * 1000 };
  }
  const response = await fetch(`${base}${path}`, {
    method, headers: {
      Authorization: `Bearer ${token.value}`, 'Content-Type': 'application/json',
      ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
      Prefer: 'return=representation',
    }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) {
    if (response.status === 401) token = undefined;
    throw await providerFailure(response, 'api');
  }
  return response.json();
}

export interface Donation {
  id: string; user_id: string; amount_cents: number; currency: string;
  paypal_order_id: string | null; paypal_capture_id: string | null; status: string; created_at: string;
}

export function checkOrder(order: any, row: Donation) {
  const units = order.purchase_units;
  const unit = units?.[0];
  if (order.id !== row.paypal_order_id || order.intent !== 'CAPTURE' || units?.length !== 1 ||
      unit?.custom_id !== row.id || unit?.amount?.currency_code !== row.currency ||
      unit?.amount?.value !== (row.amount_cents / 100).toFixed(2) ||
      unit?.payee?.merchant_id !== env('PAYPAL_MERCHANT_ID')) {
    throw new HttpError(409, 'PAYMENT_MISMATCH');
  }
}

export async function reconcile(db: ReturnType<typeof database>, row: Donation, order: any): Promise<string> {
  checkOrder(order, row);
  const captures = order.purchase_units[0].payments?.captures ?? [];
  if (captures.length > 1) throw new HttpError(409, 'PAYMENT_MISMATCH');
  const captureId = captures[0]?.id;
  let status = order.status === 'APPROVED' ? 'APPROVED' : 'CREATED';
  if (captureId) {
    const capture = await paypal(`/v2/payments/captures/${encodeURIComponent(captureId)}`);
    if (capture.amount?.currency_code !== row.currency || capture.amount?.value !== (row.amount_cents / 100).toFixed(2) ||
        (capture.supplementary_data?.related_ids?.order_id && capture.supplementary_data.related_ids.order_id !== order.id)) {
      throw new HttpError(409, 'PAYMENT_MISMATCH');
    }
    status = capture.status;
  } else if (order.status === 'VOIDED') status = 'FAILED';
  if (!['CREATED', 'APPROVED', 'PENDING', 'COMPLETED', 'DECLINED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'REVERSED'].includes(status)) {
    throw new HttpError(502, 'UNKNOWN_PAYMENT_STATUS');
  }
  const { data, error } = await db.rpc('record_paypal_donation', {
    p_id: row.id, p_capture_id: captureId ?? null, p_status: status,
  });
  if (error) throw databaseFailure(error, 'record_paypal_donation');
  return data;
}
