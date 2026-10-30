<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { getDepthLayer } from "../../../data/fishingDepth";
import { useFishingStore } from "../../../stores/fishing";

const store = useFishingStore();
const depthConfig = computed(() => store.depthConfig);
const draftDepth = ref(store.appliedDepthMeters);
const depth = computed(() => Number(draftDepth.value));
const layer = computed(() => getDepthLayer(depth.value, depthConfig.value));
const depthPercent = computed(() => (depth.value / depthConfig.value.maxMeters) * 100);
const formattedDepth = computed(() => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(depth.value));
const errorMessage = ref("");
let depthPreviewTimeout: ReturnType<typeof setTimeout> | undefined;

function scheduleDepthPreview(castDepth: number) {
  if (depthPreviewTimeout !== undefined) clearTimeout(depthPreviewTimeout);
  store.isLoadingDepthPreview = true;
  store.depthPreviewError = "";
  depthPreviewTimeout = setTimeout(() => {
    depthPreviewTimeout = undefined;
    if (store.depthAdjusterOpen) void store.fetchDepthPreview(castDepth);
  }, 2000);
}

watch(
  () => store.depthAdjusterOpen,
  (isOpen) => {
    if (isOpen) {
      draftDepth.value = store.appliedDepthMeters;
      errorMessage.value = "";
      scheduleDepthPreview(store.appliedDepthMeters);
    } else {
      if (depthPreviewTimeout !== undefined) clearTimeout(depthPreviewTimeout);
      depthPreviewTimeout = undefined;
      store.depthPreviewRequestId += 1;
      store.isLoadingDepthPreview = false;
    }
  },
);

watch(
  () => store.canAdjustDepth,
  (canAdjust) => {
    if (!canAdjust) close();
  },
  { immediate: true },
);

watch(depth, (castDepth) => {
  if (store.depthAdjusterOpen) scheduleDepthPreview(castDepth);
});

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") close();
}

function close() {
  store.depthAdjusterOpen = false;
  errorMessage.value = "";
}

