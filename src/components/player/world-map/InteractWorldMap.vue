<script lang="ts" setup>
import type { PickPoint } from "../../../types/model/worldMap";
import { t as tr } from "../../../i18n";

import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useWorldStore } from "../../../stores/worldMap.ts";
import WorldMap from "./WorldMap.vue";
import { useFishingAreaStore } from "../../../stores/fishingArea.ts";
import { useUserInAreaStore } from "../../../stores/userInArea.ts";
import { useAuthStore } from "../../../stores/auth.ts";
import { useDayPhaseStore } from "../../../stores/dayPhase.ts";
import { useToast } from "../../../composables/useToast.ts";
import FishingAnchor from "./FishingAnchor.vue";
import { useModalStore } from "../../../stores/modal.ts";
import { useCountryStore } from "../../../stores/country.ts";
import { useFeatureAvailabilityStore } from "../../../stores/featureAvailability";

const props = withDefaults(defineProps<{ fogEnabled?: boolean; collapsible?: boolean }>(), {
  fogEnabled: true,
  collapsible: false,
});

const toast = useToast();
const authStore = useAuthStore();
const countryStore = useCountryStore();
const features = useFeatureAvailabilityStore();
const userInAreaStore = useUserInAreaStore();
const dayPhaseStore = useDayPhaseStore();
const fishingAreaStore = useFishingAreaStore();
const modalStore = useModalStore();
const zoomInfo = ref({ lon: 0, lat: 0, k: 1 });
const picked = ref<string>("");
const mapRef = ref<InstanceType<typeof WorldMap> | null>(null);
const pickEnabled = computed(() => worldStore.isAnchorMode);
const anchor = computed(() => worldStore.pickedLocation);
const worldStore = useWorldStore();
const isMapVisible = computed(() => !props.collapsible || worldStore.isMapVisible);
const selectedArea = computed(() => (worldStore.selectedArea?.id ? worldStore.selectedArea : null));
const pendingArea = ref<any | null>(null);
const isEntering = ref(false);

watch(isMapVisible, async (visible) => {
  if (!visible) return;
  await nextTick();
  mapRef.value?.setView(worldStore.getLocation());
});

watch(
  () => [props.fogEnabled && features.isAvailable('world-map'), authStore.user?.id ?? null] as const,
  ([enabled, playerId], _, onCleanup) => {
    if (enabled) onCleanup(countryStore.watchUnlockedCountries(playerId));
  },
  { immediate: true },
);

onMounted(async () => {
  // Khôi phục vị trí đã lưu trước đó rồi đưa bản đồ tới đó ngay
  worldStore.moveMapToCachedLocation();
  await nextTick();
  if (worldStore.k !== 1 || worldStore.lon !== 0 || worldStore.lat !== 0) {
    mapRef.value?.setView({ lon: worldStore.lon, lat: worldStore.lat, k: worldStore.k });
  }
  userInAreaStore.setCurrentUserInArea(authStore.userId);
});

watch(() => features.isAvailable('world-map'), async enabled => {
  if (enabled && !fishingAreaStore.loaded) void fishingAreaStore.fetchArea();
  if (!enabled) { pendingArea.value = null; worldStore.isAnchorMode = false; }
  else {
    await nextTick();
    mapRef.value?.setView(worldStore.getLocation());
  }
}, { immediate: true });

function togglePick() {
  if (!worldStore.anchorable) {
    toast.info(tr('InteractWorldMap.mo_khoa_form_de_thao_tac'), { get title() { return tr('InteractWorldMap.nhac_nho'); } });
    return;
  }
  worldStore.toggleAnchorMode();
}

function onSelectArea(area: any) {
  if (!features.isAvailable('world-map')) return;
  worldStore.targetArea(area);
}

// Store -> map: đổi k/lon/lat từ bên ngoài thì map di chuyển theo
watch(
  () => [worldStore.k, worldStore.lon, worldStore.lat],
  ([k, lon, lat]) => {
    const cur = zoomInfo.value;
    if (Math.abs(cur.k - k) < 1e-6 && Math.abs(cur.lon - lon) < 1e-6 && Math.abs(cur.lat - lat) < 1e-6) return;
    mapRef.value?.setView({ lon, lat, k, duration: 600 });
  },
);

// Chọn bãi câu (từ chấm đỏ hoặc từ store) -> cập nhật cảnh và bay tới bãi đó
watch(
  () => worldStore.selectedArea,
  (area) => {
    if (!area?.id) return;
    dayPhaseStore.setCurrentScenePhase(area);
    const loc = area.location;
    if (typeof loc?.lon === "number" && typeof loc?.lat === "number") {
      worldStore.lon = loc.lon;
      worldStore.lat = loc.lat;
      if (typeof loc.k === "number") worldStore.k = loc.k;
    }
  },
  { immediate: true },
);

function openPrepare(area: any) {
  const blocked = ['world-map', 'enter-area'].find(key => !features.isAvailable(key));
  if (blocked) { features.notify(blocked); return; }
  if (!userInAreaStore.canEnterFishingArea) {
    toast.error(tr('InteractWorldMap.can_ket_thuc_xu_ly_ca_trong_luoi_truoc'), { get title() { return tr('InteractWorldMap.thao_tac_bi_chan'); }, position: "top" });
    return;
  }
  pendingArea.value = area;
  modalStore.open("prepare");
}

