import { onMounted, onBeforeUnmount } from "vue";
import { useDayPhaseStore } from "../stores/player-day-phase-store";

export function useDayPhaseClock() {
  const store = useDayPhaseStore();
  let release: (() => void) | undefined;
  onMounted(() => {
    release = store.retainClock();
  });
  onBeforeUnmount(() => {
    release?.();
  });
  return store;
}
