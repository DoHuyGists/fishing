<script setup lang="ts">
import { t as tr } from '../../../i18n';
import type { LeaderboardRankedEntry } from '../../../types/model/leaderboard';

defineProps<{
  entries: LeaderboardRankedEntry[];
  userId?: string;
  unit: string;
  formatter: Intl.NumberFormat;
  fishCards?: boolean;
}>();
</script>

<template>
  <div :aria-label="tr('LeaderboardModal.ba_vi_tri_dan_dau')" class="grid grid-cols-3 items-end gap-2 sm:gap-3" :class="fishCards ? 'pt-1' : 'pt-4 sm:pt-5'">
    <div
      v-for="(entry, index) in entries"
      :key="entry.id"
      class="slide-fade-in from-bottom player-content-in relative min-w-0 border text-center"
      :class="[
        index === 0 ? 'col-start-2 row-start-1 border-amber-300 bg-linear-to-b from-amber-50 to-amber-100/60 shadow-sm' : index === 1 ? 'col-start-1 row-start-1 border-border-default bg-linear-to-b from-surface to-white' : 'col-start-3 row-start-1 border-orange-200 bg-linear-to-b from-orange-50 to-white',
        fishCards ? 'rounded-xl' : ['rounded-t-2xl rounded-b-xl px-2 pb-3 sm:px-3', index === 0 ? 'pt-6 sm:pt-7' : 'pt-4'],
        entry.userId === userId ? 'ring-2 ring-inset ring-emerald-600' : '',
      ]"
    >
      <span class="absolute z-10 text-2xl sm:text-3xl" :class="fishCards ? 'top-1 left-1' : '-top-4 left-1/2 -translate-x-1/2'" aria-hidden="true">{{ ['🥇', '🥈', '🥉'][entry.rank - 1] ?? '🏅' }}</span>
      <div v-if="fishCards" class="flex items-center justify-center rounded-t-xl bg-white/50 px-2 pt-5 pb-4 sm:px-4" :class="index === 0 ? 'h-28 sm:h-32' : 'h-24 sm:h-28'">
        <img v-if="entry.bestFish?.image" :src="entry.bestFish.image" :alt="entry.bestFish.name" class="size-full object-contain" loading="lazy" />
        <span v-else class="text-4xl" aria-hidden="true">🐟</span>
      </div>
      <div :class="fishCards ? 'relative min-h-32 rounded-b-xl border-t border-black/5 px-1.5 pt-6 pb-3 sm:px-3' : ''">
      <div class="mx-auto flex size-8 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-surface-muted text-xs font-extrabold text-emerald-800 shadow-sm sm:size-10" :class="[index === 0 ? 'ring-2 ring-amber-300' : '', fishCards ? 'absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2' : '']">
        <img v-if="entry.avatarUrl" :src="entry.avatarUrl" alt="" class="size-full object-cover" referrerpolicy="no-referrer" />
        <span v-else aria-hidden="true">{{ entry.displayName.slice(0, 2).toUpperCase() }}</span>
      </div>
      <div class="mt-2 text-[10px] font-extrabold text-content-muted" :aria-label="tr('LeaderboardModal.hang_value0', { value0: entry.rank })">#{{ entry.rank }}</div>
      <div class="mt-0.5 truncate text-xs font-bold" :title="entry.displayName">{{ entry.displayName }}</div>
      <div v-if="entry.userId === userId" class="mt-1 text-[10px] font-bold text-emerald-700">{{ tr('LeaderboardModal.ban_2') }}</div>
      <div class="mt-2 break-words text-base font-black tabular-nums leading-tight sm:text-lg" :class="index === 0 ? 'text-amber-900' : ''">{{ formatter.format(entry.value) }}</div>
      <div class="mt-0.5 text-[10px] font-medium text-content-muted">{{ unit }}</div>
      <template v-if="fishCards && entry.bestFish">
        <div class="mt-2 truncate text-[10px] font-semibold text-content-muted sm:text-xs" :title="entry.bestFish.name">{{ entry.bestFish.name }}</div>
        <div class="mt-0.5 text-[10px] text-content-muted">{{ formatter.format(entry.bestFish.weight) }} kg<template v-if="entry.bestFish.rarity"> · {{ entry.bestFish.rarity }}</template></div>
      </template>
      </div>
    </div>
  </div>
</template>
