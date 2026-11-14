<script setup lang="ts">
import { computed } from "vue";
import { getFormattingLocale } from "../../../i18n";
import type { LeaderboardBestFish } from "../../../types/model/leaderboard";

defineProps<{ fish: LeaderboardBestFish }>();
const formatter = computed(() => new Intl.NumberFormat(getFormattingLocale(), { maximumFractionDigits: 2 }));
</script>

<template>
  <div class="min-w-0 text-xs text-[#52654f]">
    <img v-if="fish.image" :src="fish.image" alt="" class="inline-block h-8 w-8 rounded object-contain" loading="lazy" />
    <div class="truncate font-semibold" :title="fish.name">{{ fish.name }}</div>
    <div>{{ formatter.format(fish.weight) }} kg · {{ fish.rarity }}</div>
  </div>
</template>
