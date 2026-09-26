<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { DiaryFishEntry } from "../../stores/diary";

const props = defineProps<{
  country: {
    code: string;
    name: string;
    information: string;
  };
  entries: DiaryFishEntry[];
}>();

const emit = defineEmits(["back"]);

// Animation duration in ms
const FLIP_DURATION = 650;

// Current sheet index (0 = book open to cover page on left, page 1 on right)
const currentSheetIndex = ref(0);

// Animation state
const isFlipping = ref(false);
const animatingSheet = ref<number | null>(null);
const flipDirection = ref<"next" | "prev">("next");

// Track flipped state of each sheet
const sheetFlippedState = ref<boolean[]>([]);

// Number of species displayed per page (2 columns x 3 rows)
const ITEMS_PER_PAGE = 18;

// Calculate total sheets: each sheet has 2 pages (Front & Back), 6 species per page = 12 species per sheet
const totalSheets = computed(() => {
  return Math.max(1, Math.ceil(props.entries.length / (ITEMS_PER_PAGE * 2)));
});

// Initialize sheet states
watch(
  totalSheets,
  (newTotal) => {
    sheetFlippedState.value = new Array(newTotal).fill(false);
    currentSheetIndex.value = 0;
  },
  { immediate: true }
);

// Format date helper
function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// Get species for a specific page number (1-indexed)
function getSpeciesForPage(pageNumber: number): DiaryFishEntry[] {
  if (pageNumber < 1) return [];
  const start = (pageNumber - 1) * ITEMS_PER_PAGE;
  return props.entries.slice(start, start + ITEMS_PER_PAGE);
}

// Stats calculation
const stats = computed(() => {
  const total = props.entries.length;
  const caught = props.entries.filter((e) => e.isCaught).length;
  const percentage = total > 0 ? Math.round((caught / total) * 100) : 0;
  return { total, caught, percentage };
});

// Turn to NEXT page (Right to Left flip)
function flipNext() {
  if (isFlipping.value || currentSheetIndex.value >= totalSheets.value) return;

  const targetSheet = currentSheetIndex.value;
  isFlipping.value = true;
  animatingSheet.value = targetSheet;
  flipDirection.value = "next";

  // Trigger CSS transform transition
  setTimeout(() => {
    sheetFlippedState.value[targetSheet] = true;
  }, 20);

  // Complete animation after duration
  setTimeout(() => {
    currentSheetIndex.value++;
    animatingSheet.value = null;
    isFlipping.value = false;
  }, FLIP_DURATION);
}

// Turn to PREVIOUS page (Left to Right flip)
function flipPrev() {
  if (isFlipping.value || currentSheetIndex.value <= 0) return;

  const targetSheet = currentSheetIndex.value - 1;
  isFlipping.value = true;
  animatingSheet.value = targetSheet;
  flipDirection.value = "prev";

  // Trigger CSS transform transition
  setTimeout(() => {
    sheetFlippedState.value[targetSheet] = false;
  }, 20);

  // Complete animation after duration
  setTimeout(() => {
    currentSheetIndex.value--;
    animatingSheet.value = null;
    isFlipping.value = false;
  }, FLIP_DURATION);
}

// Calculate z-index for sheet i
function getSheetZIndex(sheetIndex: number): number {
  if (animatingSheet.value === sheetIndex) {
    return 100; // Flipping sheet is always on top
  }
  if (sheetFlippedState.value[sheetIndex]) {
    return sheetIndex + 1; // Left stack
  } else {
    return totalSheets.value - sheetIndex; // Right stack
  }
}
</script>

