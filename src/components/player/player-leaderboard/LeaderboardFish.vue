<script setup lang="ts">
import { computed } from "vue";
import { getFormattingLocale, t as tr } from "../../../i18n";
import type { LeaderboardBestFish } from "../../../types/model/leaderboard";

defineProps<{ fish: LeaderboardBestFish; compact?: boolean }>();
const formatter = computed(() => new Intl.NumberFormat(getFormattingLocale(), { maximumFractionDigits: 2 }));
const dateFormatter = computed(() => new Intl.DateTimeFormat(getFormattingLocale(), { dateStyle: 'short', timeStyle: 'medium' }));
</script>

<template>
  <div class="min-w-0 text-content-muted" :class="compact ? 'grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-1.5 text-[10px]' : 'text-xs'">
    <img v-if="fish.image" :src="fish.image" alt="" class="inline-block rounded object-contain" :class="compact ? 'row-span-2 size-6' : 'size-8'" loading="lazy" />
    <div class="col-start-2 truncate font-semibold" :title="fish.name">{{ fish.name }}</div>
    <div class="col-start-2">{{ formatter.format(fish.weight) }} kg<template v-if="fish.rarity"> · {{ fish.rarity }}</template></div>
    <div v-if="fish.caught_at && !compact" class="mt-1 text-[10px]">{{ tr('LeaderboardSeason.caught_at') }}: {{ dateFormatter.format(new Date(fish.caught_at)) }}</div>
  </div>
</template>