function apply() {
  if (!store.canAdjustDepth) {
    errorMessage.value = "Hãy thu mồi về trước khi điều chỉnh độ sâu.";
    return;
  }
  store.applyDepth(depth.value);
  close();
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  if (depthPreviewTimeout !== undefined) clearTimeout(depthPreviewTimeout);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="depth-dialog">
      <div
        v-if="store.depthAdjusterOpen && store.canAdjustDepth"
        class="fixed inset-0 z-[45] grid place-items-center overflow-y-auto bg-[rgba(3,15,11,0.78)] p-3 backdrop-blur-[7px] sm:p-5"
        @click.self="close"
      >
        <section
          class="depth-panel w-[min(980px,100%)] overflow-hidden rounded-[22px] border border-[#315b4d] bg-[#071f1a] text-[#e8f2ed] shadow-[0_28px_90px_rgba(0,0,0,0.58)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="depth-title"
        >
          <header class="flex items-center justify-between border-b border-white/10 px-5 py-3.5 sm:px-6">
            <h2 id="depth-title" class="m-0 flex items-center gap-2.5 text-base font-bold">
              <span class="text-[#5ad0b3]" aria-hidden="true">≋</span>Điều chỉnh độ sâu
            </h2>
            <button
              type="button"
              class="grid h-9 w-9 place-items-center rounded-full text-2xl text-[#b8ccc4] transition hover:bg-white/10 hover:text-white"
              aria-label="Đóng bảng điều chỉnh độ sâu"
              @click="close"
            >
              ×
            </button>
          </header>

          <div
            class="grid gap-2 p-2 grid-cols-2 sm:grid-cols-[minmax(280px,1.12fr)_minmax(150px,.72fr)_minmax(260px,1fr)] sm:gap-5 sm:p-5"
          >
            <section class="water-card" aria-label="Mô phỏng cột nước">
              <div class="depth-ruler">
                <div class="water-column">
                  <div class="water-surface"><span></span></div>
                  <div class="fishing-line" :style="{ height: `${depthPercent}%` }"></div>
                  <div class="bait-marker" :style="{ top: `${depthPercent}%` }" aria-label="Mồi câu ở độ sâu đã chọn">
                    ●
                  </div>
                  <span
                    v-for="tick in depthConfig.ticksMeters"
                    :key="tick"
                    class="depth-tick"
                    :class="{
                      'surface-depth-tick': tick === 0,
                      'bottom-depth-tick': tick === depthConfig.maxMeters,
                    }"
                    :style="{ top: `${(tick / depthConfig.maxMeters) * 100}%` }"
                    >{{ tick }} m</span
                  >
                </div>
                <div class="depth-labels" aria-hidden="true">
                  <span v-for="(tick, i) in depthConfig.ticksMeters" :key="tick"
                    >{{ tick }} m<small>{{ ["Mặt nước", "Tầng giữa", "Tầng sâu", "Đáy hồ"][i] }}</small></span
                  >
                </div>
              </div>
            </section>

            <section class="control-card" aria-label="Bộ điều khiển độ sâu">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <p class="m-0 text-[11px] text-[#91aaa0]">Độ sâu hiện tại</p>
                  <p class="m-0 mt-1 text-[25px] font-extrabold leading-none text-white">
                    {{ formattedDepth }} <span class="text-sm font-semibold text-[#a9c4b8]">m</span>
                  </p>
                </div>
                <span class="mt-1 rounded-full bg-[#174a3d] px-2.5 py-1 text-[10px] font-bold text-[#b9ebd8]">{{
                  layer.label
                }}</span>
              </div>
              <div class="slider-layout">
                <div class="vertical-slider-wrap">
                  <input
                    v-model.number="draftDepth"
                    class="vertical-slider"
                    type="range"
                    min="0"
                    :max="depthConfig.maxMeters"
                    :step="depthConfig.stepMeters"
                    aria-label="Độ sâu mồi câu"
                    :aria-valuetext="`${formattedDepth} mét`"
                    orient="vertical"
                  />
                </div>
                <div class="quick-stops">
                  <button
                    v-for="stop in depthConfig.quickStopsMeters"
                    :key="stop"
                    type="button"
                    :aria-pressed="depth === stop"
                    :class="{ active: depth === stop }"
                    @click="draftDepth = stop"
                  >
                    {{ stop }} m
                  </button>
                </div>
              </div>
              <p class="m-0 text-center text-[10px] text-[#78958a]">Kéo thanh hoặc dùng phím mũi tên để chỉnh</p>
            </section>

            <section class="info-card col-span-2 md:col-span-1">
              <div class="grid grid-cols-2 md:grid-cols-1 gap-2">
                <div>
                  <h3 class="m-0 mb-3 text-[12px] font-bold text-[#d8e9e0]">Thông tin tầng nước</h3>
                  <ul class="m-0 list-none space-y-2.5 p-0">
                    <li
                      v-for="waterLayer in depthConfig.layers"
                      :key="waterLayer.id"
                      class="flex items-start gap-2.5 rounded-lg px-2 py-1.5"
                      :class="{ 'bg-white/[0.07]': layer.id === waterLayer.id }"
                    >
                      <span
                        class="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                        :style="{ backgroundColor: waterLayer.color }"
                      ></span>
                      <span class="min-w-0 text-[10px] leading-[1.45]"
                        ><b class="text-[#e4eee8]">{{ waterLayer.label }}</b
                        ><span class="ml-1.5 text-[#93aa9f]"
                          >{{ waterLayer.minMeters }}–{{ waterLayer.maxMeters }} m</span
                        ></span
                      >
                    </li>
                  </ul>
                </div>
                <div class="md:border-t md:pt-2 border-white/10">
                  <h3 class="m-0 text-[11px] font-bold text-[#d8e9e0]">Cá có thể xuất hiện</h3>
                  <p
                    v-if="store.isLoadingDepthPreview"
                    class="mb-0 mt-2 flex items-center gap-2 rounded-lg bg-black/10 px-2.5 py-2 text-[10px] text-[#91aaa0]"
                    role="status"
                    aria-live="polite"
                  >
                    <span
                      class="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-[#91aaa0]/30 border-t-[#5ad0b3]"
                      aria-hidden="true"
                    ></span
                    >Đang cập nhật danh sách cá ở {{ formattedDepth }} m...
                  </p>
                  <p
                    v-else-if="store.depthPreviewError"
                    class="mb-0 mt-2 rounded-lg bg-black/10 px-2.5 py-2 text-[10px] leading-relaxed text-[#ffc18b]"
                  >
                    {{ store.depthPreviewError }}
                  </p>
                  <template v-else-if="store.depthPreview">
                    <p class="mb-2 mt-1 text-[9px] text-[#91aaa0]">
                      {{ store.depthPreview.total_species }} loài · {{ store.depthPreview.discovered_species }} đã khám
                      phá · {{ store.depthPreview.undiscovered_species }} chưa khám phá
                    </p>
                    <ul v-if="store.depthPreview.fishes.length" class="m-0 list-none space-y-1.5 overflow-y-auto p-0">
                      <li
                        v-for="fish in store.depthPreview.fishes"
                        :key="fish.species_id"
                        class="flex items-center gap-2 rounded-lg bg-black/10 px-2 py-1.5"
                      >
                        <img
                          v-if="fish.is_discovered && fish.image"
                          :src="fish.image"
                          :alt="fish.display_name"
                          class="h-8 w-fit shrink-0 rounded-md object-cover"
                          draggable="false"
                        />
                        <span
                          v-else
                          class="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white/10 text-sm text-[#91aaa0]"
                          aria-hidden="true"
                          >?</span
                        >
                        <span class="min-w-0 flex-1">
                          <span class="block truncate text-[10px] font-semibold text-[#d8e9e0]">{{
                            fish.display_name
                          }}</span>
                          <span class="block text-[9px] text-[#91aaa0]"
                            >{{ fish.spawn_chance }}% ·
                            {{
                              fish.weight_min != null && fish.weight_max != null
                                ? `${fish.weight_min}–${fish.weight_max} kg`
                                : "Chưa rõ cân nặng"
                            }}</span
                          >
                          <span v-if="fish.rarity" class="text-[8px] text-[#a9c4b8]">{{ fish.rarity }}</span>
                        </span>
                      </li>
                    </ul>
                    <p v-else class="mb-0 mt-2 text-[10px] text-[#91aaa0]">Không có loài cá ở độ sâu này.</p>
                  </template>
                  <p
                    v-else
                    class="mb-0 mt-2 rounded-lg bg-black/10 px-2.5 py-2 text-[10px] leading-relaxed text-[#91aaa0]"
                  >
                    Chưa có dữ liệu dự đoán ở {{ formattedDepth }} m.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <footer class="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3 sm:px-5">
            <p v-if="errorMessage" class="m-0 text-[11px] text-[#ffc18b]" role="status">{{ errorMessage }}</p>
            <p v-else-if="!store.canAdjustDepth" class="m-0 text-[11px] text-[#d5c994]">
              Hãy thu mồi về trước khi áp dụng thay đổi.
            </p>
            <span v-else class="text-[10px] text-[#78958a]">Độ sâu đã lưu: {{ store.appliedDepthMeters }} m</span>
            <div class="ml-auto flex gap-2">
              <button
                type="button"
                class="rounded-xl border border-white/15 px-4 py-2 text-[11px] font-semibold text-[#c1d3ca] transition hover:bg-white/[0.07]"
                @click="close"
              >
                Hủy
              </button>
              <button
                type="button"
                class="rounded-xl bg-gradient-to-r from-[#3f9d70] to-[#59bb79] px-5 py-2 text-[11px] font-extrabold text-white shadow-lg shadow-emerald-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
                :disabled="!store.canAdjustDepth"
                @click="apply"
              >
                ✓ Áp dụng
              </button>
            </div>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.water-card,
