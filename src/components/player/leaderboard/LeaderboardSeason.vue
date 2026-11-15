<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue';
import { getFormattingLocale, t as tr } from '../../../i18n';
import { useLeaderboardStore } from '../../../stores/leaderboard';
import { useAuthStore } from '../../../stores/auth';
import LeaderboardFish from './LeaderboardFish.vue';
import PlayerIdentity from '../../shared/PlayerIdentity.vue';

const store = useLeaderboardStore();
const auth = useAuthStore();
const board = computed(() => store.seasonBoard);
const numberFormatter = computed(() => new Intl.NumberFormat(getFormattingLocale(), { maximumFractionDigits: 6 }));
const dateFormatter = computed(() => new Intl.DateTimeFormat(getFormattingLocale(), { dateStyle: 'medium', timeStyle: 'short' }));
function formatDate(value: string) { return dateFormatter.value.format(new Date(value)); }
function selectSeason(id: string | null) { void store.selectSeason(id, auth.user?.id); }

let rolloverTimer: ReturnType<typeof setTimeout> | undefined;
watch(() => store.seasonBoard, (value) => {
  clearTimeout(rolloverTimer);
  if (!value?.season || store.selectedSeasonId !== null) return;
  const delay = new Date(value.season.ends_at).getTime() - new Date(value.server_time).getTime();
  if (delay > 0) rolloverTimer = setTimeout(() => {
    void store.fetchLeaderboard(auth.user?.id, 1);
  }, Math.min(delay + 100, 2_147_483_647));
}, { immediate: true });
onBeforeUnmount(() => { clearTimeout(rolloverTimer); });
</script>

<template>
  <div class="space-y-3 rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] p-4 text-[#24352a]">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="font-bold">{{ board?.season ? tr('LeaderboardSeason.season', { number: board.season.season_number }) : tr('LeaderboardSeason.title') }}</div>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-1 text-xs disabled:opacity-40" :disabled="store.loading || !board?.previous_season_id" @click="selectSeason(board?.previous_season_id ?? null)">{{ tr('LeaderboardSeason.previous') }}</button>
        <button v-if="store.selectedSeasonId !== null" type="button" class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-1 text-xs disabled:opacity-40" :disabled="store.loading || !board?.next_season_id" @click="selectSeason(board?.next_season_id ?? null)">{{ tr('LeaderboardSeason.next') }}</button>
        <button v-if="store.selectedSeasonId !== null" type="button" class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-1 text-xs disabled:opacity-40" :disabled="store.loading" @click="selectSeason(null)">{{ tr('LeaderboardSeason.current') }}</button>
      </div>
    </div>
    <template v-if="board?.season">
      <div class="text-xs text-[#52654f]">{{ formatDate(board.season.starts_at) }} → {{ formatDate(board.season.ends_at) }}</div>
      <div class="text-xs text-[#52654f]">{{ tr('LeaderboardSeason.rules') }}</div>
      <div v-if="board.meta.length" class="flex flex-wrap gap-2">
        <div v-for="species in board.meta" :key="species.species_id" class="rounded-lg border px-2 py-1 text-xs" :class="species.season_weight < 1 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'">
          {{ species.name }} · ×{{ numberFormatter.format(species.season_weight) }}
        </div>
      </div>
      <template v-if="board.season.finalized_at">
        <div class="font-bold">{{ tr('LeaderboardSeason.hall') }}</div>
        <div v-if="!board.hall_of_fame.length" class="text-xs text-[#52654f]">{{ tr('LeaderboardSeason.no_winners') }}</div>
        <div v-else class="grid gap-3 sm:grid-cols-3">
          <div v-for="winner in board.hall_of_fame" :key="winner.rank" class="slide-fade-in from-bottom player-content-in min-w-0 rounded-xl border border-[#cbd9c6] bg-white p-3">
            <div class="mb-2 text-xl">{{ ['🥇', '🥈', '🥉'][winner.rank - 1] }}</div>
            <PlayerIdentity :user-id="winner.user_id" :profile="{ display_name: winner.display_name, avatar_url: null, country_id: null }" />
            <LeaderboardFish :fish="winner.fish" class="mt-2" />
            <div class="mt-1 font-bold tabular-nums">{{ numberFormatter.format(winner.fish.score) }} {{ tr('DailyMission.diem') }}</div>
            <div class="mt-1 text-[10px] text-[#52654f]">{{ formatDate(winner.caught_at) }}</div>
          </div>
        </div>
      </template>
    </template>
    <div v-else-if="!store.loading && !store.error" class="text-sm text-[#52654f]">{{ tr('LeaderboardSeason.not_started') }}</div>
  </div>
</template>
