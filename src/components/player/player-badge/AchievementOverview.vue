<script setup lang="ts">
import { t as tr } from "../../../i18n";
import { storeToRefs } from "pinia";
import { useBadgesStore } from "../../../stores/player-badges-store";

const badgesStore = useBadgesStore();
const { statusFilter, completion } = storeToRefs(badgesStore);
const emit = defineEmits<{ refresh: [] }>();
</script>

<template>
  <div
    class="slide-fade-in from-top player-content-in relative isolate overflow-hidden rounded-2xl border border-border-default bg-linear-to-br from-surface via-white to-emerald-50 p-3 shadow-sm sm:p-4"
  >
    <div
      aria-hidden="true"
      class="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-amber-200/30 blur-3xl"
    ></div>
    <div class="relative flex items-center justify-between gap-2 sm:items-end sm:gap-4">
      <div>
        <div
          class="m-0 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-800 sm:text-[10px] sm:tracking-[0.22em]"
        >
          {{ tr("Achievement.hanh_trinh_cua_ban") }}
        </div>
        <div
          id="badges-title"
          class="mb-0 mt-0.5 text-base font-black tracking-tight text-content sm:mt-1 sm:text-xl"
        >
          {{ tr("Achievement.bo_suu_tap_huy_hieu") }}
        </div>
      </div>
      <div
        class="flex shrink-0 items-center gap-2 rounded-xl border border-white/80 bg-white/75 px-2.5 py-1.5 shadow-sm backdrop-blur sm:gap-3 sm:px-3 sm:py-2"
      >
        <span
          class="grid h-7 w-7 place-items-center rounded-lg bg-amber-100 text-base sm:h-9 sm:w-9 sm:text-lg"
          aria-hidden="true"
          >🏆</span
        >
        <div>
          <div class="m-0 text-sm font-black leading-tight text-content sm:text-base">
            {{ badgesStore.earnedTotal
            }}<span class="text-xs font-semibold text-gray-400"> / {{ badgesStore.collectionTotal }}</span>
          </div>
          <div class="m-0 text-[9px] font-bold uppercase tracking-wide text-gray-500 sm:text-[10px]">
            {{ tr("Achievement.da_suu_tam") }}
          </div>
        </div>
      </div>
    </div>

    <div v-if="badgesStore.collectionTotal" class="relative mt-3 flex items-center gap-2 sm:mt-4 sm:gap-3">
      <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-emerald-950/10">
        <div
          class="h-full rounded-full bg-linear-to-r from-emerald-600 to-teal-400 transition-[width] duration-700"
          :style="{ width: `${completion}%` }"
        ></div>
      </div>
      <span class="text-[10px] font-black tabular-nums text-emerald-800 sm:text-xs">{{ completion }}%</span>
    </div>

    <div
      class="relative mt-3 flex flex-col gap-2 border-t border-emerald-900/10 pt-2.5 sm:mt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:pt-3"
    >
      <div class="m-0 shrink-0 text-[10px] font-bold text-palette-405346 sm:text-xs">
        {{ tr("Achievement.nhung_chiec_cup_cua_can_thu") }}
      </div>
      <button
        v-if="badgesStore.error"
        type="button"
        class="cursor-pointer text-xs font-bold text-emerald-800 underline"
        @click="emit('refresh')"
      >
        {{ tr("Fishfarm.tai_lai") }}
      </button>
      <div
        v-else
        class="-mx-1 flex min-w-0 gap-1 overflow-x-auto rounded-full border border-emerald-900/10 bg-white/80 p-0.5 text-[9px] font-bold sm:mx-0 sm:justify-end sm:overflow-visible sm:text-[10px]"
      >
        <button
          type="button"
          class="shrink-0 cursor-pointer rounded-full px-2 py-1 sm:px-2.5"
          :class="statusFilter === 'all' ? 'bg-emerald-800 text-white' : 'text-gray-500 hover:text-emerald-800'"
          :aria-pressed="statusFilter === 'all'"
          @click="statusFilter = 'all'"
        >
          {{ tr("Achievement.tat_ca") }}
        </button>
        <button
          type="button"
          class="shrink-0 cursor-pointer rounded-full px-2 py-1 sm:px-2.5"
          :class="statusFilter === 'earned' ? 'bg-emerald-800 text-white' : 'text-gray-500 hover:text-emerald-800'"
          :aria-pressed="statusFilter === 'earned'"
          @click="statusFilter = 'earned'"
        >
          {{ tr("Achievement.da_dat") }} {{ badgesStore.earnedTotal }}
        </button>
        <button
          type="button"
          class="shrink-0 cursor-pointer rounded-full px-2 py-1 sm:px-2.5"
          :class="
            statusFilter === 'unearned' ? 'bg-emerald-800 text-white' : 'text-gray-500 hover:text-emerald-800'
          "
          :aria-pressed="statusFilter === 'unearned'"
          @click="statusFilter = 'unearned'"
        >
          {{ tr("Achievement.chua_dat") }}
        </button>
        <button
          type="button"
          class="shrink-0 cursor-pointer rounded-full px-2 py-1 sm:px-2.5"
          :class="
            statusFilter === 'claimable' ? 'bg-emerald-800 text-white' : 'text-gray-500 hover:text-emerald-800'
          "
          :aria-pressed="statusFilter === 'claimable'"
          @click="statusFilter = 'claimable'"
        >
          {{ tr("Achievement.co_thuong") }}
        </button>
      </div>
    </div>
  </div>
</template>
