<script lang="ts" setup>
import { useGameCatalogRefresh } from "../../../composables/useGameCatalogRefresh";
import type { PickPoint } from "../../../types/model/worldMap";
import { t as tr } from "../../../i18n";

import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useWorldStore } from "../../../stores/player-world-map-store.ts";
import WorldMap from "./WorldMap.vue";
import { useFishingAreaStore } from "../../../stores/player-fishing-area-store.ts";
import { useUserInAreaStore } from "../../../stores/player-user-In-area-store.ts";
import { useAuthStore } from "../../../stores/auth.ts";
import { useDayPhaseClock } from "../../../composables/useDayPhaseClock";
import { useToast } from "../../../composables/useToast.ts";
import FishingAnchor from "./FishingAnchor.vue";
import FishingAreaPopup from "./FishingAreaPopup.vue";
import { useRouter } from "vue-router";
import { useCountryStore } from "../../../stores/player-country-store.ts";
import { useFeatureAvailabilityStore } from "../../../stores/player-feature-availability-store.ts";

const props = withDefaults(defineProps<{ fogEnabled?: boolean; collapsible?: boolean }>(), {
  fogEnabled: true,
  collapsible: false,
});

const toast = useToast();
const authStore = useAuthStore();
const countryStore = useCountryStore();
const features = useFeatureAvailabilityStore();
const userInAreaStore = useUserInAreaStore();
const dayPhaseStore = useDayPhaseClock();
const fishingAreaStore = useFishingAreaStore();
const router = useRouter();
const zoomInfo = ref({ lon: 0, lat: 0, k: 1 });
const picked = ref<string>("");
const mapRef = ref<InstanceType<typeof WorldMap> | null>(null);
const pickEnabled = computed(() => worldStore.isAnchorMode);
const anchor = computed(() => worldStore.pickedLocation);
const worldStore = useWorldStore();
const isMapVisible = computed(() => !props.collapsible || worldStore.isMapVisible);
useGameCatalogRefresh(["countries", "areas"], () => isMapVisible.value && features.isAvailable("world-map"));
const selectedArea = computed(() => (worldStore.selectedArea?.id ? worldStore.selectedArea : null));
const isEntering = ref(false);

watch(isMapVisible, async (visible) => {
  if (!visible) return;
  await nextTick();
  mapRef.value?.setView(worldStore.getLocation());
});

watch(
  () =>
    [props.fogEnabled && isMapVisible.value && features.isAvailable("world-map"), authStore.user?.id ?? null] as const,
  ([enabled, playerId], _, onCleanup) => {
    if (enabled) onCleanup(countryStore.watchUnlockedCountries(playerId, 300_000));
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

watch(
  () => features.isAvailable("world-map"),
  async (enabled) => {
    if (enabled) void fishingAreaStore.fetchArea();
    if (!enabled) {
      worldStore.isAnchorMode = false;
    } else {
      await nextTick();
      mapRef.value?.setView(worldStore.getLocation());
    }
  },
  { immediate: true },
);

function togglePick() {
  if (!worldStore.anchorable) {
    toast.info(tr("InteractWorldMap.mo_khoa_form_de_thao_tac"), {
      get title() {
        return tr("InteractWorldMap.nhac_nho");
      },
    });
    return;
  }
  worldStore.toggleAnchorMode();
}

function onSelectArea(area: any) {
  if (!features.isAvailable("world-map")) return;
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
    void dayPhaseStore.loadPreviewArea(area?.id ?? null);
    if (!area?.id) return;
    const loc = area.location;
    if (typeof loc?.lon === "number" && typeof loc?.lat === "number") {
      worldStore.lon = loc.lon;
      worldStore.lat = loc.lat;
      if (typeof loc.k === "number") worldStore.k = loc.k;
    }
  },
  { immediate: true },
);

async function openPrepare(area: any) {
  if (isEntering.value || !area?.id) return;
  const blocked = ["world-map", "enter-area"].find((key) => !features.isAvailable(key));
  if (blocked) {
    features.notify(blocked);
    return;
  }
  if (!userInAreaStore.canEnterFishingArea) {
    toast.error(tr("InteractWorldMap.can_ket_thuc_xu_ly_ca_trong_luoi_truoc"), {
      get title() {
        return tr("InteractWorldMap.thao_tac_bi_chan");
      },
      position: "top",
    });
    return;
  }
  isEntering.value = true;
  try {
    await router.push({ name: "prepare", params: { areaId: area.id } });
  } finally {
    isEntering.value = false;
  }
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
  <div
    v-if="features.isAvailable('world-map')"
    class="grid grid-cols-1 h-fit gap-2"
    :class="{ 'md:grid-cols-[auto_1fr]': isMapVisible }"
  >
    <FishingAnchor
      class="slide-fade-in from-left"
      :collapsible="collapsible"
      :map-visible="isMapVisible"
      @toggle-map="worldStore.toggleMapVisibility()"
    />
    <div v-if="isMapVisible" class="slide-fade-in from-bottom flex flex-col gap-1 bg-surface p-1 rounded-xl h-fit">
      <div
        class="w-full h-fit overflow-hidden grid place-items-center border border-content rounded-xl"
      >
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
            <FishingAreaPopup
              :area="area"
              :preview-scene="dayPhaseStore.previewScene"
              :is-entering="isEntering"
              :enter-area-available="features.isAvailable('enter-area')"
              @close="worldStore.targetArea({})"
              @enter="features.isAvailable('enter-area') ? openPrepare(area) : features.showDetails('enter-area')"
            />
          </template>
        </WorldMap>
      </div>
      <div v-if="fogEnabled && countryStore.unlockedError" class="text-xs text-danger" role="alert">
        {{ countryStore.unlockedError }}
        <button type="button" class="ml-1 underline cursor-pointer" @click="countryStore.fetchMyUnlockedCountries()">
          {{ tr("Maintenance.thu_lai") }}
        </button>
      </div>
      <div class="slide-fade-in from-bottom-right flex gap-1 text-xs">
        <button @click="zoomTo(3)" class="border border-content rounded-md p-1 gap-1 flex"><span>🔍</span> 3x</button>
        <button @click="zoomTo(6)" class="border border-content rounded-md p-1 gap-1 flex"><span>🔍</span> 6x</button>
        <button @click="zoomTo(12)" class="border border-content rounded-md p-1 gap-1 flex"><span>🔍</span> 12x</button>
        <button @click="zoomTo(24)" class="border border-content rounded-md p-1 gap-1 flex"><span>🔍</span> 24x</button>
      </div>
    </div>
  </div>
  <div v-else class="rounded-xl border border-border-default bg-surface p-4 text-sm text-content" role="status">
    <div class="font-semibold">
      {{ tr("FishingAnchor.ban_do") }} ·
      <button
        type="button"
        class="cursor-pointer underline underline-offset-2"
        aria-haspopup="dialog"
        @click="features.showDetails('world-map')"
      >
        {{ tr("FeatureAvailability.maintenanceBadge") }}
      </button>
    </div>
  </div>
</template>
