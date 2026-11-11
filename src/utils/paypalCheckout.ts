export interface PayPalSessionOptions {
  onApprove: (data: { orderId: string }) => Promise<void>;
  onCancel: () => void;
  onError: (error: unknown) => void;
}
export interface PayPalSession {
  start: (options: { presentationMode: 'auto'; targetElement?: HTMLElement }, order: Promise<{ orderId: string }>) => Promise<void>;
}
export interface PayPalInstance {
  findEligibleMethods: (options: { currencyCode: string; amount: string }) => Promise<{ isEligible: (method: string) => boolean }>;
  createPayPalOneTimePaymentSession: (options: PayPalSessionOptions) => PayPalSession;
  createPayPalGuestOneTimePaymentSession: (options: PayPalSessionOptions) => Promise<PayPalSession>;
}
interface PayPalSDK {
  createInstance: (options: { clientId: string; components: string[]; pageType: string }) => Promise<PayPalInstance>;
}

let sdkPromise: Promise<PayPalInstance> | undefined;
export function loadPayPal(): Promise<PayPalInstance> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = (async () => {
    const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID?.trim();
    const environment = import.meta.env.VITE_PAYPAL_ENVIRONMENT;
    if (!clientId || !['sandbox', 'live'].includes(environment)) throw new Error('PAYMENT_UNAVAILABLE');
    const host = environment === 'live' ? 'www.paypal.com' : 'www.sandbox.paypal.com';
    const sdk = await new Promise<PayPalSDK>((resolve, reject) => {
      const existing = (window as Window & { paypal?: PayPalSDK }).paypal;
      if (existing?.createInstance) { resolve(existing); return; }
      const script = document.createElement('script');
      const timeout = window.setTimeout(() => fail(), 20000);
      const fail = () => {
        clearTimeout(timeout);
        script.remove();
        reject(new Error('PAYMENT_UNAVAILABLE'));
      };
      script.src = `https://${host}/web-sdk/v6/core`;
      script.async = true;
      script.onerror = fail;
      script.onload = () => {
        clearTimeout(timeout);
        const loaded = (window as Window & { paypal?: PayPalSDK }).paypal;
        if (loaded?.createInstance) resolve(loaded); else fail();
      };
      document.head.appendChild(script);
    });
    return sdk.createInstance({ clientId, components: ['paypal-payments', 'paypal-guest-payments'], pageType: 'checkout' });
  })().catch(error => { sdkPromise = undefined; throw error; });
  return sdkPromise;
}
