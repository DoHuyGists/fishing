<template>
  <Modal>
    <div class="flex h-full w-full flex-col lg:flex-row">
      <div
        class="h-1/2 min-h-0 w-full border-b border-emerald-300/20 p-3 sm:p-5 lg:h-full lg:w-1/2 lg:border-b-0 lg:border-r"
      >
        <ListItems />
      </div>
      <div
        class="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-4 sm:p-8 lg:w-1/2"
      >
        <SpinWheel
          :rewards="eligibleRewards"
          :fetch-reward-index="fetchRewardIndex"
          :disabled="!canSpin"
          @spin-end="onWin"
          :size="wheelSize"
        />
        <p class="text-center text-sm text-emerald-100/80">
          {{
            canSpin
              ? `${eligibleRewards.length} phần thưởng trong vòng quay`
              : `Chọn thêm ${4 - eligibleRewards.length} phần thưởng nữa để quay`
          }}
        </p>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useSpinWheelStore } from "../../stores/spinWheel.ts";
import ListItems from "./ListItems.vue";
import SpinWheel from "./SpinWheel.vue";
import type { Reward } from "./SpinWheel.vue";
import Modal from "../Modal.vue";

const spinWheelStore = useSpinWheelStore();
const viewportWidth = ref(window.innerWidth);
const eligibleRewards = computed(() => spinWheelStore.selectedReward);
const canSpin = computed(() => eligibleRewards.value.length >= 4);
const wheelSize = computed(() => (viewportWidth.value < 640 ? 260 : viewportWidth.value < 1024 ? 340 : 420));

function updateViewportWidth() {
  viewportWidth.value = window.innerWidth;
}

onMounted(() => window.addEventListener("resize", updateViewportWidth));
onBeforeUnmount(() => window.removeEventListener("resize", updateViewportWidth));

// item_id returned by the RPC is matched back to its segment in eligibleRewards.
async function fetchRewardIndex(): Promise<number> {
  const itemIds = eligibleRewards.value.map((reward) => String(reward.id));
  const itemId = await spinWheelStore.claimRandomItem(itemIds);
  const index = eligibleRewards.value.findIndex((reward) => String(reward.id) === itemId);
  if (index === -1) {
    throw new Error("Không tìm thấy phần thưởng tương ứng với item_id trả về.");
  }
  return index;
}

function onWin(reward: Reward) {
  console.log("Nhận thưởng:", reward);
}
</script>
