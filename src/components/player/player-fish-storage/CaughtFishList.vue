<script setup lang="ts">
import { t as tr } from "../../../i18n";
import type { CaughtFish, CaughtViewMode } from "../../../types/model/caughtFish";
import { useWorldStore } from "../../../stores/player-world-map-store";
import { formatDateTime } from "../../../utils/time";
import CaughtFishTraits from "./CaughtFishTraits.vue";
import ShinySparkles from "../../shared/ShinySparkles.vue";

defineProps<{
  viewMode: CaughtViewMode;
  fishes: CaughtFish[];
  groups: { id: string; fishes: CaughtFish[] }[];
  total: number;
  loading: boolean;
  hasActiveFilters: boolean;
}>();
const expandedSpecies = defineModel<string | null>("expandedSpecies", { required: true });
defineEmits<{ sell: [fish: CaughtFish]; release: [fish: CaughtFish] }>();
const worldStore = useWorldStore();

function getRarityBadgeClass(rarity: string | null | undefined) {
  switch (rarity) {
    case "Sách đỏ":
      return "bg-surface text-gold border-gold";
    case "Quý hiếm":
      return "bg-surface text-special border-special";
    case "Khó tìm":
      return "bg-surface text-primary border-primary";
    default:
      return "bg-surface text-content border-content";
  }
}

</script>

