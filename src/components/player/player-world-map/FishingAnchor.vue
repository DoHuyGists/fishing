<script lang="ts" setup>
import { t as tr } from "../../../i18n";

import { onMounted } from "vue";
import { useCountryStore } from "../../../stores/player-country-store";
import { useFishingAreaStore } from "../../../stores/player-fishing-area-store";
import { useWorldStore } from "../../../stores/player-world-map-store";
import FishingModeBadge from "../../shared/FishingModeBadge.vue";

withDefaults(defineProps<{ collapsible?: boolean; mapVisible?: boolean }>(), {
  collapsible: false,
  mapVisible: true,
});
defineEmits<{ "toggle-map": [] }>();

const countryStore = useCountryStore();
const fishingAreaStore = useFishingAreaStore();
const worldStore = useWorldStore();

onMounted(() => {
  void fishingAreaStore.fetchArea();
  void countryStore.fetchCountries();
});
</script>
<template>
  <aside
    class="w-full flex-none h-full p-3 border border-border-default rounded-xl bg-surface text-content flex flex-col overflow-hidden"
    :class="{ 'md:w-60': mapVisible }"
  >
    <header class="flex shrink-0 items-center gap-2">
      <img src="/icons/check-point.svg" width="28" alt="" draggable="false" />
      <span class="min-w-0 flex-1 text-lg font-bold">{{ tr("FishingAnchor.ban_do") }}</span>
      <button
        v-if="collapsible"
        type="button"
        class="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border-default hover:bg-surface focus-visible:outline-2 focus-visible:outline-content"
        :aria-label="mapVisible ? tr('FishingAnchor.an_ban_do') : tr('FishingAnchor.hien_ban_do')"
        :title="mapVisible ? tr('FishingAnchor.an_ban_do') : tr('FishingAnchor.hien_ban_do')"
        :aria-expanded="mapVisible"
        @click="$emit('toggle-map')"
      >
        <span aria-hidden="true">{{ mapVisible ? "🙈" : "🗺️" }}</span>
      </button>
    </header>
    <div v-if="mapVisible" class="relative mt-2 shrink-0">
      <input
        v-model="fishingAreaStore.searchQuery"
        type="search"
        :aria-label="tr('FishingAnchor.tim_quoc_gia_hoac_bai_cau')"
        :placeholder="tr('FishingAnchor.tim_quoc_gia_bai_cau')"
        class="w-full rounded-lg border border-border-default bg-white px-3 py-2 text-xs text-content placeholder:text-content focus-visible:outline-2 focus-visible:outline-content"
      />
    </div>
    <div v-if="mapVisible" class="mt-3 flex min-h-0 flex-1 flex-col">
      <div id="fishing-anchor-heading" class="m-0 text-[13px] font-bold">
        {{ tr("FishingAnchor.danh_sach_bai_cau") }}
      </div>
      <div
        v-if="fishingAreaStore.filteredAreasByCountry.length"
        role="list"
        aria-labelledby="fishing-anchor-heading"
        class="mt-1 mb-0 min-h-0 overflow-y-auto grid content-start list-none gap-0.5 p-0"
      >
        <div v-for="group in fishingAreaStore.filteredAreasByCountry" :key="group.id" role="listitem" class="min-w-0">
          <details
            class="group"
            :open="
              Boolean(fishingAreaStore.normalizedSearchQuery) ||
              group.areas.some((area) => area.id === worldStore.selectedArea?.id)
            "
          >
            <summary
              @click="worldStore.handleMoveToCountry(group.id)"
              class="flex cursor-pointer list-none items-center gap-1.5 rounded-md px-1.5 py-1.5 text-xs font-bold hover:bg-primary focus-visible:outline-2 focus-visible:outline-content [&::-webkit-details-marker]:hidden"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                class="h-3 w-3 shrink-0 transition-transform group-open:rotate-90"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="m6 3 5 5-5 5" />
              </svg>
              <span class="min-w-0 flex-1 wrap-break-word">{{ group.name }}</span>
              <span class="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] text-content">
                {{ group.areas.length }}
              </span>
            </summary>
            <div v-if="group.areas.length" role="list" class="ml-2 grid list-none border-l border-border-default pl-1">
              <div v-for="area in group.areas" :key="area.id" role="listitem" class="min-w-0">
                <button
                  type="button"
                  :aria-current="worldStore.selectedArea?.id === area.id ? 'true' : undefined"
                  :class="worldStore.selectedArea?.id === area.id ? 'bg-primary font-bold' : 'hover:bg-white'"
                  :title="area.title || tr('FishingAnchor.bai_cau_chua_dat_ten')"
                  class="flex min-w-0 w-full cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs focus-visible:outline-2 focus-visible:outline-content"
                  @click="worldStore.handleMoveToArea(area)"
                >
                    <span class="min-w-0 flex-1 truncate">{{
                      area.title || tr("FishingAnchor.bai_cau_chua_dat_ten")
                    }}</span>
                    <FishingModeBadge :area="area" compacted />
                </button>
              </div>
            </div>
            <div
              v-else-if="fishingAreaStore.loaded && !fishingAreaStore.loading && !fishingAreaStore.error"
              class="ml-2 border-l border-border-default px-2.5 py-1.5 text-xs text-content-muted"
            >
              {{ tr("FishingAnchor.chua_co_dia_diem_cau") }}
            </div>
          </details>
        </div>
      </div>
      <div v-if="fishingAreaStore.loading" class="mt-2 mb-0 text-content text-xs" role="status">
        {{ tr("FishingAnchor.dang_tai_bai_cau") }}
      </div>
      <div v-else-if="fishingAreaStore.error" class="mt-2 mb-0 text-danger text-xs" role="alert">
        {{ fishingAreaStore.error }}
        <button type="button" class="cursor-pointer underline" @click="fishingAreaStore.fetchArea()">
          {{ tr("Maintenance.thu_lai") }}
        </button>
      </div>
      <div v-else-if="!fishingAreaStore.areasByCountry.length" class="mt-2 mb-0 text-content text-xs">
        {{ tr("FishingAnchor.chua_co_bai_cau") }}
      </div>
      <div
        v-else-if="!fishingAreaStore.filteredAreasByCountry.length"
        class="mt-2 text-xs text-content"
        role="status"
      >
        {{ tr("FishingAnchor.khong_tim_thay_quoc_gia_hoac_bai_cau_phu_hop") }}
      </div>
    </div>
  </aside>
</template>
