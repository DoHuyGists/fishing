import { computed, onScopeDispose, ref } from 'vue';
import { defineStore } from 'pinia';
import { getFormattingLocale, t as tr } from '../i18n';
import type { FishingAreaDetails } from '../types/table/fishingArea';
import type { FishingSceneArea } from '../types/model/fishingScene';
import { supabaseFishingAreaRepository } from '../data/supabaseFishingAreaRepository';

// Scene phases are decorative; fish availability uses DAY [06:00, 19:00).
const DAY_PHASES = [
  { key: 'dawn', get label() { return tr('dayPhase.sang'); }, from: 3, to: 9, icon: '/time/sunrise.png' },
  { key: 'day', get label() { return tr('dayPhase.trua'); }, from: 9, to: 17, icon: '/time/noon.png' },
  { key: 'dusk', get label() { return tr('dayPhase.hoang_hon'); }, from: 17, to: 19, icon: '/time/dusk.png' },
  { key: 'night', get label() { return tr('dayPhase.ban_dem'); }, from: 19, to: 24, icon: '/time/night.png' },
] as const;

export const useDayPhaseStore = defineStore('DayPhase', () => {
  const now = ref(Date.now());
  const area = ref<FishingSceneArea | null>(null);
  const previewArea = ref<FishingAreaDetails | null>(null);
  let previewRequest = 0;
  let consumers = 0;
  let timer: ReturnType<typeof setInterval> | undefined;

  function updateClock() { now.value = Date.now(); }
  function onVisibilityChange() {
    if (document.visibilityState === 'visible') updateClock();
  }
  function stopClock() {
    clearInterval(timer);
    timer = undefined;
    document.removeEventListener('visibilitychange', onVisibilityChange);
  }
  function retainClock() {
    if (consumers++ === 0) {
      updateClock();
      timer = setInterval(updateClock, 1000);
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (--consumers === 0) stopClock();
    };
  }
  onScopeDispose(() => { if (timer !== undefined) stopClock(); });

  function hourInTimezone(timezone: string | null | undefined) {
    if (!timezone) return null;
    try {
      return Number(new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone, hour: '2-digit', hourCycle: 'h23',
      }).format(now.value));
    } catch { return null; }
  }
  function phaseInTimezone(timezone: string | null | undefined) {
    const hour = hourInTimezone(timezone);
    if (hour === null) return null;
    return DAY_PHASES.find(phase => hour >= phase.from && hour < phase.to) ?? DAY_PHASES[3];
  }
  const currentPhase = computed(() => phaseInTimezone(area.value?.timezone));
  const fishTimeBucket = computed(() => {
    const hour = hourInTimezone(area.value?.timezone);
    return hour === null ? null : hour >= 6 && hour < 19 ? 'DAY' : 'NIGHT';
  });
  const timeLabel = computed(() => {
    if (!currentPhase.value || !area.value?.timezone) return '';
    return new Intl.DateTimeFormat(getFormattingLocale(), {
      timeZone: area.value.timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).format(now.value);
  });
  function sceneForArea(value: Pick<FishingAreaDetails, 'scenePath' | 'timezone'> | null) {
    const phase = phaseInTimezone(value?.timezone);
    return value?.scenePath && phase ? `${value.scenePath}/${phase.key}.png` : '';
  }
  const currentScenePhace = computed(() => sceneForArea(area.value));
  const previewScene = computed(() => sceneForArea(previewArea.value));
  async function loadPreviewArea(areaId: string | null) {
    const request = ++previewRequest;
    previewArea.value = null;
    if (!areaId) return;
    try {
      const result = await supabaseFishingAreaRepository.fetchOneAreas(areaId);
      if (request === previewRequest) previewArea.value = result;
    } catch (error) {
      if (request === previewRequest) console.error('Unable to load area scene:', error);
    }
  }
  function setCurrentScenePhase(value: FishingSceneArea | null) {
    area.value = value;
  }
  function $reset() { area.value = null; updateClock(); }

  return { now, area, previewArea, currentPhase, fishTimeBucket, timeLabel, currentScenePhace, previewScene, loadPreviewArea, retainClock, sceneForArea, setCurrentScenePhase, $reset };
});
