

<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { mapData } from "../../../data/map.ts";
import type { FishingAreaPayload, FishingAreaRow } from "../../../data/supabaseFishingAreaRepository.ts";
import { useWorldStore } from "../../../stores/world.ts";
import { useAdminFishingAreaStore } from "./admin-fishing-area-store.ts";

const worldStore = useWorldStore();
const fishingAreaStore = useAdminFishingAreaStore();
const adminFishingAreaStore = useAdminFishingAreaStore();
const isSaving = ref(false);
const formError = ref("");


function buildPayload(): FishingAreaPayload | null {
  if(!adminFishingAreaStore.target) return null;

  if (!adminFishingAreaStore.target.countryId) {
    formError.value = "Vui lòng chọn quốc gia";
    return null;
  }

  let location: any = null;
  try {
    // location = JSON.parse(adminFishingAreaStore.target.location);
    location = adminFishingAreaStore.target.location;
  } catch {
    formError.value = "Location không đúng định dạng JSON";
    return null;
  }

  let fishingBoundary: any[];
  try {
    fishingBoundary = JSON.parse((adminFishingAreaStore.target.fishingBoundary as string).trim() || "[]");
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

  return {
    countryId: adminFishingAreaStore.target.countryId,
    isAvailable: adminFishingAreaStore.target.isAvailable,
    x: Number(adminFishingAreaStore.target.x),
    y: Number(adminFishingAreaStore.target.y),
    title: adminFishingAreaStore.target.title?.trim() || null,
    location,
    scenePath: adminFishingAreaStore.target.scenePath?.trim() || null,
    fishingBoundary,
  };
}

async function handleSave() {
  if(!adminFishingAreaStore.target) return;
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

// Đồng bộ từ bản đồ vào form tạo
watch(
  [
    () => worldStore.selectedCoordinate, 
    () => worldStore.zoom, 
    () => worldStore.pan,
    () => worldStore.selectedCountry
  ],
  ([newSelectedLocation, newZoom, newPan, newCountry]) => {
    if(!adminFishingAreaStore.target) return;

    if(adminFishingAreaStore.isFormLock === false){
      if(worldStore.isAnchorMode && newSelectedLocation && newCountry){
        const X = Math.round(newSelectedLocation.x);
        const Y = Math.round(newSelectedLocation.y);
        adminFishingAreaStore.target.x = X;
        adminFishingAreaStore.target.y = Y;
        adminFishingAreaStore.target.countryId = newCountry.id;
        adminFishingAreaStore.target.title = `${newCountry.title} - ${X}:${Y}`;
        adminFishingAreaStore.target.scenePath = `/area/${newCountry.id}/${X}.${Y}`
      }
      if(worldStore.didDrag || worldStore.isZooming){
        adminFishingAreaStore.target.location = {
          zoom: newZoom,
          pan: newPan
        };
      }
    }
  }, {deep: true}
);

// Đồng bộ từ form cập nhật ra bản đồ
watch([
  ()=>adminFishingAreaStore.target,
], 
([area])=>{
  if(area != null && adminFishingAreaStore.isUpdate){
   worldStore.setWorldSelectedCoordinate({x: area.x, y: area.y});
   worldStore.handleMoveToArea(area);
  }
}, {deep:true, immediate: true})

watch(()=>adminFishingAreaStore.isFormLock, (isFormLock)=>{
  if(isFormLock){
    worldStore.disabledInteraction();
  }else{
    worldStore.enableInteraction();
  }
}, {immediate: true})


</script>

<template>
<div v-if="adminFishingAreaStore.isFormOpen && adminFishingAreaStore.target" class="w-full sm:w-105 shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
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
      <button v-if="adminFishingAreaStore.isFormLock" @click="adminFishingAreaStore.isFormLock = false" type="button">🔒 Đang khóa</button>
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

    <div class="grid grid-cols-2 gap-3">
      <div class="flex flex-col gap-1.5">
        <label class="text-[11px] font-bold text-gray-500 uppercase">Toạ độ X</label>
        <input
          v-model.number="adminFishingAreaStore.target.x"
          type="number"
          step="any"
          class="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
          :disabled="adminFishingAreaStore.isFormLock"
        />
      </div>
      <div class="flex flex-col gap-1.5">
        <label class="text-[11px] font-bold text-gray-500 uppercase">Toạ độ Y</label>
        <input
          v-model.number="adminFishingAreaStore.target.y"
          type="number"
          step="any"
          class="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
          :disabled="adminFishingAreaStore.isFormLock"
        />
      </div>
    </div>

    <label class="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer select-none">
      <input v-model="adminFishingAreaStore.target.isAvailable" type="checkbox" class="w-4 h-4 accent-emerald-700" :disabled="adminFishingAreaStore.isFormLock"/>
      Kích hoạt (hiển thị trên bản đồ)
    </label>

    <div class="flex flex-col gap-1.5">
      <label class="text-[11px] font-bold text-gray-500 uppercase">Đường dẫn cảnh (scene_path)</label>
      <input
        v-model="adminFishingAreaStore.target.scenePath"
        type="text"
        placeholder="area/VN/770.400"
        class="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
        :disabled="adminFishingAreaStore.isFormLock"
      />
    </div>

    <div class="flex flex-col gap-1.5">
      <label class="text-[11px] font-bold text-gray-500 uppercase">Location (JSON, không bắt buộc)</label>
      <textarea
        :value="JSON.stringify(adminFishingAreaStore.target.location ?? [], null, 2)"
        rows="7"
        placeholder='{"x": 0, "y": 0, "zoom": 1}'
        class="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-mono focus:outline-none focus:border-emerald-500 resize-none"
        disabled
      ></textarea>
    </div>

    <div class="flex flex-col gap-1.5">
      <label class="text-[11px] font-bold text-gray-500 uppercase">Vùng câu (fishing_boundary, JSON)</label>
      <textarea
        v-model="adminFishingAreaStore.target.fishingBoundary"
        rows="7"
        placeholder='[{"x": 0, "y": 0}, {"x": 10, "y": 0}]'
        class="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-mono focus:outline-none focus:border-emerald-500 resize-none"
        disabled
      ></textarea>
      <p class="text-[11px] text-gray-400">
        Dán mảng các object dạng {{ '{ "x": number, "y": number }' }} tạo thành vòng cung giới hạn phạm vi quăng
        mồi.
      </p>
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
</template>