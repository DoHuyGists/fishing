import type { ZoneWeatherRow } from '../types/table/zone';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { computed, onScopeDispose, ref } from 'vue';
import { defineStore } from 'pinia';
import { t as tr } from '../i18n';
import { utcToLocalMs } from '../utils/time';
import { supabaseZoneRepository } from '../data/supabaseZoneRepository';

export const useWeatherStore = defineStore('weather', () => {
  const zone = ref<ZoneWeatherRow | null>(null);
  const areaId = ref<string | null>(null);
  const loading = ref(false);
  const error = ref('');
  const now = ref(Date.now());
  const requestId = ref(0);
  const weather = computed(() => zone.value?.weather ?? null);
  const modifiers = computed(() => zone.value?.weather_active_modifiers ?? []);
  const consumers = new Map<symbol, string>();
  let channel: RealtimeChannel | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  let lastRefetch = 0;
  let refreshingRequest: number | null = null;
  let queuedRefresh: number | null = null;

  async function stop() {
    const previousChannel = channel;
    channel = null;
    if (previousChannel) await supabaseZoneRepository.unsubscribe(previousChannel);
  }

  async function load(id: string, activeRequestId = ++requestId.value) {
    loading.value = true;
    error.value = '';
    try {
      const result = await supabaseZoneRepository.fetchZoneByAreaId(id);
      if (activeRequestId !== requestId.value) return;
      zone.value = result;
      return result;
    } catch (err) {
      if (activeRequestId === requestId.value) {
        error.value = err instanceof Error ? err.message : tr('weather.khong_the_tai_thong_tin_moi_truong');
      }
    } finally {
      if (activeRequestId === requestId.value) loading.value = false;
    }
  }

  async function init(id: string) {
    const request = ++requestId.value;
    areaId.value = id;
    zone.value = null;
    loading.value = true;
    error.value = '';
    lastRefetch = Date.now();
    await stop();
    if (request !== requestId.value) return;
    const result = await load(id, request);
    if (request !== requestId.value || !result) return;
    channel = supabaseZoneRepository.subscribeToZone(result.id, () => {
      if (request === requestId.value) void refresh();
    });
  }

  async function refresh() {
    const request = requestId.value;
    if (!zone.value) return;
    if (refreshingRequest === request) {
      queuedRefresh = request;
      return;
    }
    const zoneId = zone.value.id;
    refreshingRequest = request;
    try {
      const result = await supabaseZoneRepository.fetchZoneById(zoneId);
      if (request === requestId.value) {
        zone.value = result;
        error.value = '';
      }
    } catch (err) {
      if (request === requestId.value) {
        error.value = err instanceof Error ? err.message : tr('weather.khong_the_cap_nhat_moi_truong');
      }
    } finally {
      if (refreshingRequest === request) refreshingRequest = null;
      // A Realtime event during the fetch may describe a newer server snapshot.
      if (queuedRefresh === request) {
        queuedRefresh = null;
        if (request === requestId.value) void refresh();
      }
    }
  }

  function tick() {
    now.value = Date.now();
    const expiresAt = utcToLocalMs(zone.value?.weather_expires_at);
    // The server owns weather changes. Retry expired weather or a failed initial load.
    if (areaId.value && !loading.value && ((!zone.value && error.value) || expiresAt <= now.value)
      && now.value - lastRefetch >= 10000) {
      lastRefetch = now.value;
      if (zone.value) void refresh();
      else void init(areaId.value);
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') tick();
  }

  function stopClock() {
    clearInterval(timer);
    timer = undefined;
    document.removeEventListener('visibilitychange', onVisibilityChange);
  }

  async function reset() {
    requestId.value++;
    areaId.value = null;
    zone.value = null;
    loading.value = false;
    error.value = '';
    await stop();
  }

  // Screen owners retain data; hiding a panel must not stop Realtime.
  // Releasing an older owner during navigation cannot reset the newer screen.
  function retain(id: string) {
    const token = Symbol(id);
    consumers.set(token, id);
    if (timer === undefined) {
      now.value = Date.now();
      timer = setInterval(tick, 1000);
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
    if (areaId.value !== id) void init(id);
    return () => {
      if (!consumers.delete(token)) return;
      const remaining = [...consumers.values()].at(-1);
      if (!remaining) {
        stopClock();
        void reset();
      } else if (remaining !== areaId.value) void init(remaining);
    };
  }

  onScopeDispose(() => {
    consumers.clear();
    if (timer !== undefined) stopClock();
    void reset();
  });

  return { zone, areaId, loading, error, now, requestId, weather, modifiers, load, init, refresh, stop, reset, retain };
});
