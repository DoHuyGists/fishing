<script setup lang="ts">
import { t as tr } from "../../../i18n";
import { useLeaderboardStore } from "../../../stores/player-leaderboard-store";

const store = useLeaderboardStore();
</script>

<template>
  <section class="space-y-4" :aria-label="tr('LeaderboardRules.rewards')">
    <div class="flex flex-wrap items-center gap-2">
      <span aria-hidden="true" class="text-xl">🎁</span>
      <div class="text-lg font-bold">{{ tr("LeaderboardRules.rewards") }}</div>
      <span class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">{{
        tr("LeaderboardRules.planned")
      }}</span>
    </div>
    <div class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
      {{ tr("LeaderboardRules.reward_status") }}
    </div>
    <div class="grid gap-3 text-xs text-content-muted md:grid-cols-2">
      <div>{{ tr("LeaderboardRules.reward_categories") }}</div>
      <div>{{ tr("LeaderboardRules.reward_period") }}</div>
    </div>

    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="tier in store.rewardTiers"
        :key="tier.minPlayers"
        class="overflow-hidden rounded-2xl border border-border-default bg-surface"
      >
        <div class="border-b border-border-default bg-surface-muted px-4 py-3 text-xs font-bold">
          {{
            tier.maxPlayers === null
              ? tr("LeaderboardRules.players_from", { count: tier.minPlayers })
              : tr("LeaderboardRules.players_range", { min: tier.minPlayers, max: tier.maxPlayers })
          }}
        </div>
        <div
          v-if="!tier.rewards.length"
          class="flex min-h-36 flex-col items-center justify-center gap-3 px-4 py-6 text-center text-xs text-content-muted"
        >
          <span aria-hidden="true" class="text-3xl">🌱</span>
          {{ tr("LeaderboardRules.no_rewards") }}
        </div>
        <table v-else class="w-full table-fixed text-left text-[11px] sm:text-xs">
          <caption class="sr-only">
            {{
              tr("LeaderboardRules.reward_table")
            }}
          </caption>
          <thead class="text-content-muted">
            <tr class="border-b border-border-default">
              <th scope="col" class="w-1/5 px-2 py-2">{{ tr("LeaderboardRules.rank") }}</th>
              <th scope="col" class="px-2 py-2">{{ tr("LeaderboardRules.fishing_categories") }}</th>
              <th scope="col" class="px-2 py-2">{{ tr("leaderboard.tieu_cash") }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-default/50">
            <tr
              v-for="reward in tier.rewards"
              :key="reward.fromRank"
              :class="reward.fromRank === 1 ? 'bg-amber-50 text-amber-950' : 'bg-white/70'"
            >
              <th scope="row" class="px-2 py-2 font-semibold tabular-nums">
                <span v-if="reward.fromRank === 1" aria-hidden="true">🥇 </span
                >{{
                  reward.fromRank === reward.toRank ? `#${reward.fromRank}` : `#${reward.fromRank}–${reward.toRank}`
                }}
              </th>
              <td class="px-2 py-2">{{ tr("LeaderboardRules.tickets", { count: reward.tickets }) }}</td>
              <td class="px-2 py-2">
                {{
                  Math.floor(reward.tickets / 2) > 0
                    ? tr("LeaderboardRules.tickets", { count: Math.floor(reward.tickets / 2) })
                    : tr("LeaderboardRules.no_tickets")
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="text-xs text-content-muted">{{ tr("LeaderboardRules.per_player") }}</div>
    <div class="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <span aria-hidden="true" class="text-2xl">🏅</span>
      <div>
        <div class="font-bold text-amber-950">{{ tr("LeaderboardRules.titles_heading") }}</div>
        <div class="mt-1 text-xs text-amber-900">{{ tr("LeaderboardRules.titles") }}</div>
      </div>
    </div>
    <div class="grid gap-3 md:grid-cols-2">
      <div
        v-for="[title, content] in [
          ['conditions_heading', 'eligibility'],
          ['spend_heading', 'spend_eligibility'],
          ['ties_heading', 'reward_ties'],
          ['claim_heading', 'claim'],
        ]"
        :key="title"
        class="rounded-xl border border-border-default p-4"
      >
        <div class="text-sm font-bold">{{ tr(`LeaderboardRules.${title}`) }}</div>
        <div class="mt-2 text-xs text-content-muted">{{ tr(`LeaderboardRules.${content}`) }}</div>
      </div>
    </div>
  </section>
</template>
