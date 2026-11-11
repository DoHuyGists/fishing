<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useAttendanceStore } from "../../../stores/attendance";

type Reward = { name: string; icon: string; amount?: number };

const props = defineProps<{
  reward: Reward | null;
  nextClaimAt: Date | null;
  isClaiming: boolean;
}>();
const emit = defineEmits<{ claim: [] }>();
const attendanceStore = useAttendanceStore();
onMounted(() => { void attendanceStore.fetchPossibleRewards(); });

const now = ref(Date.now());
const timer = setInterval(() => { now.value = Date.now(); }, 1000);
onUnmounted(() => clearInterval(timer));

const remainingSeconds = computed(() => props.nextClaimAt
  ? Math.max(0, Math.ceil((props.nextClaimAt.getTime() - now.value) / 1000))
  : 0);
const canClaim = computed(() => !props.nextClaimAt || remainingSeconds.value === 0);
const waitTime = computed(() => {
  const hours = Math.floor(remainingSeconds.value / 3600);
  const minutes = Math.floor((remainingSeconds.value % 3600) / 60);
  const seconds = remainingSeconds.value % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
});
</script>

<template>
  <section class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] p-4 sm:p-5">
      <div>
        <div class="m-0 text-lg font-extrabold text-[#24352a]">Quà điểm danh ngày</div>
        <div class="mb-0 mt-1 text-sm text-emerald-900/65">Mỗi ngày chỉ nhận một phần thưởng ngẫu nhiên trong danh sách.</div>
        <div class="mb-0 mt-1 text-sm text-emerald-900/65">Sau khi nhận cần chờ 24h để nhận tiếp.</div>

        <div v-if="!canClaim" class="mb-0 mt-2 text-sm font-bold text-emerald-800" role="timer" aria-live="off">Thời gian chờ: {{ waitTime }}</div>
      </div>
      <button type="button" class="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-800 disabled:cursor-default disabled:bg-emerald-900/40" :disabled="!canClaim || isClaiming" @click="emit('claim')">
        {{ isClaiming ? "Đang xử lý..." : canClaim ? "Nhận thưởng" : "Chưa đến giờ nhận thưởng" }}
      </button>
    </div>
    <section class="space-y-3" aria-labelledby="daily-reward-preview-title" :aria-busy="attendanceStore.loadingRewards">
      <div id="daily-reward-preview-title" class="m-0 text-base font-extrabold text-[#24352a]">Các phần quà có thể nhận</div>
      <div v-if="attendanceStore.loadingRewards" class="m-0 rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] p-5 text-center text-sm text-[#24352a]" role="status">Đang tải phần quà...</div>
      <div v-else-if="attendanceStore.rewardsError" class="rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] p-4 text-sm text-[#24352a]" role="alert">
        <div class="m-0">{{ attendanceStore.rewardsError }}</div>
        <button type="button" class="mt-2 rounded-lg px-3 py-2 font-bold text-emerald-800 hover:bg-emerald-100" @click="attendanceStore.fetchPossibleRewards()">Thử lại</button>
      </div>
      <div v-else-if="!attendanceStore.possibleRewards.length" class="m-0 rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] p-5 text-center text-sm text-[#24352a]">Hiện chưa có phần quà để xem trước.</div>
      <div v-else class="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4">
        <div v-for="item in attendanceStore.possibleRewards" :key="item.id" class="flex flex-col items-center gap-3 rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] p-4 text-center">
          <div class="flex h-16 w-16 items-center justify-center rounded-xl bg-white/80">
            <img v-if="item.image" :src="item.image" alt="" loading="lazy" class="h-12 w-12 object-contain" />
            <span v-else class="text-4xl" aria-hidden="true">{{ item.icon || "🎁" }}</span>
          </div>
          <div class="m-0 break-words text-sm font-bold text-[#24352a]">{{ item.name }}</div>
        </div>
      </div>
    </section>
    <div v-if="reward" class="flex items-center gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-4" role="status">
      <span class="text-4xl" aria-hidden="true">{{ reward.icon }}</span>
      <div>
        <div class="m-0 text-xs font-bold uppercase tracking-wide text-amber-800">Bạn nhận được</div>
        <div class="mb-0 mt-1 font-extrabold text-[#24352a]">{{ reward.name }}<span v-if="reward.amount"> ×{{ reward.amount }}</span></div>
      </div>
    </div>
  </section>
</template>
