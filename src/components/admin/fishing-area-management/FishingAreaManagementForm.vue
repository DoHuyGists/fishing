<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { mapData } from "../../../data/map.ts";
import type { FishingAreaPayload } from "../../../data/supabaseFishingAreaRepository.ts";
import { useWorld2Store } from "../../../stores/world2.ts";
import { useToast } from "../../../composables/useToast.ts";
import { useAdminZoneStore } from "../zone-management/admin-zone-store.ts";
import { useAdminFishingAreaStore } from "./admin-fishing-area-store.ts";
import FishingBoundaryPickerModal from "./FishingBoundaryPickerModal.vue";

const worldStore = useWorld2Store();
const toast = useToast();
const zoneStore = useAdminZoneStore();
const fishingAreaStore = useAdminFishingAreaStore();
const adminFishingAreaStore = fishingAreaStore;
const isSaving = ref(false);
const formError = ref("");
const isBoundaryPickerOpen = ref(false);
const boundaryDraft = ref<Array<{ x: number; y: number }>>([]);
const sceneImageUrl = computed(() => {
  const scenePath = adminFishingAreaStore.target?.scenePath?.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  return scenePath ? `${scenePath}/day.png` : "";
});

function toggleAnchorMode() {
  if (!worldStore.anchorable) {
    toast.info("Mở khóa form để thao tác", { title: "Nhắc nhở", position: "bottom", duration: 2000 });
    return;
  }
  worldStore.toggleAnchorMode();
}

function openBoundaryPicker() {
  const currentBoundary = adminFishingAreaStore.target?.fishingBoundary;
  const hasValidBoundary =
    Array.isArray(currentBoundary) &&
    currentBoundary.length > 0 &&
    currentBoundary.every((point) => point && typeof point.x === "number" && typeof point.y === "number");

  boundaryDraft.value = hasValidBoundary
    ? currentBoundary.map(({ x, y }) => ({ x, y }))
    : [
        { x: 0, y: 100 },
        { x: 0, y: 100 },
      ];
  isBoundaryPickerOpen.value = true;
}

function finishBoundarySelection(boundary: Array<{ x: number; y: number }>) {
  if (!adminFishingAreaStore.target) return;
  adminFishingAreaStore.target.fishingBoundary = boundary.map(({ x, y }) => ({ x, y }));
  isBoundaryPickerOpen.value = false;
}

function buildPayload(): FishingAreaPayload | null {
  if (!adminFishingAreaStore.target) return null;

  if (!adminFishingAreaStore.target.countryId) {
    formError.value = "Vui lòng chọn quốc gia";
    return null;
  }

  let location: any = null;
  location = adminFishingAreaStore.target.location;
  if (typeof location?.lon !== "number" || typeof location?.lat !== "number" || typeof location?.k !== "number") {
    formError.value = "Vui lòng chọn vị trí trên bản đồ";
    return null;
  }

  let fishingBoundary: any[];
  try {
    fishingBoundary = adminFishingAreaStore.target.fishingBoundary;
  } catch {
    formError.value = "Vùng câu (fishing_boundary) không đúng định dạng JSON";
    return null;
  }

  if (
    !Array.isArray(fishingBoundary) ||
    !fishingBoundary.every((point) => point && typeof point.x === "number" && typeof point.y === "number")
  ) {
    formError.value = 'Vùng câu (fishing_boundary) phải là mảng các object dạng {"x": number, "y": number}';
    return null;
  }

  const rawDepth = adminFishingAreaStore.target.maxDepth as number | string | null;
  const maxDepth = rawDepth === null || rawDepth === "" ? null : Number(rawDepth);
  if (maxDepth !== null && (!Number.isFinite(maxDepth) || maxDepth < 0)) {
    formError.value = "Độ sâu tối đa phải là số không âm";
    return null;
  }

  return {
    zoneId: adminFishingAreaStore.target.zoneId || null,
    maxDepth,
    countryId: adminFishingAreaStore.target.countryId,
    isAvailable: adminFishingAreaStore.target.isAvailable,
    title: adminFishingAreaStore.target.title?.trim() || null,
    location,
    scenePath: adminFishingAreaStore.target.scenePath?.trim() || null,
    fishingBoundary,
  };
}

