import { requestFeatures } from "../data/featureAvailability";

export interface FeatureDenial { message: string; code?: string }
type Guard = (features: string[]) => Promise<FeatureDenial | null>;
let guard: Guard | null = null;
let language = () => "vi";
let onServerDenial: ((key: string) => void) | undefined;

// Installed after Pinia exists; this avoids a connection -> store -> repository cycle.
export function setFeatureRequestGuard(value: Guard, getLanguage?: () => string, onDenied?: (key: string) => void) {
  guard = value;
  if (getLanguage) language = getLanguage;
  onServerDenial = onDenied;
}

export function createFeatureFetch(baseUrl: string, transport: typeof fetch = (...args) => fetch(...args)): typeof fetch {
  const origin = new URL(baseUrl).origin;
  return async (input, init) => {
    const request = input instanceof Request ? input : null;
    const url = new URL(request?.url ?? String(input));
    const features = url.origin === origin ? requestFeatures(url, init?.method ?? request?.method ?? "GET") : [];
    if (features.length) {
      const denial = guard ? await guard(features) : { message: "Feature availability is not initialized.", code: "FEATURE_FLAGS_UNAVAILABLE" };
      if (denial) {
        // Return a PostgREST-shaped error without sending a network request.
        // 403 avoids automatic retries of a deliberate maintenance rejection.
        return new Response(JSON.stringify({ code: denial.code ?? "FEATURE_DISABLED", message: denial.message, details: null, hint: null }), {
          status: 403, headers: { "Content-Type": "application/json" },
        });
      }
    }
    if (features.length) {
      const headers = new Headers(init?.headers ?? request?.headers);
      headers.set("Accept-Language", language());
      const response = await transport(input, { ...init, headers });
      if (response.status === 403 && onServerDenial) {
        try {
          const error = await response.clone().json();
          const key = typeof error.details === "string" && error.details.startsWith("FEATURE_DISABLED:")
            ? error.details.slice("FEATURE_DISABLED:".length)
            : error.code === "FEATURE_DISABLED" && features.length === 1 ? features[0] : null;
          if (key && features.includes(key)) onServerDenial(key);
        } catch { /* Keep the original response when an upstream error is not JSON. */ }
      }
      return response;
    }
    return transport(input, init);
  };
}
