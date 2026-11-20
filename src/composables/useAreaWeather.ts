import { onScopeDispose, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { useWeatherStore } from '../stores/player-weather-store';

export function useAreaWeather(areaId: MaybeRefOrGetter<string | null | undefined>) {
  const store = useWeatherStore();
  let release: (() => void) | undefined;
  watch(() => toValue(areaId), id => {
    const previous = release;
    release = id ? store.retain(id) : undefined;
    previous?.();
  }, { immediate: true });
  onScopeDispose(() => release?.());
  return store;
}