async function handleSave() {
  if (!adminFishingAreaStore.target) return;
  formError.value = "";
  const payload = buildPayload();
  if (!payload) return;

  isSaving.value = true;
  try {
    if (adminFishingAreaStore.target.id) {
      await fishingAreaStore.updateAreaAdmin(adminFishingAreaStore.target.id, payload);
    } else {
      await fishingAreaStore.createAreaAdmin(payload);
    }
    adminFishingAreaStore.closeForm();

    // Clear
    worldStore.resetDefault();
  } catch (err) {
    formError.value = err instanceof Error ? err.message : "Không thể lưu bãi câu";
  } finally {
    isSaving.value = false;
  }
}
const countryOptions = computed(() =>
  Object.entries(mapData)
    .map(([code, info]) => ({ code, name: (info as any).name }))
    .sort((a, b) => a.name.localeCompare(b.name)),
);

// Đồng bộ từ bản đồ vào form (chỉ lấy lon, lat, k)
watch(
  () => worldStore.pickVersion,
  () => {
    const picked = worldStore.pickedLocation;
    if (!adminFishingAreaStore.target || adminFishingAreaStore.isFormLock !== false) return;
    if (!worldStore.isAnchorMode || !picked) return;
    adminFishingAreaStore.target.location = { k: picked.k, lat: picked.lat, lon: picked.lon };
  },
);

// Đồng bộ từ form cập nhật ra bản đồ
watch(
  () => (adminFishingAreaStore.isUpdate ? adminFishingAreaStore.target?.id : null),
  () => {
    const area = adminFishingAreaStore.target;
    if (!area || !adminFishingAreaStore.isUpdate) return;
    const loc = area.location;
    if (typeof loc?.lon === "number" && typeof loc?.lat === "number" && typeof loc?.k === "number") {
      worldStore.setPickedLocation({ k: loc.k, lat: loc.lat, lon: loc.lon });
      worldStore.handleMoveToArea(area);
    } else {
      worldStore.setPickedLocation(null);
    }
  },
  { immediate: true },
);

watch(
  () => adminFishingAreaStore.isFormLock,
  (isFormLock) => {
    if (isFormLock) {
      worldStore.disabledInteraction();
    } else {
      worldStore.enableInteraction();
    }
  },
  { immediate: true },
);

onMounted(() => {
  worldStore.showAnchorSelectButton = true;
  if (!zoneStore.items.length) zoneStore.fetchAll();
});

onUnmounted(() => {
  worldStore.showAnchorSelectButton = false;
  worldStore.resetDefault();
});
</script>

