<script setup lang="ts">
import { computed } from "vue";
import { getFormattingLocale, t as tr } from "../../../i18n";
import type { LeaderboardBestFish } from "../../../types/model/leaderboard";

defineProps<{ fish: LeaderboardBestFish }>();
const formatter = computed(() => new Intl.NumberFormat(getFormattingLocale(), { maximumFractionDigits: 2 }));
const dateFormatter = computed(() => new Intl.DateTimeFormat(getFormattingLocale(), { dateStyle: 'short', timeStyle: 'medium' }));
</script>

<template>
  <div class="min-w-0 text-xs text-[#52654f]">
    <img v-if="fish.image" :src="fish.image" alt="" class="inline-block h-8 w-8 rounded object-contain" loading="lazy" />
    <div class="truncate font-semibold" :title="fish.name">{{ fish.name }}</div>
    <div>{{ formatter.format(fish.weight) }} kg · {{ fish.rarity }}</div>
    <div v-if="fish.caught_at" class="mt-1 text-[10px]">{{ tr('LeaderboardSeason.caught_at') }}: {{ dateFormatter.format(new Date(fish.caught_at)) }}</div>
  </div>
</template>
