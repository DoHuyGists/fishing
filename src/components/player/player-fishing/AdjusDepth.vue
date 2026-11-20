<script setup lang="ts">
import { getFormattingLocale } from "../../../i18n";
import { t as tr } from "../../../i18n";

import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { getDepthLayer } from "../../../data/fishingDepth";
import { useFishingStore } from "../../../stores/player-fishing-store";

const store = useFishingStore();
const depthConfig = computed(() => store.depthConfig);
const draftDepth = ref(store.appliedDepthMeters);
const depth = computed(() => Number(draftDepth.value));
const layer = computed(() => getDepthLayer(depth.value, depthConfig.value));
const depthPercent = computed(() => (depth.value / depthConfig.value.maxMeters) * 100);
const formattedDepth = computed(() =>
  new Intl.NumberFormat(getFormattingLocale(), { maximumFractionDigits: 1 }).format(depth.value),
);
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
  () => store.canAdjustLakeDepth,
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
    errorMessage.value = tr("AdjusDepth.hay_thu_moi_ve_truoc_khi_dieu_chinh_do_sau");
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
    <Transition name="player-popup" :duration="{ enter: 220, leave: 150 }">
      <div
        v-if="store.depthAdjusterOpen && store.canAdjustLakeDepth"
        class="fixed inset-0 z-[45] grid place-items-center overflow-y-auto bg-ocean-deep/80 p-3 backdrop-blur-[7px] sm:p-5"
        @click.self="close"
      >
        <section
          class="player-popup-panel depth-panel w-[min(980px,100%)] overflow-hidden rounded-[22px] border border-content bg-content text-white shadow-[0_28px_90px_color-mix(in_srgb,_var(--color-content)_58%,_transparent)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="depth-title"
        >
          <header class="flex items-center justify-between border-b border-white/10 px-5 py-3.5 sm:px-6">
            <div id="depth-title" class="m-0 flex items-center gap-2.5 text-base font-bold text-ocean-gold">
              <span class="text-accent" aria-hidden="true">≋</span>{{ tr("AdjusDepth.dieu_chinh_do_sau") }}
            </div>
            <button
              type="button"
              class="grid h-9 w-9 place-items-center rounded-full text-2xl text-content transition hover:bg-white/10 hover:text-white"
              :aria-label="tr('AdjusDepth.dong_bang_dieu_chinh_do_sau')"
              @click="close"
            >
              ×
            </button>
          </header>

          <div
            class="grid gap-2 p-2 grid-cols-2 sm:grid-cols-[minmax(280px,1.12fr)_minmax(150px,.72fr)_minmax(260px,1fr)] sm:gap-5 sm:p-5"
          >
            <section class="water-card" :aria-label="tr('AdjusDepth.mo_phong_cot_nuoc')">
              <div class="depth-ruler">
                <div class="water-column">
                  <div class="water-surface"><span></span></div>
                  <div class="fishing-line" :style="{ height: `${depthPercent}%` }"></div>
                  <div
                    class="bait-marker"
                    :style="{ top: `${depthPercent}%` }"
                    :aria-label="tr('AdjusDepth.moi_cau_o_do_sau_da_chon')"
                  >
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
                    >{{ tick }} m<small>{{
                      [
                        tr("AdjusDepth.mat_nuoc"),
                        tr("AdjusDepth.tang_giua"),
                        tr("AdjusDepth.tang_sau"),
                        tr("AdjusDepth.day_ho"),
                      ][i]
                    }}</small></span
                  >
                </div>
              </div>
            </section>

            <section class="control-card" :aria-label="tr('AdjusDepth.bo_dieu_khien_do_sau')">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <div class="m-0 text-[11px] text-content">{{ tr("AdjusDepth.do_sau_hien_tai") }}</div>
                  <div class="m-0 mt-1 text-[25px] font-extrabold leading-none text-white">
                    {{ formattedDepth }} <span class="text-sm font-semibold text-content">m</span>
                  </div>
                </div>
                <span class="mt-1 rounded-full bg-content px-2.5 py-1 text-[10px] font-bold text-content">{{
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
                    :aria-label="tr('AdjusDepth.do_sau_moi_cau')"
                    :aria-valuetext="tr('AdjusDepth.value0_met', { value0: formattedDepth })"
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
              <div class="m-0 text-center text-[10px] text-content">
                {{ tr("AdjusDepth.keo_thanh_hoac_dung_phim_mui_ten_de_chinh") }}
              </div>
            </section>

            <section class="info-card col-span-2 md:col-span-1">
              <div class="grid grid-cols-2 md:grid-cols-1 gap-2">
                <div>
                  <div class="m-0 mb-3 text-[12px] font-bold text-content">
                    {{ tr("AdjusDepth.thong_tin_tang_nuoc") }}
                  </div>
                  <div class="m-0 list-none space-y-2.5 p-0">
                    <div
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
                        ><b class="text-white">{{ waterLayer.label }}</b
                        ><span class="ml-1.5 text-content"
                          >{{ waterLayer.minMeters }}–{{ waterLayer.maxMeters }} m</span
                        ></span
                      >
                    </div>
                  </div>
                </div>
                <div class="md:border-t md:pt-2 border-white/10">
                  <div class="m-0 text-[11px] font-bold text-content">{{ tr("AdjusDepth.ca_co_the_xuat_hien") }}</div>
                  <div
                    v-if="store.isLoadingDepthPreview"
                    class="mb-0 mt-2 flex items-center gap-2 rounded-lg bg-content/10 px-2.5 py-2 text-[10px] text-content"
                    role="status"
                    aria-live="polite"
                  >
                    <span
                      class="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-content/30 border-t-accent"
                      aria-hidden="true"
                    ></span
                    >{{ tr("AdjusDepth.dang_cap_nhat_danh_sach_ca_o") }} {{ formattedDepth }} m...
                  </div>
                  <div
                    v-else-if="store.depthPreviewError"
                    class="mb-0 mt-2 rounded-lg bg-content/10 px-2.5 py-2 text-[10px] leading-relaxed text-gold"
                  >
                    {{ store.depthPreviewError }}
                  </div>
                  <template v-else-if="store.depthPreview">
                    <div class="mb-2 mt-1 text-[9px] text-content">
                      {{ store.depthPreview.total_species }} {{ tr("AdjusDepth.loai") }}
                      {{ store.depthPreview.discovered_species }} {{ tr("AdjusDepth.da_kham_pha") }}
                      {{ store.depthPreview.undiscovered_species }} {{ tr("AdjusDepth.chua_kham_pha") }}
                    </div>
                    <div v-if="store.depthPreview.fishes.length" class="m-0 list-none space-y-1.5 overflow-y-auto p-0">
                      <div
                        v-for="fish in store.depthPreview.fishes"
                        :key="fish.species_id"
                        class="flex items-center gap-2 rounded-lg bg-content/10 px-2 py-1.5"
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
                          class="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white/10 text-sm text-content"
                          aria-hidden="true"
                          >?</span
                        >
                        <span class="min-w-0 flex-1">
                          <span class="block truncate text-[10px] font-semibold text-content">{{
                            fish.display_name
                          }}</span>
                          <span class="block text-[9px] text-content"
                            >{{ fish.spawn_chance }}% ·
                            {{
                              fish.weight_min != null && fish.weight_max != null
                                ? `${fish.weight_min}–${fish.weight_max} kg`
                                : tr("AdjusDepth.chua_ro_can_nang")
                            }}</span
                          >
                          <span v-if="fish.rarity" class="text-[8px] text-content">{{ fish.rarity }}</span>
                        </span>
                      </div>
                    </div>
                    <div v-else class="mb-0 mt-2 text-[10px] text-content">
                      {{ tr("AdjusDepth.khong_co_loai_ca_o_do_sau_nay") }}
                    </div>
                  </template>
                  <div
                    v-else
                    class="mb-0 mt-2 rounded-lg bg-content/10 px-2.5 py-2 text-[10px] leading-relaxed text-content"
                  >
                    {{ tr("AdjusDepth.chua_co_du_lieu_du_doan_o") }} {{ formattedDepth }} m.
                  </div>
                </div>
              </div>
            </section>
          </div>

          <footer class="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3 sm:px-5">
            <div v-if="errorMessage" class="m-0 text-[11px] text-gold" role="status">{{ errorMessage }}</div>
            <div v-else-if="!store.canAdjustDepth" class="m-0 text-[11px] text-gold">
              {{ tr("AdjusDepth.hay_thu_moi_ve_truoc_khi_ap_dung_thay_doi") }}
            </div>
            <span v-else class="text-[10px] text-content"
              >{{ tr("AdjusDepth.do_sau_da_luu") }} {{ store.appliedDepthMeters }} m</span
            >
            <div class="ml-auto flex gap-2">
              <button
                type="button"
                class="rounded-xl border border-white/15 px-4 py-2 text-[11px] font-semibold text-content transition hover:bg-white/[0.07]"
                @click="close"
              >
                {{ tr("AccountInfoModal.huy") }}
              </button>
              <button
                type="button"
                class="rounded-xl bg-gradient-to-r from-accent to-accent px-5 py-2 text-[11px] font-extrabold text-white shadow-lg shadow-accent/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
                :disabled="!store.canAdjustDepth"
                @click="apply"
              >
                {{ tr("AdjusDepth.ap_dung") }}
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
  border: 1px solid color-mix(in srgb, var(--color-accent) 15%, transparent);
  background: color-mix(in srgb, var(--color-content) 42%, transparent);
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
  /* background: linear-gradient(180deg, var(--color-sky) 0%, var(--color-primary) 22%, var(--color-primary) 58%, var(--color-content) 82%, var(--color-content) 100%); */
  background-image: url("/Mystical Underwater Lightbeams.png");
  background-position: bottom;
  background-size: cover;
  background-repeat: no-repeat;
  box-shadow: inset 0 0 22px color-mix(in srgb, var(--color-content) 53.333%, transparent);
}

.water-surface {
  position: absolute;
  z-index: 2;
  top: 5px;
  left: -5%;
  width: 110%;
  height: 14px;
  border-top: 2px solid var(--color-surface);
  border-radius: 50%;
  filter: drop-shadow(0 0 4px var(--color-sky));
}

.water-surface span {
  position: absolute;
  inset: -3px 0 auto;
  height: 5px;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-surface) 66.667%, transparent), transparent);
  filter: blur(3px);
}

