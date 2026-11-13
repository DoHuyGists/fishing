/** Share reads; mutations during a read request one trailing reconciliation. */
export function createRefreshTask<T>() {
  let pending: Promise<T> | null = null;
  let trailing: (() => Promise<T>) | null = null;
  return (read: () => Promise<T>, invalidate = false): Promise<T> => {
    if (pending) {
      if (invalidate) trailing = read;
      return pending;
    }
    pending = Promise.resolve().then(async () => {
      let next = read;
      for (;;) {
        let result: T | undefined;
        let error: unknown;
        let failed = false;
        try { result = await next(); }
        catch (cause) { failed = true; error = cause; }
        if (!trailing) {
          if (failed) throw error;
          return result as T;
        }
        next = trailing;
        trailing = null;
      }
    }).finally(() => { pending = null; trailing = null; });
    return pending;
  };
}

export function createKeyedRefreshTask<T>() {
  const tasks = new Map<string, { run: ReturnType<typeof createRefreshTask<T>>; callers: number }>();
  return (key: string, read: () => Promise<T>, invalidate = false): Promise<T> => {
    let entry = tasks.get(key);
    if (!entry) { entry = { run: createRefreshTask<T>(), callers: 0 }; tasks.set(key, entry); }
    const current = entry;
    current.callers++;
    return current.run(read, invalidate).finally(() => {
      if (--current.callers === 0) tasks.delete(key);
    });
  };
}