.control-card,
.info-card {
  min-width: 0;
  border: 1px solid rgba(128, 183, 158, 0.15);
  background: rgba(14, 47, 38, 0.42);
  padding: 14px;
}

.depth-ruler {
  display: flex;
  height: 500px;
  justify-content: center;
  gap: 12px;
}

.water-column {
  position: relative;
  width: min(150px, 62%);
  height: 100%;
  overflow: hidden;
  border-radius: 3px;
  /* background: linear-gradient(180deg, #53c7d0 0%, #138c9b 22%, #07546d 58%, #07324d 82%, #102d37 100%); */
  background-image: url("/Mystical Underwater Lightbeams.png");
  background-position: bottom;
  background-size: cover;
  background-repeat: no-repeat;
  box-shadow: inset 0 0 22px #031f2d88;
}

.water-surface {
  position: absolute;
  z-index: 2;
  top: 5px;
  left: -5%;
  width: 110%;
  height: 14px;
  border-top: 2px solid #d4ffff;
  border-radius: 50%;
  filter: drop-shadow(0 0 4px #a6ffff);
}

.water-surface span {
  position: absolute;
  inset: -3px 0 auto;
  height: 5px;
  background: linear-gradient(90deg, transparent, #e5ffffaa, transparent);
  filter: blur(3px);
}

.fishing-line {
  position: absolute;
  z-index: 2;
  top: 0;
  left: 50%;
  width: 1px;
  background: #d8fff7cc;
  box-shadow: 0 0 4px #b4fff0;
  pointer-events: none;
}

.bait-marker {
  position: absolute;
  z-index: 3;
  left: 50%;
  display: grid;
  width: 21px;
  height: 21px;
  place-items: center;
  border: 2px solid #eaffdd;
  border-radius: 50%;
  background: #60c78a;
  color: #f4ffd5;
  font-size: 10px;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 12px #7dffc3;
}

.depth-tick {
  position: absolute;
  z-index: 1;
  right: 7px;
  left: 7px;
  border-top: 1px solid #d6fff599;
  color: #d8f4f0aa;
  font-size: 8px;
  text-align: right;
  transform: translateY(-50%);
}

.surface-depth-tick {
  z-index: 3;
  border-top: 0;
  padding-top: 11px;
  transform: none;
}

.bottom-depth-tick {
  border-top: 0;
  border-bottom: 1px solid #d6fff599;
  transform: translateY(-100%);
}

.depth-labels {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 0 0 0 1px;
  color: #dcebe5;
  font-size: 10px;
  font-weight: 700;
}

.depth-labels small {
  display: block;
  margin-top: 2px;
  color: #8eaaa0;
  font-size: 8px;
  font-weight: 400;
  white-space: nowrap;
}

.slider-layout {
  display: flex;
  height: 205px;
  align-items: center;
  justify-content: center;
  gap: 18px;
  margin: 8px 0;
}

.vertical-slider-wrap {
  position: relative;
  flex: 0 0 40px;
  height: 190px;
  overflow: visible;
}

.vertical-slider {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 190px;
  height: 28px;
  margin: 0;
  accent-color: #62d9b9;
  cursor: pointer;
  touch-action: none;
  transform: translate(-50%, -50%) rotate(-90deg);
}

.quick-stops {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 190px;
}

.quick-stops button {
  min-width: 56px;
  border: 1px solid #315d50;
  border-radius: 999px;
  background: #102d25;
  padding: 5px 10px;
  color: #b8ccc4;
  font-size: 10px;
  cursor: pointer;
}

.quick-stops button.active,
.quick-stops button:hover {
  border-color: #5cbd8a;
  background: #28694b;
  color: #f0fff3;
}

.depth-dialog-enter-active,
.depth-dialog-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.depth-dialog-enter-from,
.depth-dialog-leave-to {
  opacity: 0;
}

.depth-dialog-enter-from .depth-panel,
.depth-dialog-leave-to .depth-panel {
  transform: translateY(8px) scale(0.99);
}

@media (max-width: 639px) {
  .depth-ruler {
    height: 220px;
  }

  .slider-layout {
    height: 165px;
  }

  .vertical-slider-wrap {
    height: 150px;
  }

  .vertical-slider {
    width: 150px;
  }

  .quick-stops {
    height: 150px;
  }

  .info-card {
    padding: 12px;
  }

  .water-card,
  .control-card {
    padding: 12px;
  }
}
</style>
