import { database, databaseFailure, env, HttpError, paypal, checkOrder, reconcile, type Donation } from '../_shared/paypal.ts';

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID();
  let stage = 'initialize';
  const origin = request.headers.get('origin') ?? '';
  const allowed = (Deno.env.get('DONATION_ALLOWED_ORIGINS') ?? '').split(',').map(value => value.trim()).filter(Boolean);
  const headers = {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin',
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : '',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (origin && !allowed.includes(origin)) return json({ code: 'ORIGIN_NOT_ALLOWED' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return json({ code: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    const db = database();
    stage = 'authenticate';
    const bearer = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!bearer) throw new HttpError(401, 'AUTH_REQUIRED');
    const { data: { user }, error: authError } = await db.auth.getUser(bearer);
    if (authError || !user) throw new HttpError(401, 'AUTH_REQUIRED');
    // Service-role calls bypass the Data API hook, so check before any PayPal operation.
    stage = 'check_feature_availability';
    const { data: donationFlag, error: flagError } = await db.from('feature_flags')
      .select('enabled').eq('feature_key', 'donation').maybeSingle();
    if (flagError) throw databaseFailure(flagError, stage);
    if (donationFlag?.enabled !== true) throw new HttpError(403, 'FEATURE_DISABLED');
    let body;
    try { body = await request.json(); } catch { throw new HttpError(400, 'INVALID_REQUEST'); }
    if (!body || !['create', 'capture', 'status'].includes(body.action) ||
        typeof body.donationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.donationId)) {
      throw new HttpError(400, 'INVALID_REQUEST');
    }
    let row: Donation;
    if (body.action === 'create') {
      if (!Number.isInteger(body.amountCents) || body.amountCents < 100 || body.amountCents > 100000) {
        throw new HttpError(400, 'INVALID_AMOUNT');
      }
      stage = 'prepare_paypal_donation';
      const { data, error } = await db.rpc('prepare_paypal_donation', {
        p_id: body.donationId, p_user_id: user.id, p_amount_cents: body.amountCents,
      });
      if (error) {
        if (error.message.includes('limit reached')) throw new HttpError(429, 'RATE_LIMITED');
        if (error.message.includes('mismatch')) throw new HttpError(409, 'PAYMENT_MISMATCH');
        throw databaseFailure(error, stage);
      }
      // PostgREST table/composite responses can be wrapped in a single-row array.
      row = Array.isArray(data) && data.length === 1 ? data[0] : data;
      if (!row || row.id !== body.donationId || row.user_id !== user.id || row.amount_cents !== body.amountCents) {
        throw new HttpError(500, 'INVALID_DATABASE_RESPONSE', { operation: stage });
      }
      if (!row.paypal_order_id) {
        // PayPal retains default idempotency keys for six hours. Never recreate an old uncertain attempt.
        if (Date.now() - Date.parse(row.created_at) > 5 * 60 * 60 * 1000) throw new HttpError(409, 'ATTEMPT_EXPIRED');
        stage = 'create_paypal_order';
        const order = await paypal('/v2/checkout/orders', 'POST', {
          intent: 'CAPTURE', purchase_units: [{
            reference_id: row.id, custom_id: row.id, description: 'Voluntary support for Fishing game development',
            amount: { currency_code: 'USD', value: (row.amount_cents / 100).toFixed(2) },
            payee: { merchant_id: env('PAYPAL_MERCHANT_ID') },
          }],
          payment_source: { paypal: { experience_context: { shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW' } } },
        }, row.id);
        stage = 'save_paypal_order';
        const { error: saveError } = await db.from('donations').update({ paypal_order_id: order.id }).eq('id', row.id);
        if (saveError) throw databaseFailure(saveError, stage);
        row.paypal_order_id = order.id;
      }
      return json({ donationId: row.id, orderId: row.paypal_order_id, status: row.status });
    }
    stage = 'load_donation';
    const { data, error } = await db.from('donations').select('*').eq('id', body.donationId).eq('user_id', user.id).maybeSingle();
    if (error) throw databaseFailure(error, stage);
    if (!data?.paypal_order_id) throw new HttpError(404, 'PAYMENT_NOT_FOUND');
    row = data;
    stage = 'load_paypal_order';
    let order = await paypal(`/v2/checkout/orders/${encodeURIComponent(row.paypal_order_id!)}`);
    checkOrder(order, row);
    if (body.action === 'capture' && order.status === 'APPROVED' && !order.purchase_units[0].payments?.captures?.length) {
      stage = 'capture_paypal_order';
      try {
        order = await paypal(`/v2/checkout/orders/${encodeURIComponent(row.paypal_order_id!)}/capture`, 'POST', {}, `capture-${row.id}`);
      } catch {
        // A timeout or concurrent request may have captured successfully. Read before retrying.
        order = await paypal(`/v2/checkout/orders/${encodeURIComponent(row.paypal_order_id!)}`);
        if (!order.purchase_units?.[0]?.payments?.captures?.length) throw new HttpError(502, 'CAPTURE_UNCONFIRMED');
      }
    }
    stage = 'reconcile_payment';
    return json({ donationId: row.id, orderId: row.paypal_order_id, status: await reconcile(db, row, order) });
  } catch (error) {
    // Log only controlled metadata; never log bearer tokens, secrets or provider/customer payloads.
    const known = error instanceof HttpError;
    console.error('PayPal donation request failed', JSON.stringify({
      requestId, stage, code: known ? error.code : 'PAYMENT_UNAVAILABLE',
      ...(known ? error.diagnostics : { errorType: error instanceof Error ? error.name : 'UnknownError' }),
    }));
    return json({ code: known ? error.code : 'PAYMENT_UNAVAILABLE', requestId,
      ...(known && error.code === 'PROVIDER_UNAVAILABLE' ? { provider: error.diagnostics } : {}),
      ...(known && ['MISSING_CONFIGURATION', 'INVALID_CONFIGURATION'].includes(error.code) ? { variable: error.diagnostics?.variable } : {}),
    }, known ? error.status : 500);
  }
});
