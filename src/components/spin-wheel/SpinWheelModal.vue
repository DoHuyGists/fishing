<template>
    <div class="fixed inset-0 z-50 flex flex-col bg-emerald-950">
        <button type="button"
            aria-label="Đóng vòng quay"
            class="absolute right-4 top-4 z-10 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-white/5 text-2xl font-bold text-white transition-colors hover:bg-white/15 sm:right-6 sm:top-6"
            @click="emit('close')">
            &times;
        </button>

        <div class="flex h-full w-full flex-col lg:flex-row">
          <div class="h-1/2 min-h-0 w-full border-b border-emerald-300/20 p-3 sm:p-5 lg:h-full lg:w-1/2 lg:border-b-0 lg:border-r">
            <ListItems/>
          </div>
          <div class="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-4 sm:p-8 lg:w-1/2">
            <SpinWheel
            :rewards="eligibleRewards"
            :fetch-reward-index="fetchRewardIndex"
            @spin-end="onWin"
            :size="wheelSize"
          />
            <p class="text-center text-sm text-emerald-100/80">
              {{ eligibleRewards.length ? `${eligibleRewards.length} phần thưởng trong vòng quay` : 'Chọn phần thưởng để bắt đầu' }}
            </p>
        </div>
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
const eligibleRewards = computed(() => spinWheelStore.selectedReward);
const wheelSize = computed(() => viewportWidth.value < 640 ? 260 : viewportWidth.value < 1024 ? 340 : 420);

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