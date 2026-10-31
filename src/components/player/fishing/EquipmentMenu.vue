<script setup lang="ts">
import { useFishingStore } from "../../../stores/fishing.ts";
import { ref, watch } from "vue";
import EquipmentPickerModal from "./EquipmentPickerModal.vue";
import AdjusDepth from "./AdjusDepth.vue";

const store = useFishingStore();
const pickerOpen = ref(false);

function openPicker() {
  if (!store.canAdjustDepth) return;
  pickerOpen.value = true;
}

function openDepthAdjuster() {
  if (!store.canAdjustDepth || store.isLoadingCurrentArea || !store.currentAreaId) return;
  if (!store.canAdjustLakeDepth) {
    void store.fetchCurrentArea(store.currentAreaId);
    return;
  }
  store.openDepthAdjuster();
}

watch(
  () => store.canAdjustDepth,
  (canAdjust) => {
    if (!canAdjust) pickerOpen.value = false;
  },
);
</script>

<template>
  <div class="flex flex-wrap gap-2" aria-label="Dụng cụ câu cá">
    <button
      type="button"
      class="flex items-center gap-2 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] px-3 py-2 text-[11px] font-bold text-[#24352a] transition hover:border-[#70a77e] hover:bg-[#eaf5e8]"
      :disabled="!store.canAdjustDepth"
      @click="openPicker"
    >
      <span aria-hidden="true" class="text-base">🎣</span>
      Chọn trang bị
    </button>
    <EquipmentPickerModal :open="pickerOpen && store.canAdjustDepth" @close="pickerOpen = false" />
    <button
      type="button"
      class="flex items-center gap-2 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] px-3 py-2 text-[11px] font-bold text-[#24352a] transition hover:border-[#70a77e] hover:bg-[#eaf5e8]"
      :disabled="!store.canAdjustDepth || !store.currentAreaId || store.isLoadingCurrentArea"
      :title="store.currentAreaLoadError || undefined"
      @click="openDepthAdjuster"
    >
      <span aria-hidden="true" class="text-base text-[#398d80]">≋</span>
      {{
        store.isLoadingCurrentArea
          ? "Đang tải thông tin hồ..."
          : store.currentAreaLoadError
            ? "Tải lại độ sâu hồ"
            : "Điều chỉnh độ sâu"
      }}
    </button>
    <AdjusDepth />
    <button
      type="button"
      class="flex items-center gap-2 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] px-3 py-2 text-[11px] font-bold text-[#24352a] transition hover:border-[#70a77e] hover:bg-[#eaf5e8]"
      @click="store.openBag"
    >
      <span aria-hidden="true" class="text-base">🐟</span>
      Túi cá
      <b
        class="grid min-w-[17px] h-[17px] place-items-center rounded-full bg-[#eebd55] px-1 text-[10px] text-[#244635]"
      >
        {{ store.inventory.length }}
      </b>
    </button>
    <button
      type="button"
      class="flex items-center gap-2 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] px-3 py-2 text-[11px] font-bold text-[#24352a] transition hover:border-[#70a77e] hover:bg-[#eaf5e8]"
      @click="store.openLakeGuide"
    >
      <span aria-hidden="true" class="text-base">🐠</span>
      Cá trong hồ
    </button>
    <button
      type="button"
      class="flex items-center gap-2 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] px-3 py-2 text-[11px] font-bold text-[#24352a] transition hover:border-[#70a77e] hover:bg-[#eaf5e8]"
      @click="store.openPlayers"
    >
      <span aria-hidden="true" class="text-base">👥</span>
      Người câu
      <b
        class="grid min-w-[17px] h-[17px] place-items-center rounded-full bg-[#78c6b1] px-1 text-[10px] text-[#173c31]"
      >
        {{ store.nearbyPlayers.length }}
      </b>
    </button>
  </div>
</template>
