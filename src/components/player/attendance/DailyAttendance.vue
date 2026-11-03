<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";

type Reward = { name: string; icon: string; amount?: number };

const props = defineProps<{
  reward: Reward | null;
  nextClaimAt: Date | null;
  isClaiming: boolean;
}>();
const emit = defineEmits<{ claim: [] }>();

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
        <h3 class="m-0 text-lg font-extrabold text-[#24352a]">Quà điểm danh ngày</h3>
        <p class="mb-0 mt-1 text-sm text-emerald-900/65">Mỗi ngày chỉ nhận một phần thưởng. Phần thưởng mới được mở khi sang ngày tiếp theo.</p>
        <p v-if="!canClaim" class="mb-0 mt-2 text-sm font-bold text-emerald-800" role="timer" aria-live="off">Thời gian chờ: {{ waitTime }}</p>
      </div>
      <button type="button" class="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-800 disabled:cursor-default disabled:bg-emerald-900/40" :disabled="!canClaim || isClaiming" @click="emit('claim')">
        {{ isClaiming ? "Đang xử lý..." : canClaim ? "Nhận thưởng" : "Chưa đến giờ nhận thưởng" }}
      </button>
    </div>
    <div v-if="reward" class="flex items-center gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-4" role="status">
      <span class="text-4xl" aria-hidden="true">{{ reward.icon }}</span>
      <div>
        <p class="m-0 text-xs font-bold uppercase tracking-wide text-amber-800">Bạn nhận được</p>
        <p class="mb-0 mt-1 font-extrabold text-[#24352a]">{{ reward.name }}<span v-if="reward.amount"> ×{{ reward.amount }}</span></p>
      </div>
    </div>
  </section>
</template>
