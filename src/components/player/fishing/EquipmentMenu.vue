<script setup lang="ts">
import { t as tr } from "../../../i18n";

import { computed } from "vue";
import { useEquipmentStore } from "../../../stores/equipment.ts";
import { useFishingStore } from "../../../stores/fishing.ts";
import { ref, watch } from "vue";
import EquipmentPickerModal from "./EquipmentPickerModal.vue";
import AdjusDepth from "./AdjusDepth.vue";
import InventoryModal from "../inventory/InventoryModal.vue";
import { useModalStore } from "../../../stores/modal";

const store = useFishingStore();
const equipmentStore = useEquipmentStore();
const modalStore = useModalStore();
const pickerOpen = ref(false);
const selectedBait = computed(() =>
  equipmentStore.variants.bait?.find((bait) => bait.id === store.equipmentLoadout.bait),
);

function openPicker() {
  if (!store.canAdjustDepth) return;
  pickerOpen.value = true;
}

async function openDepthAdjuster() {
  if (!store.canAdjustDepth || store.isLoadingCurrentArea || !store.currentAreaId) return;
  if (!store.canAdjustLakeDepth) {
    await store.fetchCurrentArea(store.currentAreaId);
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
    <div class="equipment-actions flex flex-wrap items-start gap-2" :aria-label="tr('EquipmentMenu.dung_cu_cau_ca')">
      <button type="button" class="slide-fade-in from-top player-content-in flex items-center gap-2 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] min-h-7 px-3 py-[3px] text-[11px] font-bold text-[#24352a] transition hover:border-[#70a77e] hover:bg-[#eaf5e8]" :disabled="!store.canAdjustDepth" @click="openPicker">
        <span aria-hidden="true" class="text-base">🎣</span>
        {{ tr('EquipmentMenu.chon_trang_bi') }}
      </button>
      <EquipmentPickerModal :open="pickerOpen && store.canAdjustDepth" @close="pickerOpen = false" />
      <button type="button" class="slide-fade-in from-top player-content-in relative flex items-center gap-2 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] min-h-7 px-3 py-[3px] text-[11px] font-bold text-[#24352a] transition hover:border-[#70a77e] hover:bg-[#eaf5e8]" :disabled="!store.canAdjustDepth || !store.currentAreaId || store.isLoadingCurrentArea"
        :title="!store.canAdjustDepth ? tr('EquipmentMenu.khong_the_dieu_chinh_do_sau_luc_nay') : store.currentAreaLoadError || undefined"
        :aria-label="!store.canAdjustDepth ? tr('EquipmentMenu.dieu_chinh_do_sau_dang_bi_khoa') : undefined" @click="openDepthAdjuster">
        <span class="absolute -top-2 right-2 rounded-full border border-[#cbd9c6] bg-white px-1.5 py-0.5 text-[9px] font-bold leading-none text-[#24352a] shadow-sm" :aria-label="tr('EquipmentMenu.do_sau_da_chon')">
          {{ store.appliedDepthMeters }} m
        </span>
        <span aria-hidden="true" class="text-base text-[#398d80]">≋</span>
        {{
          store.isLoadingCurrentArea
            ? tr('EquipmentMenu.dang_tai_thong_tin_ho')
            : store.currentAreaLoadError
              ? tr('EquipmentMenu.tai_lai_do_sau_ho')
              : tr('AdjusDepth.dieu_chinh_do_sau')
        }}
        <span v-if="!store.canAdjustDepth" class="depth-lock-overlay bg-[repeating-linear-gradient(135deg,rgb(203_217_198_/_85%)_0_5px,rgb(245_249_240_/_75%)_5px_10px)] pointer-events-none absolute inset-0 flex items-center justify-center rounded-[inherit]" aria-hidden="true">
          <span class="flex size-6 items-center justify-center rounded-full border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] shadow-sm">
            <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="5" y="10" width="14" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              <path d="M12 14v3" />
            </svg>
          </span>
        </span>
      </button>
      <AdjusDepth />
      <button type="button" class="slide-fade-in from-top player-content-in flex items-center gap-2 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] min-h-7 px-3 py-[3px] text-[11px] font-bold text-[#24352a] transition hover:border-[#70a77e] hover:bg-[#eaf5e8]" @click="modalStore.open('body')">
        <span aria-hidden="true" class="text-base">🧍</span>
        {{ tr('EquipmentMenu.nhan_vat') }}
      </button>
      <button type="button" class="slide-fade-in from-top player-content-in relative flex items-center gap-2 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] min-h-7 px-3 py-[3px] text-[11px] font-bold text-[#24352a] transition hover:border-[#70a77e] hover:bg-[#eaf5e8]" @click="store.openBag">
        <span aria-hidden="true" class="text-base">🕸️</span>
        {{ tr('CaughtModal.tui_ca') }}
        <b class="absolute -top-2 right-2 grid h-[17px] min-w-[17px] place-items-center rounded-full border border-[#cbd9c6] bg-white px-1 text-[9px] font-bold leading-none text-[#24352a] shadow-sm" :aria-label="tr('EquipmentMenu.so_ca_trong_tui')">
          {{ store.inventory.length }}/{{ store.fishingNetCapacity }}
        </b>
      </button>
      <button type="button" class="slide-fade-in from-top player-content-in relative flex items-center gap-2 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] min-h-7 px-3 py-[3px] text-[11px] font-bold text-[#24352a] transition hover:border-[#70a77e] hover:bg-[#eaf5e8]" @click="store.openLakeGuide">
        <span aria-hidden="true" class="text-base">🐠</span>
        {{ tr('EquipmentMenu.ca_trong_ho') }}
        <b class="absolute -top-2 right-2 grid h-[17px] min-w-[17px] place-items-center rounded-full border border-[#cbd9c6] bg-white px-1 text-[9px] font-bold leading-none text-[#24352a] shadow-sm" :aria-label="tr('EquipmentMenu.so_loai_ca_trong_ho')">
          {{ store.areaSpeciesDiary?.fishes.length ?? 0 }}
        </b>
      </button>
      <button type="button" class="slide-fade-in from-top player-content-in relative flex items-center gap-2 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] min-h-7 px-3 py-[3px] text-[11px] font-bold text-[#24352a] transition hover:border-[#70a77e] hover:bg-[#eaf5e8]" @click="store.openPlayers">
        <span aria-hidden="true" class="text-base">👥</span>
        {{ tr('EquipmentMenu.nguoi_cau') }}
        <b class="absolute -top-2 right-2 grid h-[17px] min-w-[17px] place-items-center rounded-full border border-[#cbd9c6] bg-white px-1 text-[9px] font-bold leading-none text-[#24352a] shadow-sm" :aria-label="tr('EquipmentMenu.so_nguoi_cau_gan_day')">
          {{ store.nearbyPlayers.length }}
        </b>
      </button>
    </div>
    <div class="slide-fade-in from-top player-content-in flex shrink-0 items-center gap-2 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-2 py-1 text-[11px] leading-3 text-[#24352a]" :aria-label="tr('EquipmentMenu.moi_dang_chon')">
      <img :src="selectedBait?.image ?? ''" class="size-6 object-contain" alt="">
      <div class="flex flex-col gap-0.5">
        <span class="font-bold">{{ selectedBait?.name ?? tr('EquipmentMenu.chua_chon_moi') }}</span>
        <span class="text-[#4b5f50]">{{ tr('EquipmentMenu.con') }} {{ selectedBait?.quantity ?? 0 }}</span>
      </div>
    </div>
  </div>
  <Teleport to="body">
    <InventoryModal v-if="modalStore.isOpening('body')" initial-tab="health" compact />
  </Teleport>
</template>
