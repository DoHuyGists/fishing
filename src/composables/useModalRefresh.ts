import { computed, onScopeDispose, ref } from 'vue';

export function useModalRefresh(
  callback: () => (() => void | Promise<void>) | undefined,
  invalidate: () => Promise<void>,
  fallbackError: () => string,
) {
  const isRefreshing = ref(false);
  const refreshCooldown = ref(0);
  const refreshError = ref('');
  const refreshDisabled = computed(() => isRefreshing.value || refreshCooldown.value > 0);
  let disposed = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  function clearTimer() {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
  }

  async function handleRefresh() {
    const refresh = callback();
    if (disposed || refreshDisabled.value || !refresh) return;
    isRefreshing.value = true;
    refreshError.value = '';
    refreshCooldown.value = 5;
    timer = setInterval(() => {
      refreshCooldown.value = Math.max(0, refreshCooldown.value - 1);
      if (refreshCooldown.value === 0) clearTimer();
    }, 1000);
    try {
      await invalidate();
      if (!disposed) await refresh();
    } catch (error) {
      // Modules that handle their own errors resolve normally. Rejections are
      // displayed by Modal, without a second global toast.
      if (!disposed) refreshError.value = error instanceof Error && error.message ? error.message : fallbackError();
    } finally {
      if (!disposed) isRefreshing.value = false;
    }
  }

  onScopeDispose(() => {
    disposed = true;
    clearTimer();
  });

  return { isRefreshing, refreshCooldown, refreshError, refreshDisabled, handleRefresh };
}
