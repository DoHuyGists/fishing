<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from "vue";
import { getFormattingLocale, t as tr } from "../../../i18n";
import { useLeaderboardStore } from "../../../stores/player-leaderboard-store.ts";
import { useAuthStore } from "../../../stores/auth";
import LeaderboardFish from "./LeaderboardFish.vue";
import PlayerIdentity from "../../shared/PlayerIdentity.vue";

defineProps<{ hallOfFame?: boolean }>();

const store = useLeaderboardStore();
const auth = useAuthStore();
const board = computed(() => store.seasonBoard);
const numberFormatter = computed(() => new Intl.NumberFormat(getFormattingLocale(), { maximumFractionDigits: 6 }));
const dateFormatter = computed(
  () => new Intl.DateTimeFormat(getFormattingLocale(), { dateStyle: "medium", timeStyle: "short" }),
);
function formatDate(value: string) {
  return dateFormatter.value.format(new Date(value));
}
function selectSeason(id: string | null) {
  void store.selectSeason(id, auth.user?.id);
}

let rolloverTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => store.seasonBoard,
  (value) => {
    clearTimeout(rolloverTimer);
    if (!value?.season || store.selectedSeasonId !== null) return;
    const delay = new Date(value.season.ends_at).getTime() - new Date(value.server_time).getTime();
    if (delay > 0)
      rolloverTimer = setTimeout(
        () => {
          void store.fetchLeaderboard(auth.user?.id, 1);
        },
        Math.min(delay + 100, 2_147_483_647),
      );
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  clearTimeout(rolloverTimer);
});
</script>

<template>
  <div
    class="space-y-2 rounded-xl border border-border-default bg-surface p-3 text-xs text-content"
    :aria-busy="store.loading"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="font-bold">
        {{
          board?.season
            ? tr("LeaderboardSeason.season", { number: board.season.season_number })
            : tr("LeaderboardSeason.title")
        }}
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-lg border border-border-default bg-white px-3 py-1 text-xs disabled:opacity-40"
          :disabled="store.loading || !board?.previous_season_id"
          @click="selectSeason(board?.previous_season_id ?? null)"
        >
          {{ tr("LeaderboardSeason.previous") }}
        </button>
        <button
          v-if="store.selectedSeasonId !== null"
          type="button"
          class="rounded-lg border border-border-default bg-white px-3 py-1 text-xs disabled:opacity-40"
          :disabled="store.loading || !board?.next_season_id"
          @click="selectSeason(board?.next_season_id ?? null)"
        >
          {{ tr("LeaderboardSeason.next") }}
        </button>
        <button
          v-if="store.selectedSeasonId !== null"
          type="button"
          class="rounded-lg border border-border-default bg-white px-3 py-1 text-xs disabled:opacity-40"
          :disabled="store.loading"
          @click="selectSeason(null)"
        >
          {{ tr("LeaderboardSeason.current") }}
        </button>
      </div>
    </div>
    <div
      v-if="hallOfFame && store.error"
      role="alert"
      class="rounded-lg border border-danger bg-surface px-3 py-2 text-danger"
    >
      {{ store.error }} {{ tr("LeaderboardModal.hay_thu_lam_moi_bang_xep_hang") }}
    </div>
    <div v-if="hallOfFame && store.loading" role="status" class="py-8 text-center text-content-muted">
      {{ tr("LeaderboardModal.dang_tai_bang_xep_hang") }}
    </div>
    <template v-if="board?.season && (!hallOfFame || (!store.loading && !store.error))">
      <div class="text-xs text-content-muted">
        {{ formatDate(board.season.starts_at) }} → {{ formatDate(board.season.ends_at) }}
      </div>
      <details v-if="!hallOfFame" class="border-t border-border-default pt-2">
        <summary
          class="cursor-pointer rounded text-xs font-semibold text-content-muted focus-visible:outline-2 focus-visible:outline-accent"
        >
          {{ tr("LeaderboardSeason.details") }}
        </summary>
        <div class="mt-3 text-xs leading-relaxed text-content-muted">{{ tr("LeaderboardSeason.rules") }}</div>
        <div v-if="board.meta.length" class="mt-3 flex flex-wrap gap-2">
          <div
            v-for="species in board.meta"
            :key="species.species_id"
            class="rounded-lg border px-2 py-1 text-xs"
            :class="species.season_weight < 1 ? 'border-gold bg-surface' : 'border-accent bg-surface'"
          >
            {{ species.name }} · ×{{ numberFormatter.format(species.season_weight) }}
          </div>
        </div>
      </details>
      <template v-if="hallOfFame && board.season.finalized_at">
        <div class="font-bold">{{ tr("LeaderboardSeason.hall") }}</div>
        <div v-if="!board.hall_of_fame.length" class="text-xs text-content-muted">
          {{ tr("LeaderboardSeason.no_winners") }}
        </div>
        <div v-else class="grid gap-2 sm:grid-cols-3">
          <div
            v-for="winner in board.hall_of_fame"
            :key="winner.rank"
            class="slide-fade-in from-bottom player-content-in min-w-0 rounded-lg border border-border-default bg-white p-2"
          >
            <div class="mb-2 text-xl">{{ ["🥇", "🥈", "🥉"][winner.rank - 1] }}</div>
            <PlayerIdentity
              :user-id="winner.user_id"
              :profile="{ display_name: winner.display_name, avatar_url: null, country_id: null }"
            />
            <LeaderboardFish :fish="winner.fish" compact class="mt-1.5" />
            <div class="mt-1 font-bold tabular-nums">
              {{ numberFormatter.format(winner.fish.score) }} {{ tr("DailyMission.diem") }}
            </div>
            <div class="mt-1 text-[10px] text-content-muted">{{ formatDate(winner.caught_at) }}</div>
          </div>
        </div>
      </template>
      <div v-else-if="hallOfFame" class="py-6 text-center text-content-muted">
        {{ tr("LeaderboardSeason.not_finalized") }}
      </div>
    </template>
    <div v-else-if="!store.loading && !store.error" class="text-sm text-content-muted">
      {{ tr("LeaderboardSeason.not_started") }}
    </div>
  </div>
</template>
