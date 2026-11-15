<script setup lang="ts">
import { computed } from 'vue';
import { getFormattingLocale, t as tr } from '../../../i18n';
import { useAuthStore } from '../../../stores/auth';
import { useLeaderboardStore } from '../../../stores/leaderboard';
import Pagination from '../../shared/Pagination.vue';
import LeaderboardFish from './LeaderboardFish.vue';
import LeaderboardPodium from './LeaderboardPodium.vue';

const store = useLeaderboardStore();
const auth = useAuthStore();
const board = computed(() => store.boards[0]!);
const formatter = computed(() => new Intl.NumberFormat(getFormattingLocale(), { maximumFractionDigits: store.criterion === 'best_fish' ? 6 : 2 }));
</script>

<template>
  <section class="space-y-3" :aria-label="board.label" :aria-busy="board.loading">
    <slot name="controls" />

    <div v-if="board.error" role="alert" class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ board.error }} {{ tr('LeaderboardModal.hay_thu_lam_moi_bang_xep_hang') }}
    </div>

    <div v-if="board.loading" role="status" class="rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] px-4 py-10 text-center text-sm text-[#52654f]">
      {{ tr('LeaderboardModal.dang_tai_bang_xep_hang') }}
    </div>

    <template v-else>
      <LeaderboardPodium v-if="board.leaders.length" :entries="board.leaders" :user-id="auth.userId" :unit="board.unit" :formatter="formatter" :fish-cards="board.key === 'best_fish'" />

      <aside class="slide-fade-in from-bottom player-content-in rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] px-3 py-2" :aria-label="tr('LeaderboardModal.thu_hang_ca_nhan')">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div class="min-w-0 flex-1">
            <div class="text-xs font-semibold text-[#52654f]">{{ tr('LeaderboardModal.thu_hang_cua_ban') }}</div>
            <div v-if="board.myEntry && board.myRank !== null" class="mt-0.5 truncate text-xs font-bold">{{ board.myEntry.display_name || tr('LeaderboardModal.an_danh') }}</div>
            <div v-else class="mt-1 text-xs leading-relaxed text-[#52654f]">
              {{ board.error ? tr('LeaderboardModal.chua_the_tai_thu_hang_ca_nhan_vui_long_thu_lam_moi') : auth.userId ? tr('LeaderboardModal.ban_chua_co_thu_hang_o_tieu_chi_nay_tiep_tuc_cau_ca_de_ghi_dau_t') : tr('LeaderboardModal.dang_nhap_de_xem_thu_hang_cua_ban') }}
            </div>
          </div>
          <template v-if="board.myEntry && board.myRank !== null">
            <span class="text-xl font-black tabular-nums text-emerald-800">#{{ board.myRank }}</span>
            <div class="text-right">
              <div class="break-words text-sm font-extrabold tabular-nums">{{ formatter.format(board.myValue) }}</div>
              <div class="text-[10px] text-[#52654f]">{{ board.unit }}</div>
            </div>
          </template>
        </div>
        <LeaderboardFish v-if="board.key === 'best_fish' && board.myEntry?.best_fish" :fish="board.myEntry.best_fish" compact class="mt-2 border-t border-[#cbd9c6] pt-1.5" />
      </aside>

      <div v-if="board.remaining.length" class="overflow-hidden rounded-xl border border-[#cbd9c6] bg-white">
        <div class="flex items-center justify-between gap-2 border-b border-[#cbd9c6] bg-[#f5f9f0] px-3 py-2 text-xs font-semibold text-[#52654f]">
          <span>{{ tr('LeaderboardModal.can_thu') }}</span>
          <span class="text-right">{{ board.metric }}</span>
        </div>
        <div class="divide-y divide-[#cbd9c6]/50">
          <div v-for="entry in board.remaining" :key="entry.id" class="flex items-center gap-2 px-3 py-2" :class="entry.userId === auth.userId ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-600/30' : ''">
            <span class="w-7 shrink-0 text-center text-sm font-extrabold tabular-nums text-[#52654f]">#{{ entry.rank }}</span>
            <div class="hidden size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e7ecda] text-[10px] font-bold text-emerald-800 sm:flex">
              <img v-if="entry.avatarUrl" :src="entry.avatarUrl" alt="" class="size-full object-cover" referrerpolicy="no-referrer" loading="lazy" />
              <span v-else aria-hidden="true">{{ entry.displayName.slice(0, 2).toUpperCase() }}</span>
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="truncate text-xs font-semibold" :title="entry.displayName">{{ entry.displayName }}</span>
                <span v-if="entry.userId === auth.userId" class="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">{{ tr('LeaderboardModal.ban_2') }}</span>
              </div>
              <LeaderboardFish v-if="entry.bestFish" :fish="entry.bestFish" compact class="mt-1" />
            </div>
            <div class="max-w-[42%] text-right">
              <div class="break-words text-xs font-extrabold tabular-nums sm:text-sm">{{ formatter.format(entry.value) }}</div>
              <div class="text-[10px] text-[#52654f]">{{ board.unit }}</div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="!board.entries.length && !board.error" class="rounded-2xl border border-dashed border-[#cbd9c6] bg-[#f5f9f0] px-4 py-12 text-center">
        <span class="text-4xl" aria-hidden="true">🎣</span>
        <div class="mt-4 font-bold">{{ tr('LeaderboardModal.chua_co_du_lieu_xep_hang') }}</div>
        <div class="mt-2 text-sm text-[#52654f]">{{ tr('LeaderboardModal.cac_can_thu_se_xuat_hien_khi_co_thanh_tich_duoc_ghi_nhan') }}</div>
      </div>
    </template>

    <Pagination :page="store.page" :page-size="store.pageSize" :total="store.total" :loading="store.loading" @change="store.fetchLeaderboard(auth.userId, $event)" />
  </section>
</template>
