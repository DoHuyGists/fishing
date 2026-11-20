<script setup lang="ts">
import { t as tr } from "../../../i18n";
import { useLeaderboardStore } from "../../../stores/player-leaderboard-store.ts";
import LeaderboardRewards from "./LeaderboardRewards.vue";

const store = useLeaderboardStore();
</script>

<template>
  <div class="slide-fade-in from-bottom player-content-in space-y-6 text-sm leading-relaxed text-content">
    <div class="relative overflow-hidden rounded-2xl bg-palette-243f32 px-5 py-6 text-white sm:px-8 sm:py-8">
      <div
        aria-hidden="true"
        class="pointer-events-none absolute -right-6 -top-10 text-[160px] leading-none opacity-10"
      >
        🏆
      </div>
      <div class="relative max-w-2xl">
        <div class="text-xs font-semibold uppercase tracking-widest text-border-default">
          {{ tr("LeaderboardRules.tab") }}
        </div>
        <div class="mt-2 text-2xl font-bold sm:text-3xl">{{ tr("LeaderboardRules.intro_title") }}</div>
        <div class="mt-2 text-sm text-palette-dbe7d6">{{ tr("LeaderboardRules.intro") }}</div>
      </div>
      <div class="relative mt-5 flex flex-wrap gap-2 text-xs font-semibold">
        <span class="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">{{
          tr("LeaderboardRules.category_count")
        }}</span>
        <span class="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">{{
          tr("LeaderboardRules.season_length")
        }}</span>
        <span class="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">{{
          tr("LeaderboardRules.reward_highlight")
        }}</span>
      </div>
    </div>

    <section :aria-label="tr('LeaderboardRules.ranking')">
      <div class="mb-3 text-lg font-bold">{{ tr("LeaderboardRules.ranking") }}</div>
      <div class="grid gap-3 md:grid-cols-2">
        <div
          v-for="category in store.categories"
          :key="category.key"
          class="flex items-start gap-3 rounded-2xl border border-border-default bg-surface p-4 sm:gap-4 sm:p-5"
        >
          <span
            aria-hidden="true"
            class="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border-default bg-white text-xl"
            >{{ category.emoji }}</span
          >
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <div class="font-bold">{{ category.label }}</div>
              <span class="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-content-muted">{{
                tr(category.key === "best_fish" ? "LeaderboardRules.seasonal" : "LeaderboardRules.lifetime")
              }}</span>
            </div>
            <div class="mt-2 text-content-muted">{{ tr(`LeaderboardRules.${category.key}`) }}</div>
          </div>
        </div>
      </div>
      <div class="mt-3 rounded-xl border-l-4 border-palette-94ac83 bg-surface px-4 py-3 text-xs text-content-muted">
        {{ tr("LeaderboardRules.lifetime_ties") }}
      </div>
    </section>

    <section :aria-label="tr('LeaderboardSeason.title')">
      <div class="mb-3 text-lg font-bold">{{ tr("LeaderboardSeason.title") }}</div>
      <div class="grid gap-3 lg:grid-cols-3">
        <div
          v-for="(key, index) in ['season', 'hall', 'next_season']"
          :key="key"
          class="rounded-2xl border border-border-default p-4 sm:p-5"
        >
          <div class="mb-3 flex items-center gap-3 font-bold">
            <span aria-hidden="true" class="text-xl">{{ ["📅", "🏅", "✨"][index] }}</span>
            {{ tr(`LeaderboardRules.${key}_title`) }}
          </div>
          <div class="text-content-muted">{{ tr(`LeaderboardRules.${key}`) }}</div>
        </div>
      </div>
    </section>

    <LeaderboardRewards />
  </div>
</template>
