<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useWorld2Store } from "../../stores/world2.ts";
import { useRouter } from "vue-router";
import World2 from "./World2.vue";
import PrepareModal from "./PrepareModal.vue";
import { useFishingAreaStore } from "../../stores/fishingArea.ts";
import { useUserInAreaStore } from "../../stores/userInArea.ts";
import { useAuthStore } from "../../stores/auth.ts";
import { useDayPhaseStore } from "../../stores/dayPhase.ts";
import { useToast } from "../../composables/useToast.ts";
import FishingAnchor from "./FishingAnchor.vue";
import { useModalStore } from "../../stores/modal.ts";


const toast = useToast();
const authStore = useAuthStore();
const userInAreaStore = useUserInAreaStore();
const dayPhaseStore = useDayPhaseStore();
const fishingAreaStore = useFishingAreaStore();
const modalStore = useModalStore()
const zoomInfo = ref({ lon: 0, lat: 0, k: 1 });
const picked = ref<string>("");
const mapRef = ref<InstanceType<typeof World2> | null>(null);
const pickEnabled = computed(() => worldStore.isAnchorMode);
const isAdminMode = computed(() => worldStore.showAnchorSelectButton);
const anchor = computed(() => worldStore.pickedLocation);
const worldStore = useWorld2Store();
const selectedArea = computed(() => (worldStore.selectedArea?.id ? worldStore.selectedArea : null));
const pendingArea = ref<any | null>(null);
const showPrepare = ref(false);
const isEntering = ref(false);

onMounted(async () => {
  // Khôi phục vị trí đã lưu trước đó rồi đưa bản đồ tới đó ngay
  worldStore.moveMapToCachedLocation();
  await nextTick();
  if (worldStore.k !== 1 || worldStore.lon !== 0 || worldStore.lat !== 0) {
    mapRef.value?.setView({ lon: worldStore.lon, lat: worldStore.lat, k: worldStore.k });
  }
  if (!fishingAreaStore.loaded) fishingAreaStore.fetchArea();
  userInAreaStore.setCurrentUserInArea(authStore.userId);
});

function togglePick() {
  if (!worldStore.anchorable) {
    toast.info("Mở khóa form để thao tác", { title: "Nhắc nhở", position: "bottom", duration: 2000 });
    return;
  }
  worldStore.toggleAnchorMode();
}

function onSelectArea(area: any) {
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
  if (!userInAreaStore.canEnterFishingArea) {
    toast.error("Cần kết thúc xử lý cá trong lưới trước", { title: "Thao tác bị chặn", position: "top" });
    return;
  }
  pendingArea.value = area;
  modalStore.open("prepare");
}

interface PickPoint {
  screen: { x: number; y: number }; // px trên canvas
  map: { x: number; y: number }; // toạ độ trong hệ chưa zoom
  lon: number | null;
  lat: number | null;
  k: number;
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
  <div class="grid grid-cols-1 md:grid-cols-[auto_1fr] h-fit gap-2">
    <FishingAnchor />
    <div class="flex flex-col gap-2">
      <div class="w-full h-fit overflow-hidden grid place-items-center border border-gray-300 rounded-xl">
        <World2 ref="mapRef" :areas="fishingAreaStore.fishingAreas" :selected-area-id="selectedArea?.id ?? null" :pick-enabled="pickEnabled" :anchor="anchor" @pick="onPick" @zoom="onZoom" @select-area="onSelectArea">
          <template #popup="{ area }">
            <div class="flex flex-col gap-1.5 rounded-lg bg-white p-2 text-xs text-gray-800 shadow-lg">
              <div class="flex items-center justify-between gap-2 font-bold">
                <span class="whitespace-nowrap">{{ area.title }}</span>
                <button type="button" class="text-base leading-none text-gray-500" @click="worldStore.targetArea({})">
                  ×
                </button>
              </div>
              <div class="overflow-hidden rounded-md">
                <img :src="dayPhaseStore.currentScenePhace" class="w-full hover:scale-110 duration-200" draggable="false" />
              </div>
              <button v-if="!isAdminMode" type="button" class="w-full rounded-lg bg-green-500 px-2 py-1.5 font-bold text-white hover:bg-green-600 disabled:opacity-70" :disabled="isEntering" @click="openPrepare(area)">
                {{ isEntering ? "Đang vào..." : "Đi đến bãi câu" }}
              </button>
            </div>
          </template>
        </World2>
      </div>
      <div class="flex gap-2">
        <button @click="zoomTo(3)" class="border border-gray-300 rounded-md px-3">3x</button>
        <button @click="zoomTo(6)" class="border border-gray-300 rounded-md px-3">6x</button>
        <button @click="zoomTo(12)" class="border border-gray-300 rounded-md px-3">12x</button>
        <button @click="zoomTo(24)" class="border border-gray-300 rounded-md px-3">24x</button>
      </div>
      <div class="flex gap-2">
        <button @click="togglePick" class="border border-gray-300 rounded-md px-3">{{ pickEnabled ? "Tắt xác định vị trí" : "Bật xác định vị trí" }}</button>
      </div>
    </div>
  </div>
</template>