function onZoom(s: { center: [number, number] | null; k: number }) {
  zoomInfo.value = {
    lon: s.center?.[0] ?? 0,
    lat: s.center?.[1] ?? 0,
    k: s.k,
  };
  worldStore.k = s.k;
  worldStore.lon = zoomInfo.value.lon;
  worldStore.lat = zoomInfo.value.lat;
  worldStore.cachedMapLocation();
}

function onPick(p: PickPoint) {
  picked.value =
    p.lon != null && p.lat != null
      ? `Screen: ${p.screen.x.toFixed(0)}, ${p.screen.y.toFixed(0)} | Map: ${p.map.x.toFixed(1)}, ${p.map.y.toFixed(1)} | Lon/lat: ${p.lon.toFixed(5)}, ${p.lat.toFixed(5)}`
      : `Screen: ${p.screen.x.toFixed(0)}, ${p.screen.y.toFixed(0)} | Point is outside the map`;

  // Click đâu bay tới đó
  if (p.lon != null && p.lat != null) {
    mapRef.value?.setView({ lon: p.lon, lat: p.lat, k: 20, duration: 600 });
  }
  worldStore.setPickedLocation(p.lon != null && p.lat != null ? { lon: p.lon, lat: p.lat, k: p.k } : null, true);
}

function zoomTo(k: number) {
  mapRef.value?.setView({ k, duration: 300 }); // giữ nguyên tâm, chỉ đổi zoom
}
</script>

<template>
  <div v-if="features.isAvailable('world-map')" class="grid grid-cols-1 h-fit gap-2" :class="{ 'md:grid-cols-[auto_1fr]': isMapVisible }">
    <FishingAnchor
      class="slide-fade-in from-top-left"
      :collapsible="collapsible"
      :map-visible="isMapVisible"
      @toggle-map="worldStore.toggleMapVisibility()"
    />
    <div v-if="isMapVisible" class="flex flex-col gap-2">
      <div class="slide-fade-in from-top-right w-full h-fit overflow-hidden grid place-items-center border border-gray-300 rounded-xl">
        <WorldMap
          ref="mapRef"
          :areas="fishingAreaStore.visibleMapAreas"
          :selected-area-id="selectedArea?.id ?? null"
          :pick-enabled="pickEnabled"
          :anchor="anchor"
          :unlocked-country-ids="fogEnabled ? countryStore.unlockedWorldMapCountryIds : null"
          @pick="onPick"
          @zoom="onZoom"
          @select-area="onSelectArea"
        >
          <template #popup="{ area }">
            <div class="slide-fade-in from-bottom-left flex flex-col gap-1.5 rounded-lg bg-white p-2 text-xs text-gray-800 shadow-lg" style="--slide-distance: 16px; --duration: 0.3s">
              <div class="flex items-center justify-between gap-2 font-bold">
                <span class="whitespace-nowrap">{{ area.title }}</span>
                <button type="button" class="text-base leading-none text-gray-500" @click="worldStore.targetArea({})">
                  ×
                </button>
              </div>
              <div class="overflow-hidden rounded-md">
                <img
                  :src="dayPhaseStore.currentScenePhace"
                  class="w-full hover:scale-110 duration-200"
                  draggable="false"
                />
              </div>
              <button
                type="button"
                class="w-full rounded-lg bg-green-500 px-2 py-1.5 font-bold text-white hover:bg-green-600 disabled:opacity-70"
                :disabled="isEntering"
                aria-haspopup="dialog"
                :class="{ 'underline underline-offset-2': !features.isAvailable('enter-area') }"
                @click="features.isAvailable('enter-area') ? openPrepare(area) : features.showDetails('enter-area')"
              >
                {{ !features.isAvailable('enter-area') ? tr('FeatureAvailability.maintenanceBadge') : isEntering ? tr('InteractWorldMap.dang_vao') : tr('InteractWorldMap.di_den_bai_cau') }}
              </button>
            </div>
          </template>
        </WorldMap>
      </div>
      <div v-if="fogEnabled && countryStore.unlockedError" class="text-xs text-red-700" role="alert">
        {{ countryStore.unlockedError }}
        <button type="button" class="ml-1 underline cursor-pointer" @click="countryStore.fetchMyUnlockedCountries()">
          {{ tr('Maintenance.thu_lai') }}
        </button>
      </div>
      <div v-else-if="fogEnabled && countryStore.isLoadingUnlocked" class="text-xs text-[#24352a]" role="status">
        {{ tr('InteractWorldMap.dang_tai_quoc_gia_da_mo_khoa') }}
      </div>
      <div class="slide-fade-in from-bottom-right flex gap-2">
        <button @click="zoomTo(3)" class="border border-gray-300 rounded-md px-3">3x</button>
        <button @click="zoomTo(6)" class="border border-gray-300 rounded-md px-3">6x</button>
        <button @click="zoomTo(12)" class="border border-gray-300 rounded-md px-3">12x</button>
        <button @click="zoomTo(24)" class="border border-gray-300 rounded-md px-3">24x</button>
      </div>
    </div>
  </div>
  <div v-else class="rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-4 text-sm text-[#24352a]" role="status">
    <div class="font-semibold">
      {{ tr('FishingAnchor.ban_do') }} ·
      <button type="button" class="cursor-pointer underline underline-offset-2" aria-haspopup="dialog" @click="features.showDetails('world-map')">{{ tr('FeatureAvailability.maintenanceBadge') }}</button>
    </div>
  </div>
</template>
