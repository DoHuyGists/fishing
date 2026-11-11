import { database, env, HttpError, paypal, reconcile } from '../_shared/paypal.ts';

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  try {
    const event = await request.json();
    const verification = await paypal('/v1/notifications/verify-webhook-signature', 'POST', {
      auth_algo: request.headers.get('paypal-auth-algo'), cert_url: request.headers.get('paypal-cert-url'),
      transmission_id: request.headers.get('paypal-transmission-id'),
      transmission_sig: request.headers.get('paypal-transmission-sig'),
      transmission_time: request.headers.get('paypal-transmission-time'),
      webhook_id: env('PAYPAL_WEBHOOK_ID'), webhook_event: event,
    });
    if (verification.verification_status !== 'SUCCESS') return new Response(null, { status: 401 });
    if (!['CHECKOUT.ORDER.APPROVED', 'PAYMENT.CAPTURE.COMPLETED', 'PAYMENT.CAPTURE.PENDING',
      'PAYMENT.CAPTURE.DENIED', 'PAYMENT.CAPTURE.REFUNDED', 'PAYMENT.CAPTURE.REVERSED'].includes(event.event_type)) {
      return new Response(null, { status: 204 });
    }
    const resource = event.resource;
    const orderId = event.event_type === 'CHECKOUT.ORDER.APPROVED'
      ? resource?.id : resource?.supplementary_data?.related_ids?.order_id;
    const db = database();
    // Refund resources may omit the order ID; use their capture relation instead.
    let captureId = resource?.supplementary_data?.related_ids?.capture_id;
    if (!captureId && event.event_type.startsWith('PAYMENT.CAPTURE.') && event.event_type !== 'PAYMENT.CAPTURE.REFUNDED') captureId = resource?.id;
    if (!captureId && event.event_type === 'PAYMENT.CAPTURE.REFUNDED') {
      const link = resource?.links?.find((item: { rel: string }) => item.rel === 'up')?.href;
      captureId = typeof link === 'string' ? link.match(/\/v2\/payments\/captures\/([A-Z0-9]+)$/)?.[1] : undefined;
    }
    if (!orderId && !captureId) throw new Error('Missing payment reference');
    const query = db.from('donations').select('*');
    const { data: row, error } = await (orderId ? query.eq('paypal_order_id', orderId) : query.eq('paypal_capture_id', captureId)).maybeSingle();
    if (error) throw error;
    // Retry when an event races the first database write; ignore unrelated app payments later.
    if (!row) return new Response(null, { status: Date.now() - Date.parse(event.create_time) < 600000 ? 503 : 204 });
    const order = await paypal(`/v2/checkout/orders/${encodeURIComponent(row.paypal_order_id)}`);
    // Approval is not proof of payment. Capture is initiated only by the authenticated checkout.
    await reconcile(db, row, order);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('PayPal webhook failed', error instanceof HttpError ? error.code : 'WEBHOOK_UNAVAILABLE');
    return new Response(null, { status: 503 });
  }
});
