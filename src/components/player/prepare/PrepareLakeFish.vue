<script setup lang="ts">
import { t as tr } from "../../../i18n/index.ts";
import { useAuthStore } from "../../../stores/auth.ts";
import { useDiaryStore } from "../../../stores/diary.ts";
import { useWorldStore } from "../../../stores/worldMap.ts";

const authStore = useAuthStore();
const diaryStore = useDiaryStore();
const worldStore = useWorldStore();
</script>

<template>
  <section
    :aria-label="tr('EquipmentMenu.ca_trong_ho')"
    class="slide-fade-in from-top player-content-in shrink-0 overflow-hidden rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] shadow-sm"
  >
    <header class="flex flex-wrap items-center justify-between gap-2 border-b border-[#cbd9c6] bg-[#eaf2e5] p-3">
      <div>
        <div class="m-0 text-[15px] font-bold text-[#24352a]">{{ tr("EquipmentMenu.ca_trong_ho") }}</div>
        <div class="m-0 mt-0.5 text-xs text-[#617565]">
          {{ tr("PrepareModal.cac_loai_ban_da_cau_thanh_cong") }}
        </div>
      </div>
      <span
        v-if="!diaryStore.isLoadingAreaSpecies && !diaryStore.areaSpeciesError"
        class="text-xs font-semibold text-[#526a58]"
      >
        {{ diaryStore.discoveredAreaSpecies.length }} {{ tr("PrepareModal.loai_da_kham_pha") }}
      </span>
    </header>
    <div v-if="diaryStore.isLoadingAreaSpecies" class="m-0 p-4 text-center text-sm text-[#617565]" role="status">
      {{ tr("PrepareModal.dang_tai_danh_sach_ca") }}
    </div>
    <div v-else-if="diaryStore.areaSpeciesError" class="p-4 text-center" role="alert">
      <div class="m-0 text-sm text-red-600">{{ tr("PrepareModal.khong_the_tai_danh_sach_ca_trong_ho") }}</div>
      <button
        type="button"
        class="mt-2 rounded-lg border border-[#cbd9c6] bg-[#eaf2e5] px-3 py-1.5 text-xs font-semibold text-[#24352a] hover:bg-white"
        @click="diaryStore.loadDiscoveredAreaSpecies(worldStore.selectedArea.id, authStore.userId)"
      >
        {{ tr("Maintenance.thu_lai") }}
      </button>
    </div>
    <div
      v-else-if="diaryStore.discoveredAreaSpecies.length"
      class="m-0 grid list-none grid-cols-1 gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3"
    >
      <div
        v-for="fish in diaryStore.discoveredAreaSpecies"
        :key="fish.id"
        class="flex items-start gap-3 rounded-lg border border-[#cbd9c6] bg-white/70 p-2.5"
      >
        <img
          :src="fish.image || '/fish/VN/fish.jpg'"
          :alt="fish.name"
          class="h-14 w-16 shrink-0 rounded-md bg-[#eaf2e5] object-contain"
          loading="lazy"
          draggable="false"
        />
        <div class="min-w-0 flex-1">
          <div class="m-0 break-words text-sm font-semibold text-[#24352a]">{{ fish.name }}</div>
          <div v-if="fish.rarity" class="m-0 mt-0.5 text-xs text-[#526a58]">{{ fish.rarity }}</div>
          <div v-if="fish.information" class="m-0 mt-1 text-xs leading-relaxed text-[#617565]">
            {{ fish.information }}
          </div>
          <div v-if="fish.weight_min != null || fish.weight_max != null" class="m-0 mt-1 text-xs text-[#617565]">
            {{ tr("LakeFishGuide.can_nang") }} {{ fish.weight_min ?? "?" }}–{{ fish.weight_max ?? "?" }} kg
          </div>
        </div>
      </div>
    </div>
    <div v-else class="m-0 p-4 text-center text-sm text-[#617565]">
      {{ tr("PrepareModal.ban_chua_kham_pha_duoc_loai_ca_nao_trong_ho_nay") }}
    </div>
  </section>
</template>
