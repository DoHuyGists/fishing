<template>
    <div class="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-3 sm:p-5">
        <div class="relative mx-auto flex min-h-[calc(100dvh-1.5rem)] w-full max-w-7xl flex-col items-center justify-center gap-6 overflow-hidden rounded-2xl border border-emerald-300/20 bg-emerald-950 px-4 py-14 shadow-2xl sm:min-h-[calc(100dvh-2.5rem)] sm:px-8 sm:py-10 lg:flex-row lg:gap-8">
          <div class="h-[42vh] min-h-70 max-h-120 w-full lg:h-[min(76vh,720px)] lg:w-[min(38vw,440px)]">
            <ListItems/>
          </div>
          <div class="flex w-full flex-col items-center gap-4 lg:w-auto">
            <SpinWheel
            :rewards="eligibleRewards"
            :fetch-reward-index="fetchRewardIndex"
            @spin-end="onWin"
            :size="wheelSize"
          />
            <p class="text-center text-sm text-emerald-100/80">
              {{ eligibleRewards.length ? `${eligibleRewards.length} phần thưởng trong vòng quay` : 'Chọn ít nhất 4 món để mở vòng quay' }}
            </p>
          </div>

          <button type="button"
            aria-label="Đóng vòng quay"
            class="absolute right-4 top-4 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-white/5 text-2xl font-bold text-white transition-colors hover:bg-white/15 sm:right-6 sm:top-6"
            @click="emit('close')">
            &times;
        </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useSpinWheelStore } from '../../stores/spinWheel.ts';
import ListItems from './ListItems.vue';
import SpinWheel from './SpinWheel.vue'
import type { Reward } from './SpinWheel.vue'

const emit = defineEmits(["close"]);
const spinWheelStore = useSpinWheelStore();
const viewportWidth = ref(window.innerWidth);
const eligibleRewards = computed(() =>
  spinWheelStore.selectedReward.length >= 4 ? spinWheelStore.selectedReward : [],
);
const wheelSize = computed(() => viewportWidth.value < 640 ? 280 : viewportWidth.value < 1024 ? 360 : 460);

function updateViewportWidth() {
  viewportWidth.value = window.innerWidth;
}

onMounted(() => window.addEventListener('resize', updateViewportWidth));
onBeforeUnmount(() => window.removeEventListener('resize', updateViewportWidth));

// item_id returned by the RPC is matched back to its segment in eligibleRewards.
async function fetchRewardIndex(): Promise<number> {
  const itemIds = eligibleRewards.value.map((reward) => String(reward.id));
  const itemId = await spinWheelStore.claimRandomItem(itemIds);
  const index = eligibleRewards.value.findIndex((reward) => String(reward.id) === itemId);
  if (index === -1) {
    throw new Error('Không tìm thấy phần thưởng tương ứng với item_id trả về.');
  }
  return index;
}

function onWin(reward: Reward) {
  console.log('Nhận thưởng:', reward);
}
</script>