.fishing-line {
  position: absolute;
  z-index: 2;
  top: 0;
  left: 50%;
  width: 1px;
  background: color-mix(in srgb, var(--color-surface) 80%, transparent);
  box-shadow: 0 0 4px var(--color-surface);
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
  border: 2px solid var(--color-surface);
  border-radius: 50%;
  background: var(--color-accent);
  color: var(--color-surface);
  font-size: 10px;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 12px var(--color-accent);
}

.depth-tick {
  position: absolute;
  z-index: 1;
  right: 7px;
  left: 7px;
  border-top: 1px solid color-mix(in srgb, var(--color-surface) 60%, transparent);
  color: color-mix(in srgb, var(--color-surface) 66.667%, transparent);
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
  border-bottom: 1px solid color-mix(in srgb, var(--color-surface) 60%, transparent);
  transform: translateY(-100%);
}

.depth-labels {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 0 0 0 1px;
  color: var(--color-surface);
  font-size: 10px;
  font-weight: 700;
}

.depth-labels small {
  display: block;
  margin-top: 2px;
  color: var(--color-content);
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
  accent-color: var(--color-accent);
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
  border: 1px solid var(--color-content);
  border-radius: 999px;
  background: var(--color-content);
  padding: 5px 10px;
  color: var(--color-surface);
  font-size: 10px;
  cursor: pointer;
}

.quick-stops button.active,
.quick-stops button:hover {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: var(--color-surface);
}

html.ocean-theme .water-card,
html.ocean-theme .control-card,
html.ocean-theme .info-card {
  border-color: color-mix(in srgb, var(--color-sky) 25%, transparent);
  background: color-mix(in srgb, var(--color-primary) 45%, transparent);
}

html.ocean-theme .bait-marker {
  border-color: var(--color-ocean-gold);
  background: var(--color-ocean-panel);
  color: var(--color-ocean-pearl);
  box-shadow: 0 0 12px color-mix(in srgb, var(--color-sky) 65%, transparent);
}

html.ocean-theme .vertical-slider {
  accent-color: var(--color-ocean-cyan);
}

html.ocean-theme .quick-stops button {
  border-color: color-mix(in srgb, var(--color-sky) 35%, transparent);
  background: var(--color-ocean-deep);
  color: var(--color-ocean-pearl);
}

html.ocean-theme .quick-stops button.active,
html.ocean-theme .quick-stops button:hover {
  border-color: var(--color-ocean-gold);
  background: var(--color-ocean-panel);
  color: var(--color-ocean-gold);
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
