<script setup lang="ts">
import { watch } from "vue";
import Modal from "../../shared/Modal.vue";
import Tab from "../../shared/Tab.vue";
import { useLeaderboardStore } from "../../../stores/leaderboard.ts";
import { useAuthStore } from "../../../stores/auth.ts";

const leaderboardStore = useLeaderboardStore();
const authStore = useAuthStore();
const numberFormatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

function load() {
  return leaderboardStore.fetchLeaderboard(authStore.userId);
}

function rankLabel(rank: number) {
  return ["🥇", "🥈", "🥉"][rank - 1] ?? `#${rank}`;
}

watch(() => authStore.userId, load, { immediate: true });
</script>

<template>
  <Modal title="Bảng xếp hạng" sub-title="Những cần thủ hàng đầu" :on-refresh="load">
    <div class="mx-auto max-w-5xl text-[#24352a]">
      <Tab v-model="leaderboardStore.activeTab" :tabs="leaderboardStore.categories" aria-label="Tiêu chí xếp hạng" lazy>
        <template #label="{ tab }">
          <span aria-hidden="true">{{ leaderboardStore.categories.find((category) => category.key === tab.key)?.emoji }}</span>
          {{ tab.label }}
        </template>

        <template v-for="board in leaderboardStore.boards" :key="board.key" #[board.key]>
          <section class="space-y-4" :aria-label="board.label" :aria-busy="board.loading">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div class="m-0 text-xl font-extrabold">{{ board.label }}</div>
                <div class="mb-0 mt-1 text-sm text-[#52654f]">{{ board.description }}</div>
              </div>
              <span class="rounded-full border border-[#cbd9c6] bg-[#f5f9f0] px-3 py-1 text-xs font-semibold">
                {{ board.isMock ? "Dữ liệu mẫu" : "Dữ liệu thực tế" }}
              </span>
            </div>

            <div v-if="board.isMock" class="m-0 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Bảng này đang dùng dữ liệu mẫu để minh họa. Thứ hạng chưa phản ánh thành tích thực tế của người chơi.
            </div>
            <div v-if="board.error" role="alert" class="m-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {{ board.error }}. Hãy thử làm mới bảng xếp hạng.
            </div>
            <div v-if="board.loading" role="status" class="m-0 text-sm text-[#52654f]">
              {{ board.entries.length ? "Đang cập nhật bảng xếp hạng…" : "Đang tải bảng xếp hạng…" }}
            </div>

            <div class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
              <div class="min-w-0 space-y-4">
                <template v-if="board.entries.length">
                  <div aria-label="Ba vị trí dẫn đầu" class="m-0 grid list-none grid-cols-3 gap-2 p-0 sm:gap-3">
                    <div
                      v-for="entry in board.leaders"
                      :key="entry.id"
                      class="min-w-0 rounded-2xl border p-2 text-center sm:p-4"
                      :class="[
                        entry.rank === 1 ? 'border-amber-300 bg-amber-50' : 'border-[#cbd9c6] bg-[#f5f9f0]',
                        entry.userId && entry.userId === authStore.userId ? 'ring-2 ring-inset ring-emerald-600' : '',
                      ]"
                    >
                      <span class="text-3xl" :aria-label="`Hạng ${entry.rank}`" role="img">{{ rankLabel(entry.rank) }}</span>
                      <img v-if="entry.avatarUrl" :src="entry.avatarUrl" alt="Ảnh đại diện" class="mx-auto mt-2 h-10 w-10 rounded-full object-cover" referrerpolicy="no-referrer" />
                      <div class="mb-1 mt-3 truncate text-xs font-bold sm:text-sm" :title="entry.displayName">{{ entry.displayName }}</div>
                      <span v-if="entry.userId && entry.userId === authStore.userId" class="text-xs font-semibold text-emerald-700">Bạn · </span>
                      <div class="m-0 break-words text-base font-extrabold tabular-nums sm:text-xl">{{ numberFormatter.format(entry.value) }}</div>
                      <div class="mb-0 mt-1 text-xs text-[#52654f]">{{ board.unit }}</div>
                    </div>
                  </div>

                  <div class="overflow-hidden rounded-2xl border border-[#cbd9c6]">
                    <div class="flex items-center justify-between gap-3 bg-[#f5f9f0] px-3 py-3 text-xs font-bold sm:px-4">
                      <span>Top {{ board.entries.length }} cần thủ</span>
                      <span class="text-right">{{ board.metric }}</span>
                    </div>
                    <div v-if="board.remaining.length" start="4" class="m-0 list-none divide-y divide-[#cbd9c6]/60 p-0">
                      <div
                        v-for="entry in board.remaining"
                        :key="entry.id"
                        class="flex items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4"
                        :class="entry.userId && entry.userId === authStore.userId ? 'bg-emerald-50 ring-2 ring-inset ring-emerald-600' : 'bg-white'"
                      >
                        <span class="w-8 shrink-0 text-center text-sm font-bold text-[#52654f]">#{{ entry.rank }}</span>
                        <img v-if="entry.avatarUrl" :src="entry.avatarUrl" alt="" class="h-8 w-8 rounded-full object-cover" referrerpolicy="no-referrer" />
                        <span class="min-w-0 flex-1 truncate text-sm font-semibold" :title="entry.displayName">{{ entry.displayName }}</span>
                        <span v-if="entry.userId && entry.userId === authStore.userId" class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">Bạn</span>
                        <span class="shrink-0 text-right text-sm font-bold tabular-nums">
                          {{ numberFormatter.format(entry.value) }} <span class="text-xs font-normal text-[#52654f]">{{ board.unit }}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </template>
                <div v-else-if="!board.loading && !board.error" class="rounded-2xl border border-dashed border-[#cbd9c6] bg-[#f5f9f0] px-4 py-10 text-center">
                  <span class="text-3xl" aria-hidden="true">🎣</span>
                  <div class="mb-1 mt-3 font-bold">Chưa có dữ liệu xếp hạng</div>
                  <div class="m-0 text-sm text-[#52654f]">Các cần thủ sẽ xuất hiện khi có thành tích được ghi nhận.</div>
                </div>
              </div>

              <aside class="order-first rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] p-4 lg:order-last" aria-label="Thứ hạng cá nhân">
                <div class="m-0 text-sm font-bold">Thứ hạng của bạn</div>
                <div v-if="board.isMock" class="mb-0 mt-2 text-sm leading-relaxed text-[#52654f]">
                  Thứ hạng cá nhân sẽ hiển thị khi tiêu chí này có dữ liệu thực tế.
                </div>
                <div v-else-if="board.loading" class="mb-0 mt-2 text-sm text-[#52654f]">Đang tải thứ hạng…</div>
                <template v-else-if="board.myEntry && board.myRank !== null">
                  <div class="mt-3 flex flex-wrap items-end justify-between gap-2">
                    <span class="text-3xl font-extrabold text-emerald-800">#{{ board.myRank }}</span>
                    <span class="text-sm font-bold tabular-nums">{{ numberFormatter.format(board.myEntry.score) }} {{ board.unit }}</span>
                  </div>
                  <div class="mb-0 mt-3 truncate text-sm text-[#52654f]">{{ board.myEntry.display_name || "Ẩn danh" }}</div>
                </template>
                <div v-else class="mb-0 mt-2 text-sm leading-relaxed text-[#52654f]">
                  {{ board.error ? "Chưa thể tải thứ hạng cá nhân. Vui lòng thử làm mới." : authStore.userId ? "Bạn chưa có thứ hạng ở tiêu chí này. Tiếp tục câu cá để ghi dấu thành tích!" : "Đăng nhập để xem thứ hạng của bạn." }}
                </div>
              </aside>
            </div>
          </section>
        </template>
      </Tab>
    </div>
  </Modal>
</template>
