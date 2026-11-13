export async function catalogRequestBody(input: RequestInfo | URL, init?: RequestInit): Promise<Record<string, unknown>> {
  try {
    if (typeof init?.body === 'string') return JSON.parse(init.body);
    if (input instanceof Request) return await input.clone().json();
  } catch { /* Preserve the normal transport error for malformed bodies. */ }
  return {};
}
