<script setup lang="ts">
import { getFormattingLocale, t as tr } from "../../../i18n";

import { computed } from "vue";
import { useFishingStore } from "../../../stores/fishing";
import { useToast } from "../../../composables/useToast";
import Fishthrash from "./Fishthrash.vue";

const store = useFishingStore();
const toast = useToast();
const caught = computed(() => store.inventory[0]);
const releaseDisabled = computed(() => store.isReleasingFish || store.isLeavingArea || store.hasLeftArea);

function closeDialog() {
  if (!store.isReleasingFish) store.closeCatchDialog();
}

async function releaseCatch() {
  const fish = caught.value;
  if (!fish || releaseDisabled.value) return;

  try {
    await store.releaseFish(fish.id);
    if (!store.inventory.some((item) => item.id === fish.id)) store.closeCatchDialog();
  } catch {
    toast.error(tr('CaughtModal.loi_khi_tha_ca'));
  }
}

const scoreFormatter = computed(() => new Intl.NumberFormat(getFormattingLocale(), { maximumFractionDigits: 6 }));
const variantFrameClass = computed(() => {
  switch (caught.value?.variantType) {
    case "GOLDEN":
      return "border-[#ffd54a] shadow-[0_24px_70px_rgba(255,190,45,0.38)]";
    case "MUTATED":
      return "border-[#b47cff] shadow-[0_24px_70px_rgba(150,75,255,0.38)]";
    default:
      return "border-[rgba(255,226,149,0.68)]";
  }
});
</script>

<template>
  <Teleport to="body">
    <Transition name="player-popup" :duration="{ enter: 220, leave: 150 }">
      <div
        v-if="store.catchDialogOpen && caught"
        class="fixed z-30 inset-0 grid place-items-center p-5 bg-[rgba(4,17,11,0.72)] backdrop-blur-[7px]"
        role="presentation"
        @click.self="closeDialog"
      >
        <section
          class="player-popup-panel catch-card grid w-full max-w-[680px] max-h-[calc(100dvh-40px)] overflow-y-auto border-2 rounded-[22px] bg-[linear-gradient(145deg,#173d2b,#0e281b)] shadow-[0_24px_70px_rgba(0,0,0,0.48)] text-[#f4f0df] sm:grid-cols-[260px_minmax(0,1fr)]"
          :class="variantFrameClass"
          role="dialog"
          aria-modal="true"
          aria-labelledby="catch-title"
          :aria-busy="store.isReleasingFish"
        >
          <div class="flex items-center justify-center bg-black/10">
            <Fishthrash :src="caught.image" :width="200" class="!h-[200px] !min-h-0 sm:!h-full sm:!min-h-[260px]" />
          </div>
          <div class="flex min-w-0 flex-col gap-4 p-5 sm:p-6">
            <div class="flex flex-wrap items-center gap-2">
              <span class="inline-block px-2 py-1 rounded-full bg-[#dcae52] text-[#254130] text-[9px] font-black tracking-[0.1em]">
                {{ caught.variantType }}
              </span>
              <span
                v-if="caught.isShiny"
                class="inline-block px-2 py-1 rounded-full bg-[#fff1a8] text-[#6b4b00] text-[9px] font-black tracking-widest"
              >
                {{ tr('CatchDialog.ca_xin') }}
              </span>
              <div
                v-if="caught.starRating !== undefined"
                class="text-[#ffd65a] text-sm font-black"
                :aria-label="tr('CatchDialog.star_rating', { count: caught.starRating })"
              >
                {{ "★".repeat(Math.max(0, Math.floor(caught.starRating))) }}
              </div>
            </div>
            <div id="catch-title" class="break-words text-2xl font-bold leading-tight">{{ caught.name }}</div>
            <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-[#b7cfb9] text-sm">
              <span>{{ caught.weight }}</span><span v-if="caught.length">{{ caught.length }}</span>
            </div>
            <div v-if="caught.score !== undefined" class="flex flex-wrap gap-x-3 gap-y-1 text-sm font-bold text-[#ffd65a]">
              <span>{{ scoreFormatter.format(caught.score) }} {{ tr('DailyMission.diem') }}</span>
              <span v-if="caught.seasonNumber !== undefined">{{ tr('LeaderboardSeason.season', { number: caught.seasonNumber }) }}</span>
            </div>
            <div class="mt-auto grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                class="rounded-[10px] border border-[#cbd9c6] bg-[#f5f9f0] px-3 py-3 text-sm font-bold text-[#24352a] cursor-pointer transition-colors hover:bg-[#e4eddd] disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="releaseDisabled"
                @click="releaseCatch"
              >
                {{ store.isReleasingFish ? tr('FishReleaseConfirm.dang_tha') : tr('CatchDialog.tha_ca') }}
              </button>
              <button
                type="button"
                class="p-3 border-0 rounded-[10px] bg-[#e1aa49] text-sm text-[#173223] cursor-pointer font-black transition-colors hover:bg-[#edbd66] disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="store.isReleasingFish"
                @click="closeDialog"
              >
                {{ tr('CatchDialog.cau_tiep') }}
              </button>
            </div>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
