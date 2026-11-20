import { computed } from 'vue';
import { defineStore } from 'pinia';
import { resolveFishingScene } from '../data/fishingSceneVariants';
import { useDayPhaseStore } from './player-day-phase-store';
import { useWeatherStore } from './player-weather-store';

export const useFishingSceneStore = defineStore('FishingScene', () => {
  const dayPhase = useDayPhaseStore();
  const weather = useWeatherStore();
  const sceneKey = computed(() => dayPhase.area?.id ?? dayPhase.area?.scenePath ?? '');
  const fallbackSceneImage = computed(() => dayPhase.currentScenePhace);
  const sceneImage = computed(() => resolveFishingScene(
    dayPhase.area?.scenePath,
    dayPhase.currentPhase?.key ?? null,
    dayPhase.area?.id && weather.areaId === dayPhase.area.id ? weather.weather?.code : null,
  ));

  return { sceneKey, sceneImage, fallbackSceneImage };
});
