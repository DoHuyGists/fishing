<script setup lang="ts">
import { onMounted } from "vue";
import Modal from "../../shared/Modal.vue";
import { useLeaderboardStore } from "../../../stores/leaderboard.ts";
import { useAuthStore } from "../../../stores/auth.ts";

const leaderboardStore = useLeaderboardStore();
const authStore = useAuthStore();

function load() {
  leaderboardStore.fetchLeaderboard(authStore.userId);
}

function rankLabel(index: number) {
  return ["🥇", "🥈", "🥉"][index] ?? String(index + 1);
}

onMounted(load);
</script>

<template>
  <Modal title="Bảng xếp hạng" sub-title="Leaderboard" :on-refresh="load">
    <div class="mx-auto flex max-w-2xl flex-col gap-2 text-[#24352a]">
      <p v-if="leaderboardStore.error" class="m-0 text-sm text-red-600">{{ leaderboardStore.error }}</p>
      <p v-else-if="leaderboardStore.loading && !leaderboardStore.entries.length" class="m-0 text-sm">Đang tải...</p>
      <p v-else-if="!leaderboardStore.entries.length" class="m-0 text-sm">Chưa có dữ liệu xếp hạng.</p>

      <div
        v-if="leaderboardStore.myEntry"
        class="rounded-md border border-[#cbd9c6] bg-[#f5f9f0] p-3 text-sm font-bold"
      >
        Hạng của bạn: #{{ leaderboardStore.myRank }} · {{ leaderboardStore.myEntry.score.toLocaleString() }} điểm
      </div>

      <ol class="m-0 flex list-none flex-col gap-2 p-0">
        <li
          v-for="(entry, index) in leaderboardStore.entries"
          :key="entry.id"
          class="flex items-center gap-3 rounded-md border border-[#cbd9c6] bg-[#f5f9f0] p-3"
          :class="{ 'ring-2 ring-emerald-600': entry.user_id === authStore.userId }"
        >
          <span class="w-8 shrink-0 text-center text-lg font-extrabold">{{ rankLabel(index) }}</span>
          <span class="min-w-0 flex-1 truncate font-semibold">{{ entry.display_name || "Ẩn danh" }}</span>
          <span class="shrink-0 font-bold">{{ entry.score.toLocaleString() }}</span>
        </li>
      </ol>
    </div>
  </Modal>
</template>
