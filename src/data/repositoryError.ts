export class RepositoryError extends Error {
  readonly code?: string;
  readonly details?: string | null;
  readonly hint?: string | null;
  readonly status?: number;
  readonly domains: string[];
  readonly retryAfterMs: number;
  constructor(error: { message: string; code?: string; details?: string | null; hint?: string | null; status?: number }) {
    super(error.message);
    this.name = 'RepositoryError';
    this.code = error.code;
    this.details = error.details;
    this.hint = error.hint;
    this.status = error.status;
    let detail: { code?: string; domains?: string[]; retryAfterMs?: number } = {};
    try { detail = JSON.parse(error.details ?? '{}'); } catch { /* Ordinary PostgREST details are text. */ }
    if (detail?.code) this.code = detail.code;
    this.domains = Array.isArray(detail?.domains) ? detail.domains.filter(x => typeof x === 'string') : [];
    this.retryAfterMs = Number.isFinite(detail?.retryAfterMs) ? Math.max(0, detail.retryAfterMs!) : 0;
  }
}

export function isTemporaryReadError(error: unknown): boolean {
  if (error instanceof TypeError) return true; // fetch rejects network failures with TypeError.
  if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) return true;
  return error instanceof RepositoryError && (error.status === 429 || (error.status ?? 0) >= 500
    || (!error.code && /fetch|network|timeout|abort/i.test(error.message)));
}
