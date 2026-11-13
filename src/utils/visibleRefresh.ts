/** One visibility-aware, non-overlapping refresh loop per consumer. */
export function startVisibleRefresh(refresh: () => Promise<unknown>, intervalMs: number, immediate = true) {
  let stopped = false;
  let pending = false;
  let lastAttempt = 0;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const visible = () => document.visibilityState !== 'hidden' && navigator.onLine !== false;
  const schedule = () => {
    clearTimeout(timer);
    if (!stopped && visible()) {
      const delay = Math.min(intervalMs * 2 ** failures, 300_000);
      timer = setTimeout(() => { void run(); }, delay * (1 + Math.random() * 0.15));
    }
  };
  const run = async () => {
    if (stopped || pending || !visible()) return;
    pending = true;
    lastAttempt = Date.now();
    try { await refresh(); failures = 0; }
    catch { failures = Math.min(failures + 1, 4); }
    finally { pending = false; schedule(); }
  };
  const resume = () => {
    clearTimeout(timer);
    if (!visible()) return;
    // Coalesce focus/visibility/online and avoid rereading fresh snapshots.
    if (Date.now() - lastAttempt >= intervalMs) void run();
    else schedule();
  };
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('focus', resume);
  window.addEventListener('online', resume);
  window.addEventListener('offline', resume);
  if (immediate) void run();
  else { lastAttempt = Date.now(); schedule(); }
  return () => {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', resume);
    window.removeEventListener('focus', resume);
    window.removeEventListener('online', resume);
    window.removeEventListener('offline', resume);
  };
}
