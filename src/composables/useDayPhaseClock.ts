import { onMounted, onBeforeUnmount } from 'vue';
import { useDayPhaseStore } from '../stores/dayPhase';

export function useDayPhaseClock() {
  const store = useDayPhaseStore();
  let release: (() => void) | undefined;
  onMounted(() => { release = store.retainClock(); });
  onBeforeUnmount(() => { release?.(); });
  return store;
}