<template>
  <div
    class="h-full min-h-0 overflow-y-auto pr-1 gap-3 content-start"
    :class="viewMode !== 'list' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5' : 'flex flex-col'"
  >
    <div v-if="loading" class="col-span-full text-center text-xs text-content">
      {{ tr("CaughtModal.dang_tai_danh_sach_ca") }}
    </div>
    <div v-else-if="!total" class="col-span-full py-12 text-center text-xs text-content">
      {{
        hasActiveFilters
          ? tr("CaughtModal.khong_tim_thay_ca_phu_hop")
          : tr("CaughtModal.chua_co_con_ca_nao_trong_bo_suu_tap")
      }}
    </div>
    <template v-else-if="viewMode === 'species'">
      <article
        v-for="group in groups"
        :key="group.id"
        class="slide-fade-in from-bottom player-content-in min-w-0 overflow-hidden h-fit border border-border hover:border-accent rounded-xl bg-white/70 transition-all shadow-sm"
      >
        <div class="relative">
          <img
            :src="group.fishes[0].species?.image || '/fish/VN/fish.jpg'"
            :alt="group.fishes[0].species?.name || tr('CaughtModal.ca')"
            class="object-cover bg-surface w-full border-b border-border"
          />
          <ShinySparkles v-if="group.fishes.some((fish) => fish.is_shiny)" />
        </div>
        <div class="min-w-0 flex-1 p-2">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="m-0 truncate font-bold text-xs text-content">
                {{ group.fishes[0].species?.name || tr("CaughtModal.ca_chua_ro_ten") }}
              </div>
              <span
                v-if="group.fishes[0].species?.rarity"
                class="inline-block mt-1 px-1.5 py-1 text-[9px] font-extrabold rounded border uppercase"
                :class="getRarityBadgeClass(group.fishes[0].species?.rarity)"
              >
                {{ group.fishes[0].species?.rarity }}
              </span>
            </div>
            <span class="shrink-0 px-2 py-1 rounded-full bg-content-strong text-white text-[10px] font-extrabold">
              {{ group.fishes.length }} {{ tr("UserProfile.con") }}
            </span>
          </div>
          <button
            type="button"
            class="mt-2 w-full px-2 py-1.5 rounded-lg border border-accent bg-surface hover:bg-surface text-content font-bold text-xs transition-colors cursor-pointer"
            :aria-expanded="expandedSpecies === group.id"
            @click="expandedSpecies = expandedSpecies === group.id ? null : group.id"
          >
            {{ expandedSpecies === group.id ? tr("CaughtModal.an_chi_tiet") : tr("CaughtModal.xem_tung_con") }}
          </button>
          <div
            v-if="expandedSpecies === group.id"
            class="mt-2 space-y-2 border-t border-border pt-2 overflow-y-scroll h-60"
          >
            <div
              v-for="fish in group.fishes"
              :key="fish.id"
              class="relative rounded-lg bg-white p-2 text-[10px] text-content"
            >
              <ShinySparkles v-if="fish.is_shiny" />
              <div class="flex items-center justify-between gap-2">
                <span class="font-semibold text-content">{{ fish.weight }} kg</span>
                <span class="shrink-0">{{ formatDateTime(fish.created_at) }}</span>
              </div>
              <CaughtFishTraits :fish="fish" class="mt-1" />
              <button
                v-if="fish.origin"
                type="button"
                class="mt-1 cursor-pointer text-left hover:underline"
                @click="worldStore.handleMoveToArea(fish.origin)"
              >
                {{ fish.origin.country }} - {{ fish.origin.name }}
              </button>
              <span v-else class="mt-1 block text-content">{{ tr("CaughtModal.nguon_nuoi_tai_ao") }}</span>
              <div class="mt-2 flex gap-2">
                <button
                  type="button"
                  class="px-2 py-1 border border-accent rounded-lg bg-surface hover:bg-surface text-content font-bold transition-colors cursor-pointer"
                  :title="tr('CaughtModal.dang_ban')"
                  @click="$emit('sell', fish)"
                >
                  {{ tr("Fishfarm.ban") }}
                </button>
                <button
                  type="button"
                  class="px-2 py-1 border border-danger rounded-lg bg-surface hover:bg-surface text-danger font-bold transition-colors cursor-pointer"
                  :title="tr('CaughtModal.tha_ca_ve_lai_tu_nhien')"
                  @click="$emit('release', fish)"
                >
                  {{ tr("Fishfarm.tha") }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </article>
    </template>
    <div
      v-else
      v-for="item in fishes"
      :key="item.id"
      class="slide-fade-in from-bottom player-content-in relative min-w-0 p-2 border border-border hover:border-accent rounded-xl bg-white/70 hover:bg-surface/30 transition-all shadow-sm"
      :class="viewMode === 'grid' ? 'flex flex-col gap-2' : 'flex items-center gap-3'"
    >
      <ShinySparkles v-if="item.is_shiny" />
      <img
        :src="item.species?.image || '/fish/VN/fish.jpg'"
        :alt="item.species?.name"
        class="rounded-lg border border-border bg-surface"
        :class="viewMode === 'grid' ? 'w-full' : 'h-16 w-16 shrink-0 object-contain sm:h-20 sm:w-20'"
      />
      <div
        class="flex flex-1 min-w-0 gap-2"
        :class="viewMode === 'grid' ? 'flex-col' : 'flex-wrap items-center justify-between'"
      >
        <div class="flex-1 min-w-0 flex flex-col gap-0.5">
          <div class="flex items-center justify-between gap-1">
            <span class="font-bold text-xs truncate text-content">{{ item.species?.name }}</span>
          </div>
          <div class="flex items-center gap-2 text-[11px] text-content">
            <span>{{ item.weight }} kg</span>
          </div>
          <div class="flex items-center justify-between text-[10px] text-content">
            <span class="shrink-0 ml-1">{{ formatDateTime(item.created_at!) }}</span>
          </div>
          <div>
            <span
              class="px-1.5 py-1 text-[9px] font-extrabold rounded border shrink-0 uppercase"
              :class="getRarityBadgeClass(item.species?.rarity)"
            >
              {{ item.species?.rarity }}
            </span>
            <CaughtFishTraits :fish="item" class="mt-1" />
            <div
              v-if="item.origin"
              @click="worldStore.handleMoveToArea(item.origin)"
              class="text-xs mt-1 cursor-pointer hover:underline"
            >
              {{ item.origin.country }} - {{ item.origin.name }}
            </div>
            <div v-else class="mt-1 text-xs text-content">{{ tr("CaughtModal.nguon_nuoi_tai_ao") }}</div>
          </div>
        </div>
        <div class="flex gap-2 shrink-0">
          <button
            type="button"
            class="px-2 py-1.5 border border-accent rounded-lg bg-surface hover:bg-surface text-content font-bold text-xs transition-colors cursor-pointer"
            :title="tr('CaughtModal.dang_ban')"
            @click="$emit('sell', item)"
          >
            {{ tr("Fishfarm.ban") }}
          </button>
          <button
            type="button"
            class="px-2 py-1.5 border border-danger rounded-lg bg-surface hover:bg-surface text-danger font-bold text-xs transition-colors cursor-pointer"
            :title="tr('CaughtModal.tha_ca_ve_lai_tu_nhien')"
            @click="$emit('release', item)"
          >
            {{ tr("Fishfarm.tha") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
