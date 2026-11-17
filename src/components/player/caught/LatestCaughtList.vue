<script lang="ts" setup>
import { computed } from "vue";
import { getFormattingLocale, t as tr } from "../../../i18n";
import { useCaughtStore } from "../../../stores/caught.ts";
import Tab from "../../shared/Tab.vue";

const caughtStore = useCaughtStore();

const recentCaughtFishes = computed(() => caughtStore.inNetFishes);
const viewModes = computed(() => [
  { key: "list", label: tr('CaughtModal.danh_sach') },
  { key: "grid", label: tr('CaughtModal.luoi') },
  { key: "group", label: tr('CaughtModal.theo_loai') },
]);

</script>
<template>
  <section class="w-full max-w-sm rounded-xl border border-[#cbd9c6] bg-white/95 p-3 text-[#24352a] shadow-sm">
    <div class="mb-2 flex items-center justify-between">
      <div class="m-0 text-sm font-bold text-[#153221]">{{ tr('CaughtModal.luoi') }}</div>
      <span class="text-[11px] text-gray-500">{{ recentCaughtFishes.length }} {{ tr('UserProfile.con') }}</span>
    </div>
    <Tab v-model="caughtStore.latestCaughtViewMode" :tabs="viewModes" :aria-label="tr('CaughtModal.che_do_hien_thi')" wrap lazy>
      <template v-for="mode in viewModes" :key="mode.key" #[mode.key]>
        <div
          v-if="caughtStore.isLoadingCaught && !recentCaughtFishes.length"
          class="m-0 py-3 text-center text-xs text-gray-500"
        >
          {{ tr('LatestCaughtList.dang_tai_danh_sach_loai_vua_cau') }}
        </div>
        <div v-else-if="!recentCaughtFishes.length" class="m-0 py-3 text-center text-xs text-gray-500">
          {{ tr('LatestCaughtList.chua_cau_duoc_con_nao') }}
        </div>
        <div v-else class="slide-fade-in from-bottom player-content-in m-0 grid max-h-[min(55vh,520px)] gap-2 overflow-y-auto p-0" :class="mode.key === 'grid' ? 'grid-cols-2' : 'grid-cols-1'">
          <template v-if="mode.key === 'group'">
            <div v-for="group in caughtStore.inNetFishGroups" :key="group.fish.species?.id || 'unknown'" class="flex min-w-0 items-center gap-2 rounded-lg bg-[#f5f9f0] p-2">
              <img :src="group.fish.species?.image || '/fish/VN/fish.jpg'" :alt="group.fish.species?.name || tr('CaughtModal.ca')" class="h-10 w-1/3 shrink-0 rounded-md object-cover" draggable="false" />
              <div class="min-w-0 flex-1">
                <div class="truncate text-xs font-bold" :title="group.fish.species?.name || tr('CaughtModal.ca_chua_ro_ten')">{{ group.fish.species?.name || tr('CaughtModal.ca_chua_ro_ten') }}</div>
                <div class="text-[10px] text-gray-500">{{ group.fish.species?.rarity || tr('LatestCaughtList.thuong') }}</div>
              </div>
              <span class="shrink-0 rounded-full border border-[#cbd9c6] px-2 py-0.5 text-[11px] font-bold">{{ group.count }} {{ tr('UserProfile.con') }}</span>
            </div>
          </template>
          <template v-else>
            <div
              v-for="fish in recentCaughtFishes"
              :key="fish.id"
              class="flex min-w-0 gap-2 rounded-lg bg-[#f5f9f0] p-2"
              :class="mode.key === 'grid' ? 'flex-col' : 'items-center'"
            >
              <img
                :src="fish.species?.image || '/fish/VN/fish.jpg'"
                :alt="fish.species?.name || tr('CaughtModal.ca')"
                class="shrink-0 rounded-md object-cover"
                :class="mode.key === 'grid' ? 'h-20 w-full' : 'h-10 w-1/3'"
                draggable="false"
              />
              <div class="min-w-0 flex-1">
                <div class="m-0 truncate text-xs font-bold text-gray-800">{{ fish.species?.name || tr('CaughtModal.ca_chua_ro_ten') }}</div>
                <div class="m-0 text-[10px] text-gray-500">
                  {{ fish.species?.rarity || tr('LatestCaughtList.thuong') }} ·
                  {{ fish.created_at ? new Date(fish.created_at).toLocaleDateString(getFormattingLocale()) : "" }}
                </div>
              </div>
            </div>
          </template>
        </div>
      </template>
    </Tab>
  </section>
</template>