<template>
  <div class="w-full flex-1 flex flex-col justify-between select-none overflow-hidden">

    <!-- Book Container with 3D Perspective -->
    <div class="flex-1 flex items-center justify-center perspective-container">

      <div class="book-wrapper relative w-full h-full  bg-[#211209] rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.9)]">

        <!-- Book 3D Stage -->
        <div class="book-stage relative w-full h-full rounded-sm overflow-hidden shadow-2xl flex">

          <!-- Center Spine Drop Shadow Overlay -->
          <!-- <div class="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-10 bg-gradient-to-r from-amber-950/40 via-amber-950/70 to-amber-950/40 z-30 pointer-events-none border-x border-amber-950/30 shadow-2xl"></div> -->

          <!-- ================= BASE LEFT PAGE (Inside Cover / Page 0) ================= -->
          <div
            class="w-1/2 h-full bg-gradient-to-br from-[#faf3e3] via-[#f4e7d0] to-[#e8d7bb] p-3 md:p-5 flex flex-col justify-between border-r border-amber-900/20 relative shadow-inner">
            <div>
              <!-- Header -->
              <div class="flex items-center justify-between border-b-1 border-amber-900/30 mb-3"></div>

              <!-- Country Overview Card -->
              <div class="bg-amber-900/10 p-4 rounded-sm border border-amber-900/20 mb-4">
                <h4 class="m-0 font-serif font-bold text-sm text-amber-950 mb-2">
                  📖 Tổng Quan
                </h4>
                <p class="m-0 text-xs text-amber-900/80 leading-relaxed italic">
                  {{ country.information || `Vùng biển và hồ nước tại khu vực ${country.name} là nơi cư trú của nhiều
                  loài sinh vật độc đáo.` }}
                </p>
              </div>
              <!-- Collection Progress Badge -->
              <div
                class="bg-gradient-to-r from-amber-100 to-emerald-100/80 p-4 rounded-sm border border-emerald-700/30 text-amber-950 shadow-sm">
                <div class="flex items-center justify-between mb-2">
                  <span class="font-serif font-bold text-xs">Tiến độ sưu tầm</span>
                  <span class="font-bold text-xs text-emerald-800">{{ stats.caught }}/{{ stats.total }} loài</span>
                </div>
                <div class="w-full bg-amber-900/20 h-2.5 rounded-full overflow-hidden border border-amber-900/20">
                  <div
                    class="bg-gradient-to-r from-emerald-600 to-teal-500 h-full transition-all duration-500 rounded-full"
                    :style="{ width: `${stats.percentage}%` }"></div>
                </div>
                <p class="m-0 text-[10px] text-amber-900/70 mt-2 text-right italic font-serif">
                  Hoàn thành {{ stats.percentage }}%
                </p>
              </div>
            </div>
            
            <!-- Left Base Hotspot for Flipping Prev -->
            <div v-if="currentSheetIndex > 0"
              class="absolute inset-y-0 left-0 w-1/5 cursor-pointer group hover:bg-amber-900/5 transition-colors z-20 flex items-center justify-start pl-2"
              @click="flipPrev" title="Lật trang trước">
              <div
                class="w-8 h-8 rounded-full bg-amber-900/40 text-amber-100 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center font-bold text-sm shadow">
                ◀
              </div>
            </div>

            <!-- Page Number -->
            <div class="pt-1 border-t border-amber-900/20 text-[10px] text-amber-900/60 font-serif text-left">
              {{ country.name }}
            </div>
          </div>

          <!-- ================= BASE RIGHT PAGE (End Cover / Page Final) ================= -->
          <div
            class="w-1/2 h-full bg-gradient-to-bl from-[#faf3e3] via-[#f4e7d0] to-[#e8d7bb] p-3 md:p-5 flex flex-col justify-between relative shadow-inner">
            <div class="h-full">
              <div class="flex items-center justify-between border-b-1 border-amber-900/30"></div>
              <div class="grid place-items-center w-full h-full">
                <div
                  class="p-6 text-center text-amber-950/80 flex flex-col items-center justify-center">
                  <span class="text-4xl mb-3">⚓</span>
                  <h4 class="m-0 font-serif font-bold text-base text-amber-950 mb-1">
                    Đã xem hết nhật ký {{ country.name }}
                  </h4>
                  <p class="m-0 text-xs text-amber-900/70 italic max-w-xs">
                    Hãy di chuyển đến các bãi câu thuộc {{ country.name }} để tiếp tục chinh phục những loài cá mới!
                  </p>
                </div>
              </div>
            </div>

            <!-- Right Base Hotspot for Flipping Next -->
            <div v-if="currentSheetIndex < totalSheets"
              class="absolute inset-y-0 right-0 w-1/5 cursor-pointer group hover:bg-amber-900/5 transition-colors z-20 flex items-center justify-end pr-2"
              @click="flipNext" title="Lật trang kế tiếp">
              <div
                class="w-8 h-8 rounded-full bg-amber-900/40 text-amber-100 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center font-bold text-sm shadow">
                ▶
              </div>
            </div>

            <!-- Page Number -->
            <div class="pt-1 border-t border-amber-900/20 text-[10px] text-amber-900/60 font-serif text-right">
              End
            </div>
          </div>

          <!-- ================= 3D FLIPPING SHEETS STACK ================= -->
          <div v-for="(sheetFlipped, sheetIdx) in sheetFlippedState" :key="sheetIdx"
            class="paper-sheet absolute top-0 right-0 w-1/2 h-full" :style="{
              zIndex: getSheetZIndex(sheetIdx),
              transformOrigin: 'left center',
            }" :class="{
              'is-flipped': sheetFlipped,
              'is-animating': animatingSheet === sheetIdx
            }">
            <!-- FRONT FACE OF SHEET (Page 2*sheetIdx + 1: Right Side Page) -->
            <div
              class="sheet-face sheet-front absolute inset-0 bg-gradient-to-bl from-[#faf4e6] via-[#f5e9d3] to-[#ebdcc3] p-3 md:p-5 flex flex-col justify-between shadow-xl border-l border-amber-900/20">

              <div>
                <!-- Header -->
                <div class="flex items-center justify-between border-b-1 border-amber-900/30 mb-3"></div>

                <!-- 6 Species Cards Grid (2 Columns) -->
                <div class="grid grid-cols-2 gap-2">
                  <div v-for="entry in getSpeciesForPage(sheetIdx * 2 + 1)" :key="entry.species.id"
                    class="flex gap-2 p-1.5 rounded-lg border transition-all duration-200 relative overflow-hidden text-amber-950"
                    :class="[
                      entry.isCaught
                        ? 'bg-gradient-to-r from-amber-50 to-emerald-50/80 border-emerald-700/40 shadow-sm'
                        : 'bg-amber-900/10 border-amber-900/20 opacity-75 grayscale'
                    ]">
                    <!-- Fish Image -->
                    <div
                      class="relative w-10 h-10 shrink-0 rounded-md overflow-hidden border border-amber-900/30 bg-amber-900/20 flex items-center justify-center">
                      <img v-if="entry.species.image" :src="entry.species.image" :alt="entry.species.name"
                        class="w-full h-full object-cover"
                        :class="{ 'brightness-0 opacity-40 blur-[1px]': !entry.isCaught }" />
                      <span v-else class="text-base select-none">{{ entry.isCaught ? '🐟' : '❓' }}</span>
                      <div v-if="!entry.isCaught" class="absolute inset-0 flex items-center justify-center bg-black/30">
                        <span class="text-[10px]">🔒</span>
                      </div>
                    </div>

                    <!-- Fish Info -->
                    <div class="flex-1 flex flex-col justify-between text-[10px] min-w-0">
                      <div>
                        <div class="flex items-center justify-between gap-1">
                          <h4 class="m-0 font-serif font-bold text-[11px] text-amber-950 truncate">
                            {{ entry.isCaught ? entry.species.name : '???' }}
                          </h4>
                          <span class="px-1 py-0.2 rounded text-[8px] font-bold uppercase shrink-0 border" :class="[
                            entry.isCaught
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-gray-200 text-gray-700 border-gray-300'
                          ]">
                            {{ entry.isCaught ? (entry.species.status || 'Đã câu') : 'Chưa bắt' }}
                          </span>
                        </div>
                        <p class="m-0 text-[9px] text-amber-900/80 line-clamp-1 leading-tight italic mt-0.5">
                          {{ entry.isCaught
                            ? (entry.species.information || 'Chưa có thông tin sinh thái.')
                            : 'Chưa khám phá.'
                          }}
                        </p>
                      </div>
                      <div class="text-[8px] text-emerald-800 font-semibold mt-0.5">
                        <span v-if="entry.isCaught">✓ {{ formatDate(entry.caughtAt) }}</span>
                        <span v-else class="text-amber-800/60 font-medium">🔒 Trống</span>
                      </div>
                    </div>
                  </div>

                  <!-- Placeholder slot if less than ITEMS_PER_PAGE species -->
                  <div v-for="emptyIdx in (ITEMS_PER_PAGE - getSpeciesForPage(sheetIdx * 2 + 1).length)"
                    :key="'empty-front-' + emptyIdx"
                    class="p-1.5 text-center text-amber-900/40 italic border border-dashed border-amber-900/20 rounded-lg text-xs flex items-center justify-center min-h-[44px]">
                    Trống
                  </div>
                </div>
              </div>

              <!-- Front Face Shadow overlay during turn -->
              <div class="absolute inset-0 pointer-events-none transition-opacity duration-300" :class="[
                animatingSheet === sheetIdx && flipDirection === 'next' ? 'bg-gradient-to-l from-black/40 to-transparent opacity-80' : 'opacity-0'
              ]"></div>

              <!-- Footer -->
              <div class="pt-1 border-t border-amber-900/20 text-[10px] text-amber-900/60 font-serif text-right">
                Trang {{ sheetIdx * 2 + 1 }}
              </div>
            </div>

            <!-- BACK FACE OF SHEET (Page 2*sheetIdx + 2: Left Side Page when flipped) -->
            <div
              class="sheet-face sheet-back absolute inset-0 bg-gradient-to-br from-[#faf4e6] via-[#f5e9d3] to-[#ebdcc3] p-3 md:p-5 flex flex-col justify-between shadow-xl border-r border-amber-900/20">

              <div>
                <!-- Header -->
                <div class="flex items-center justify-between border-b-1 border-amber-900/30 mb-3"></div>

                <!-- 6 Species Cards Grid (2 Columns) -->
                <div class="grid grid-cols-2 gap-2">
                  <div v-for="entry in getSpeciesForPage(sheetIdx * 2 + 2)" :key="entry.species.id"
                    class="flex gap-2 p-1.5 rounded-lg border transition-all duration-200 relative overflow-hidden text-amber-950"
                    :class="[
                      entry.isCaught
                        ? 'bg-gradient-to-r from-amber-50 to-emerald-50/80 border-emerald-700/40 shadow-sm'
                        : 'bg-amber-900/10 border-amber-900/20 opacity-75 grayscale'
                    ]">
                    <!-- Fish Image -->
                    <div
                      class="relative w-10 h-10 shrink-0 rounded-md overflow-hidden border border-amber-900/30 bg-amber-900/20 flex items-center justify-center">
                      <img v-if="entry.species.image" :src="entry.species.image" :alt="entry.species.name"
                        class="w-full h-full object-cover"
                        :class="{ 'brightness-0 opacity-40 blur-[1px]': !entry.isCaught }" />
                      <span v-else class="text-base select-none">{{ entry.isCaught ? '🐟' : '❓' }}</span>
                      <div v-if="!entry.isCaught" class="absolute inset-0 flex items-center justify-center bg-black/30">
                        <span class="text-[10px]">🔒</span>
                      </div>
                    </div>

                    <!-- Fish Info -->
                    <div class="flex-1 flex flex-col justify-between text-[10px] min-w-0">
                      <div>
                        <div class="flex items-center justify-between gap-1">
                          <h4 class="m-0 font-serif font-bold text-[11px] text-amber-950 truncate">
                            {{ entry.isCaught ? entry.species.name : '???' }}
                          </h4>
                          <span class="px-1 py-0.2 rounded text-[8px] font-bold uppercase shrink-0 border" :class="[
                            entry.isCaught
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-gray-200 text-gray-700 border-gray-300'
                          ]">
                            {{ entry.isCaught ? (entry.species.status || 'Đã câu') : 'Chưa bắt' }}
                          </span>
                        </div>
                        <p class="m-0 text-[9px] text-amber-900/80 line-clamp-1 leading-tight italic mt-0.5">
                          {{ entry.isCaught
                            ? (entry.species.information || 'Chưa có thông tin sinh thái.')
                            : 'Chưa khám phá.'
                          }}
                        </p>
                      </div>
                      <div class="text-[8px] text-emerald-800 font-semibold mt-0.5">
                        <span v-if="entry.isCaught">✓ {{ formatDate(entry.caughtAt) }}</span>
                        <span v-else class="text-amber-800/60 font-medium">🔒 Trống</span>
                      </div>
                    </div>
                  </div>

                  <!-- Placeholder slot if less than ITEMS_PER_PAGE species -->
                  <div v-for="emptyIdx in (ITEMS_PER_PAGE - getSpeciesForPage(sheetIdx * 2 + 2).length)"
                    :key="'empty-back-' + emptyIdx"
                    class="p-1.5 text-center text-amber-900/40 italic border border-dashed border-amber-900/20 rounded-lg text-xs flex items-center justify-center min-h-[44px]">
                    Trống
                  </div>
                </div>
              </div>

              <!-- Back Face Shadow overlay during turn -->
              <div class="absolute inset-0 pointer-events-none transition-opacity duration-300" :class="[
                animatingSheet === sheetIdx && flipDirection === 'prev' ? 'bg-gradient-to-r from-black/40 to-transparent opacity-80' : 'opacity-0'
              ]"></div>

              <!-- Footer -->
              <div class="pt-1 border-t border-amber-900/20 text-[10px] text-amber-900/60 font-serif text-left">
                Trang {{ sheetIdx * 2 + 2 }}
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>

    <!-- Navigation Control Buttons -->
    <div class="mt-2 flex items-center justify-between px-4 shrink-0">
      <button type="button"
        class="flex items-center gap-1.5 px-4 py-2 rounded-sm bg-amber-800 hover:bg-amber-700 disabled:opacity-40 text-amber-100 font-bold text-xs transition-all shadow-md cursor-pointer border border-amber-500/40 active:scale-95 disabled:cursor-not-allowed"
        :disabled="currentSheetIndex === 0 || isFlipping" @click="flipPrev">
        <span>◀</span>
        <span>Trang trước</span>
      </button>

      <div class="text-xs font-serif font-bold text-amber-200">
        Tờ {{ currentSheetIndex }} / {{ totalSheets }} (Tổng {{ entries.length }} loài)
      </div>

      <button type="button"
        class="flex items-center gap-1.5 px-4 py-2 rounded-sm bg-amber-800 hover:bg-amber-700 disabled:opacity-40 text-amber-100 font-bold text-xs transition-all shadow-md cursor-pointer border border-amber-500/40 active:scale-95 disabled:cursor-not-allowed"
        :disabled="currentSheetIndex >= totalSheets || isFlipping" @click="flipNext">
        <span>Trang kế tiếp</span>
        <span>▶</span>
      </button>
    </div>

  </div>
</template>

<style scoped>
.perspective-container {
  perspective: 2000px;
}

.book-stage {
  transform-style: preserve-3d;
}

.paper-sheet {
  transform-style: preserve-3d;
  transition: transform 0.65s cubic-bezier(0.645, 0.045, 0.355, 1);
  transform: rotateY(0deg);
}

.paper-sheet.is-flipped {
  transform: rotateY(-180deg);
}

.sheet-face {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.sheet-front {
  transform: rotateY(0deg);
}

.sheet-back {
  transform: rotateY(180deg);
}
</style>
