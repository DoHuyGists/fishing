const retryDelays = [500, 1000, 2000];

async function isFutureJwtRejection(response: Response): Promise<boolean> {
  if (response.status !== 401) return false;
  try {
    const error = await response.clone().json();
    return error?.code === 'PGRST303' && error?.message === 'JWT issued at future';
  } catch {
    return false;
  }
}

function waitForRetry(delay: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, delay);
    signal.addEventListener('abort', abort, { once: true });
  });
}

/** Mitigate PostgREST's intermittent clock skew rejection after token renewal.
 * Install inside cache/feature/mutation adapters so they see one final outcome.
 * The server rejects authentication before executing SQL, so this specific
 * response also permits replaying a write. Never retry uncertain write outcomes.
 * Keep the same token: refreshing again would produce another new issued-at time.
 */
export function createJwtClockSkewFetch(baseUrl: string, transport: typeof fetch = (...args) => globalThis.fetch(...args)): typeof fetch {
  const restUrl = new URL('rest/v1/', baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin !== restUrl.origin || !url.pathname.startsWith(restUrl.pathname)) return transport(input, init);

    // Retain an unconsumed body and the original authorization for every attempt.
    const request = new Request(input, init);
    for (let attempt = 0; ; attempt++) {
      request.signal.throwIfAborted();
      const response = await transport(request.clone());
      if (attempt >= retryDelays.length || !await isFutureJwtRejection(response)) return response;
      await waitForRetry(retryDelays[attempt]!, request.signal);
    }
  };
}