<template>
  <div
    v-if="adminFishingAreaStore.isFormOpen && adminFishingAreaStore.target"
    class="w-full shrink-0 border-l border-gray-200 bg-white overflow-y-auto"
  >
    <div class="p-5 flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <h3 class="m-0 text-sm font-extrabold text-[#153221]">
          {{ adminFishingAreaStore.isUpdate ? "Chỉnh sửa bãi câu" : "Thêm bãi câu mới" }}
        </h3>
        <button
          type="button"
          @click="adminFishingAreaStore.closeForm"
          class="text-gray-400 hover:text-gray-700 cursor-pointer text-lg leading-none"
        >
          &times;
        </button>
      </div>

      <div v-if="formError" class="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs">
        {{ formError }}
      </div>

      <div v-if="adminFishingAreaStore.isUpdate" class="text-xs">
        <button v-if="adminFishingAreaStore.isFormLock" @click="adminFishingAreaStore.isFormLock = false" type="button">
          🔒 Đang khóa
        </button>
        <button v-else @click="adminFishingAreaStore.isFormLock = true" type="button">🔒 Đã mở khóa</button>
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-[11px] font-bold text-gray-500 uppercase">Tên bãi câu</label>
        <input
          v-model="adminFishingAreaStore.target.title"
          type="text"
          placeholder="Ví dụ: Hồ Xanh"
          :disabled="adminFishingAreaStore.isFormLock"
          class="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-[11px] font-bold text-gray-500 uppercase">Quốc gia</label>
        <select
          v-model="adminFishingAreaStore.target.countryId"
          class="px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:border-emerald-500"
          :disabled="adminFishingAreaStore.isFormLock"
        >
          <option v-for="option in countryOptions" :key="option.code" :value="option.code">
            {{ option.name }}
          </option>
        </select>
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-[11px] font-bold text-gray-500 uppercase">Vùng</label>
        <select
          v-model="adminFishingAreaStore.target.zoneId"
          class="px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:border-emerald-500"
          :disabled="adminFishingAreaStore.isFormLock"
        >
          <option :value="null">-- Không chọn --</option>
          <option v-for="zone in zoneStore.items" :key="zone.id" :value="zone.id">
            {{ zone.name }} ({{ zone.code }})
          </option>
        </select>
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-[11px] font-bold text-gray-500 uppercase">Độ sâu tối đa (max_depth)</label>
        <input
          v-model.number="adminFishingAreaStore.target.maxDepth"
          type="number"
          min="0"
          step="any"
          placeholder="Ví dụ: 50"
          :disabled="adminFishingAreaStore.isFormLock"
          class="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
        />
      </div>

      <label class="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer select-none">
        <input
          v-model="adminFishingAreaStore.target.isAvailable"
          type="checkbox"
          class="w-4 h-4 accent-emerald-700"
          :disabled="adminFishingAreaStore.isFormLock"
        />
        Kích hoạt (hiển thị trên bản đồ)
      </label>

      <div class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between gap-2">
          <label class="text-[11px] font-bold text-gray-500 uppercase">Location</label>
          <button
            type="button"
            @click="toggleAnchorMode"
            class="shrink-0 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-3 py-1.5 text-xs font-bold text-[#24352a] transition-colors hover:bg-[#eaf2e3]"
          >
            {{ worldStore.isAnchorMode ? "Tắt xác định vị trí" : "Bật xác định vị trí" }}
          </button>
        </div>
        <textarea
          :value="JSON.stringify(adminFishingAreaStore.target.location ?? [], null, 2)"
          rows="7"
          placeholder='{"k": 25, "lat": 10.82302, "lon": 106.62965}'
          class="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-mono focus:outline-none focus:border-emerald-500 resize-none"
          disabled
        ></textarea>
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-[11px] font-bold text-gray-500 uppercase">Đường dẫn cảnh</label>
        <input
          v-model="adminFishingAreaStore.target.scenePath"
          type="text"
          placeholder="area/VN/770.400"
          class="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
          :disabled="adminFishingAreaStore.isFormLock"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between gap-2">
          <label class="text-[11px] font-bold text-gray-500 uppercase">Vùng câu</label>
          <button
            v-if="adminFishingAreaStore.target.scenePath?.trim()"
            type="button"
            @click="openBoundaryPicker"
            :disabled="adminFishingAreaStore.isFormLock"
            class="self-start px-3 py-1.5 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] text-xs font-bold hover:bg-[#eaf2e3] cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Thiết lập vùng câu
          </button>
        </div>
        <textarea
          :value="JSON.stringify(adminFishingAreaStore.target.fishingBoundary ?? [], null, 2)"
          rows="7"
          placeholder='[{"x": 0, "y": 0}, {"x": 10, "y": 0}]'
          class="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-mono focus:outline-none focus:border-emerald-500 resize-none"
          disabled
        ></textarea>
      </div>

      <div class="flex items-center gap-2 pt-2 border-t border-gray-100">
        <button
          type="button"
          @click="handleSave"
          :disabled="isSaving"
          class="flex-1 px-3 py-2 rounded-lg bg-[#153221] hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
        >
          {{ isSaving ? "Đang lưu..." : "Lưu" }}
        </button>
        <button
          type="button"
          @click="adminFishingAreaStore.closeForm"
          class="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-bold cursor-pointer transition-colors"
        >
          Huỷ
        </button>
      </div>
    </div>
  </div>

  <FishingBoundaryPickerModal
    v-if="isBoundaryPickerOpen"
    :scene-image-url="sceneImageUrl"
    :initial-boundary="boundaryDraft"
    @close="isBoundaryPickerOpen = false"
    @complete="finishBoundarySelection"
  />
</template>
