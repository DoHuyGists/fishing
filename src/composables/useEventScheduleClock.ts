import { onMounted, onScopeDispose, ref } from "vue";
import type { EventScheduleRow } from "../types/table/eventSchedule";

export function useEventScheduleClock() {
  const now = ref(Date.now());
  let timer: ReturnType<typeof setInterval> | undefined;
  const sync = () => { now.value = Date.now(); };
  onMounted(() => {
    sync();
    timer = setInterval(sync, 1000);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
  });
  onScopeDispose(() => {
    clearInterval(timer);
    window.removeEventListener("focus", sync);
    document.removeEventListener("visibilitychange", sync);
  });
  function scheduleStatus(item: EventScheduleRow): "upcoming" | "ongoing" | "ended" {
    if (now.value < new Date(item.start).getTime()) return "upcoming";
    if (now.value > new Date(item.end).getTime()) return "ended";
    return "ongoing";
  }
  return { scheduleStatus };
}
