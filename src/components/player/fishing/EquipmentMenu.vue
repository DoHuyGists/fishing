<script setup lang="ts">
import { computed } from "vue";
import { useEquipmentStore } from "../../../stores/equipment.ts";
import { useFishingStore } from "../../../stores/fishing.ts";
import { ref, watch } from "vue";
import EquipmentPickerModal from "./EquipmentPickerModal.vue";
import AdjusDepth from "./AdjusDepth.vue";

const store = useFishingStore();
const equipmentStore = useEquipmentStore();
const pickerOpen = ref(false);
const selectedBait = computed(() =>
  equipmentStore.variants.bait?.find((bait) => bait.id === store.equipmentLoadout.bait),
);

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
  <div class="flex items-start justify-between gap-2">
    <div class="equipment-actions flex flex-wrap items-start gap-2" aria-label="Dụng cụ câu cá">
      <button type="button" class="flex items-center gap-2 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] px-3 py-2 text-[11px] font-bold text-[#24352a] transition hover:border-[#70a77e] hover:bg-[#eaf5e8]" :disabled="!store.canAdjustDepth" @click="openPicker">
        <span aria-hidden="true" class="text-base">🎣</span>
        Chọn trang bị
      </button>
      <EquipmentPickerModal :open="pickerOpen && store.canAdjustDepth" @close="pickerOpen = false" />
      <button type="button" class="relative flex items-center gap-2 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] px-3 py-2 text-[11px] font-bold text-[#24352a] transition hover:border-[#70a77e] hover:bg-[#eaf5e8]" :disabled="!store.canAdjustDepth || !store.currentAreaId || store.isLoadingCurrentArea"
        :title="store.currentAreaLoadError || undefined" @click="openDepthAdjuster">
        <span class="absolute -top-2 right-2 rounded-full border border-[#cbd9c6] bg-white px-1.5 py-0.5 text-[9px] font-bold leading-none text-[#24352a] shadow-sm" aria-label="Độ sâu đã chọn">
          {{ store.appliedDepthMeters }} m
        </span>
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
      <button type="button" class="relative flex items-center gap-2 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] px-3 py-2 text-[11px] font-bold text-[#24352a] transition hover:border-[#70a77e] hover:bg-[#eaf5e8]" @click="store.openBag">
        <span aria-hidden="true" class="text-base">🕸️</span>
        Túi cá
        <b class="absolute -top-2 right-2 grid h-[17px] min-w-[17px] place-items-center rounded-full border border-[#cbd9c6] bg-white px-1 text-[9px] font-bold leading-none text-[#24352a] shadow-sm" aria-label="Số cá trong túi">
          {{ store.inventory.length }}
        </b>
      </button>
      <button type="button" class="relative flex items-center gap-2 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] px-3 py-2 text-[11px] font-bold text-[#24352a] transition hover:border-[#70a77e] hover:bg-[#eaf5e8]" @click="store.openLakeGuide">
        <span aria-hidden="true" class="text-base">🐠</span>
        Cá trong hồ
        <b class="absolute -top-2 right-2 grid h-[17px] min-w-[17px] place-items-center rounded-full border border-[#cbd9c6] bg-white px-1 text-[9px] font-bold leading-none text-[#24352a] shadow-sm" aria-label="Số loài cá trong hồ">
          {{ store.areaSpeciesDiary?.fishes.length ?? 0 }}
        </b>
      </button>
      <button type="button" class="relative flex items-center gap-2 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] px-3 py-2 text-[11px] font-bold text-[#24352a] transition hover:border-[#70a77e] hover:bg-[#eaf5e8]" @click="store.openPlayers">
        <span aria-hidden="true" class="text-base">👥</span>
        Người câu
        <b class="absolute -top-2 right-2 grid h-[17px] min-w-[17px] place-items-center rounded-full border border-[#cbd9c6] bg-white px-1 text-[9px] font-bold leading-none text-[#24352a] shadow-sm" aria-label="Số người câu gần đây">
          {{ store.nearbyPlayers.length }}
        </b>
      </button>
    </div>
    <div class="flex shrink-0 items-center gap-2 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-2 py-1 text-[11px] leading-3 text-[#24352a]" aria-label="Mồi đang chọn">
      <img :src="selectedBait?.image ?? ''" class="size-6 object-contain" alt="">
      <div class="flex flex-col gap-0.5">
        <span class="font-bold">{{ selectedBait?.name ?? "Chưa chọn mồi" }}</span>
        <span class="text-[#4b5f50]">Còn: {{ selectedBait?.quantity ?? 0 }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.equipment-actions > button {
  min-height: 28px;
  padding-block: 3px;
  border-radius: 8px;
}
</style>
