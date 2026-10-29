<script setup lang="ts">
import { computed } from "vue";
import { useFishingStore } from "../../stores/fishing";
const store = useFishingStore();
const discoveredFishes = computed(() => store.areaSpeciesDiary?.fishes.filter((fish) => fish.is_discovered) ?? []);
const undiscoveredFishes = computed(() => store.areaSpeciesDiary?.fishes.filter((fish) => !fish.is_discovered) ?? []);
</script>
<template>
  <Teleport to="body">
    <Transition name="guide-dialog">
      <div v-if="store.lakeGuideOpen"
        class="fixed z-[31] inset-0 grid place-items-center p-5 bg-[rgba(4,17,11,0.72)] backdrop-blur-[7px]"
        @click.self="store.closeLakeGuide">
        <section
          class="w-[min(500px,100%)] overflow-hidden border border-[rgba(255,226,149,0.68)] rounded-[20px] bg-[linear-gradient(145deg,#173d2b,#0e281b)] shadow-[0_24px_70px_rgba(0,0,0,0.48)] text-[#f4f0df]"
          role="dialog" aria-modal="true">
          <header class="flex justify-between px-5 pt-[19px] pb-3 border-b border-[rgba(223,241,207,0.14)]">
            <div>
              <h2 class="m-0 text-xl">Cá trong hồ</h2>
            </div>
            <button type="button"
              class="w-[29px] h-[29px] border-0 rounded-full bg-[rgba(235,243,219,0.13)] text-white cursor-pointer text-[22px] leading-none"
              @click="store.closeLakeGuide">
              ×
            </button>
          </header>
          <div class="px-5 py-4">
            <div v-if="store.isLoadingAreaSpeciesDiary" class="py-8 text-center text-sm text-[#b7cfb9]" role="status">
              Đang tải danh sách cá...
            </div>
            <div v-else-if="store.areaSpeciesDiaryError" class="py-6 text-center text-sm text-[#f3b8a8]" role="alert">
              <p class="mb-3">Không thể tải sổ tay cá trong hồ.</p>
              <button type="button" class="rounded-lg border border-white/20 px-3 py-2 text-xs text-white" @click="store.fetchAreaSpeciesDiary">
                Thử lại
              </button>
            </div>
            <template v-else-if="store.areaSpeciesDiary">
              <div class="mb-4 grid grid-cols-3 gap-2 text-center">
                <div class="rounded-xl bg-white/[0.07] p-2">
                  <strong class="block text-lg">{{ store.areaSpeciesDiary.total_species }}</strong>
                  <span class="text-[10px] text-[#b7cfb9]">Tổng loài</span>
                </div>
                <div class="rounded-xl bg-white/[0.07] p-2">
                  <strong class="block text-lg text-[#c7e6a5]">{{ store.areaSpeciesDiary.discovered_species }}</strong>
                  <span class="text-[10px] text-[#b7cfb9]">Đã khám phá</span>
                </div>
                <div class="rounded-xl bg-white/[0.07] p-2">
                  <strong class="block text-lg text-[#e8bd62]">{{ store.areaSpeciesDiary.undiscovered_species }}</strong>
                  <span class="text-[10px] text-[#b7cfb9]">Chưa khám phá</span>
                </div>
              </div>

              <div class="max-h-[min(55vh,420px)] space-y-4 overflow-y-auto pr-1">
                <section v-if="discoveredFishes.length">
                  <div class="mb-2 text-xs font-bold uppercase tracking-wide text-[#c7e6a5]">Đã khám phá</div>
                  <ul class="m-0 space-y-2 p-0">
                    <li v-for="fish in discoveredFishes" :key="fish.species_id" class="flex gap-3 rounded-xl border border-white/10 bg-white/[0.05] p-2.5">
                      <img :src="fish.image || '/fish/VN/fish.jpg'" :alt="fish.display_name" class="h-14 shrink-0 rounded-lg bg-black/20 object-cover" draggable="false"/>
                      <div class="min-w-0 flex-1">
                        <p class="m-0 font-semibold">{{ fish.display_name || fish.name }}</p>
                        <p class="m-0 text-[10px] text-[#e8bd62]">{{ fish.rarity || 'Chưa rõ độ hiếm' }}</p>
                        <p v-if="fish.information" class="mb-0 mt-1 text-xs leading-relaxed text-[#b7cfb9]">{{ fish.information }}</p>
                        <p v-if="fish.weight_min != null || fish.weight_max != null" class="mb-0 mt-1 text-[10px] text-[#b7cfb9]">
                          Cân nặng: {{ fish.weight_min ?? '?' }}–{{ fish.weight_max ?? '?' }} kg
                        </p>
                      </div>
                    </li>
                  </ul>
                </section>

                <section v-if="undiscoveredFishes.length">
                  <h3 class="mb-2 text-xs font-bold uppercase tracking-wide text-[#e8bd62]">Chưa khám phá</h3>
                  <ul class="m-0 grid grid-cols-2 gap-2 p-0">
                    <li v-for="fish in undiscoveredFishes" :key="fish.species_id" class="flex min-h-16 items-center gap-2 rounded-xl border border-dashed border-white/15 bg-black/10 p-2.5">
                      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.08] text-lg text-[#b7cfb9]" aria-hidden="true">?</span>
                      <span class="text-xs font-semibold text-[#d3dfd0]">{{ fish.display_name || 'Chưa khám phá' }}</span>
                    </li>
                  </ul>
                </section>
                <p v-if="!store.areaSpeciesDiary.fishes.length" class="m-0 py-6 text-center text-sm text-[#b7cfb9]">
                  Chưa có dữ liệu loài cá ở khu vực này.
                </p>
              </div>
            </template>
            <p v-else class="m-0 py-8 text-center text-sm text-[#b7cfb9]">
              Chưa có khu vực câu cá được chọn.
            </p>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
<style scoped>
.guide-dialog-enter-active,
.guide-dialog-leave-active {
  transition: opacity 0.18s ease;
}

.guide-dialog-enter-from,
.guide-dialog-leave-to {
  opacity: 0;
}
</style>
