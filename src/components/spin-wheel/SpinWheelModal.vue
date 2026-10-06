<template>
  <Modal title="Gacha">
    <div class="flex w-full flex-col lg:flex-row">
      <div
        class="h-75 overflow-y-scroll min-h-0 w-full border-b border-emerald-300/20 p-3 sm:p-5 lg:h-full lg:w-1/2 lg:border-b-0 lg:border-r"
      >
        <ListItems />
      </div>
      <div
        class="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-4 sm:p-8 lg:w-1/2"
      >
        <SpinWheel
          :rewards="eligibleRewards"
          :fetch-reward-index="fetchRewardIndex"
          :spin-confirmation="{ currentBalance: currencyStore.cash, totalCost: spinFee }"
          :disabled="!canSpin"
          @spin-end="onWin"
          :size="wheelSize"
        />
        <div class="text-center text-sm">
          {{
            canSpin
              ? `${eligibleRewards.length} vật phẩm trong vòng quay`
              : `Chọn thêm ${4 - eligibleRewards.length} vật phẩm nữa để quay`
          }}
        </div>
        <div v-if="canSpin" class="flex items-center gap-2 text-xs">
          <span>Chi phí lượt quay này: </span>
          <Cash :amount="spinFee" />
        </div>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useSpinWheelStore } from "../../stores/spinWheel.ts";
import { useCurrencyStore } from "../../stores/currency.ts";
import ListItems from "./ListItems.vue";
import SpinWheel from "./SpinWheel.vue";
import type { Reward } from "./SpinWheel.vue";
import Modal from "../Modal.vue";
import Cash from "../currency/Cash.vue";

const spinWheelStore = useSpinWheelStore();
const currencyStore = useCurrencyStore();
const viewportWidth = ref(window.innerWidth);
const eligibleRewards = computed(() => spinWheelStore.selectedReward);
const canSpin = computed(() => eligibleRewards.value.length >= 4);
const wheelSize = computed(() => (viewportWidth.value < 640 ? 200 : viewportWidth.value < 1024 ? 340 : 480));
const SPIN_BASE_COST = 1000;
const spinFee = computed(() => {
  return (spinWheelStore.rewardList.length + 1) * SPIN_BASE_COST - eligibleRewards.value.length * SPIN_BASE_COST;
});

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
    throw new Error("Không tìm thấy vật phẩm tương ứng với item_id trả về.");
  }
  return index;
}

function onWin(reward: Reward) {
  console.log("Nhận thưởng:", reward);
}
</script>
