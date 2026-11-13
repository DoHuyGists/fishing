import { onUnmounted, watch, type WatchSource } from 'vue';

export function usePagedListFilters(sources: WatchSource[], reload: () => void, invalidate?: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  watch(sources, () => {
    clearTimeout(timer);
    invalidate?.();
    timer = setTimeout(reload, 300);
  });
  onUnmounted(() => { clearTimeout(timer); invalidate?.(); });
}
