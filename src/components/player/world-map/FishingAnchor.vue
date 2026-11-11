<script lang="ts" setup>
import { onMounted } from "vue";
import { useCountryStore } from "../../../stores/country";
import { useFishingAreaStore } from "../../../stores/fishingArea";
import { useWorldStore } from "../../../stores/worldMap";

withDefaults(defineProps<{ collapsible?: boolean; mapVisible?: boolean }>(), {
  collapsible: false,
  mapVisible: true,
});
defineEmits<{ 'toggle-map': [] }>();

const countryStore = useCountryStore();
const fishingAreaStore = useFishingAreaStore();
const worldStore = useWorldStore();

onMounted(() => {
  if (!fishingAreaStore.loaded) void fishingAreaStore.fetchArea();
  void countryStore.fetchCountries();
});
</script>
<template>
  <aside
    class="w-full flex-none h-full p-4 border border-[#cbd9c6] rounded-xl bg-[#f5f9f0] text-[#24352a] flex flex-col overflow-hidden"
    :class="{ 'md:w-60': mapVisible }"
  >
    <header class="flex items-center gap-2">
      <img src="/icons/check-point.svg" width="35" alt="" draggable="false" />
      <span class="min-w-0 flex-1 text-lg font-bold">Bản đồ</span>
      <button
        v-if="collapsible"
        type="button"
        class="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#cbd9c6] hover:bg-[#e5eddf] focus-visible:outline-2 focus-visible:outline-[#24352a]"
        :aria-label="mapVisible ? 'Ẩn bản đồ' : 'Hiện bản đồ'"
        :title="mapVisible ? 'Ẩn bản đồ' : 'Hiện bản đồ'"
        :aria-expanded="mapVisible"
        @click="$emit('toggle-map')"
      >
        <span aria-hidden="true">{{ mapVisible ? '🙈' : '🗺️' }}</span>
      </button>
    </header>
    <div v-if="mapVisible" class="relative mt-3">
      <input
        v-model="fishingAreaStore.searchQuery"
        type="search"
        aria-label="Tìm quốc gia hoặc bãi câu"
        placeholder="Tìm quốc gia, bãi câu..."
        class="w-full rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-xs text-[#24352a] placeholder:text-[#607176] focus-visible:outline-2 focus-visible:outline-[#24352a]"
      />
    </div>
    <div v-if="mapVisible" class="mt-5 flex-1 overflow-y-auto">
      <div id="fishing-anchor-heading" class="m-0 text-[13px] font-bold">Danh sách bãi câu</div>
      <div
        v-if="fishingAreaStore.filteredAreasByCountry.length"
        role="list"
        aria-labelledby="fishing-anchor-heading"
        class="mt-3 mb-0 grid list-none gap-2 p-0"
      >
        <div v-for="group in fishingAreaStore.filteredAreasByCountry" :key="group.id" role="listitem" class="min-w-0">
          <details
            class="group"
            :open="Boolean(fishingAreaStore.normalizedSearchQuery) || group.areas.some((area) => area.id === worldStore.selectedArea?.id)"
          >
            <summary
              @click="worldStore.handleMoveToCountry(group.id)"
              class="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-2 text-xs font-bold hover:bg-[#e5eddf] focus-visible:outline-2 focus-visible:outline-[#24352a] [&::-webkit-details-marker]:hidden"
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
              <span class="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] text-[#607176]">
                {{ group.areas.length }}
              </span>
            </summary>
            <div role="list" class="mt-1 mb-0 ml-3 grid list-none gap-1 border-l border-[#cbd9c6] py-1 pr-0 pl-3">
              <div v-for="area in group.areas" :key="area.id" role="listitem" class="min-w-0">
                <button
                  type="button"
                  :aria-current="worldStore.selectedArea?.id === area.id ? 'true' : undefined"
                  :class="worldStore.selectedArea?.id === area.id ? 'bg-[#e5eddf] font-bold' : 'hover:bg-white'"
                  class="flex w-full cursor-pointer items-start gap-2 rounded-lg px-2 py-2 text-left text-xs focus-visible:outline-2 focus-visible:outline-[#24352a]"
                  @click="worldStore.handleMoveToArea(area)"
                >
                  <span aria-hidden="true" class="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#d84315]"></span>
                  <span class="min-w-0 wrap-break-word">{{ area.title || "Bãi câu chưa đặt tên" }}</span>
                </button>
              </div>
            </div>
          </details>
        </div>
      </div>
      <div v-if="fishingAreaStore.loading" class="mt-2 mb-0 text-[#607176] text-xs" role="status">
        Đang tải bãi câu...
      </div>
      <div v-else-if="fishingAreaStore.error" class="mt-2 mb-0 text-red-700 text-xs" role="alert">
        {{ fishingAreaStore.error }}
        <button type="button" class="cursor-pointer underline" @click="fishingAreaStore.fetchArea()">Thử lại</button>
      </div>
      <div v-else-if="!fishingAreaStore.fishingAreas.length" class="mt-2 mb-0 text-[#607176] text-xs">
        Chưa có bãi câu
      </div>
      <div v-else-if="!fishingAreaStore.filteredAreasByCountry.length" class="mt-2 text-xs text-[#607176]" role="status">
        Không tìm thấy quốc gia hoặc bãi câu phù hợp.
      </div>
    </div>
  </aside>
</template>
