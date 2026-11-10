<template>
  <Modal title="Gacha">
    <div class="flex w-full flex-col lg:flex-row">
      <div
        class="h-75 overflow-y-scroll min-h-0 w-full border-b border-emerald-300/20 p-2 sm:p-2 lg:h-full lg:w-1/2 lg:border-b-0 lg:border-r"
      >
        <ListItems />
      </div>
      <div
        class="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-4 sm:p-8 lg:w-1/2"
      >
        <SpinWheel
          :rewards="eligibleRewards"
          :fetch-reward-index="fetchRewardIndex"
          :spin-confirmation="{ currentBalance: currencyStore.tickets, totalCost: 1 }"
          :disabled="!canSpin"
          :size="wheelSize"
        />
        <div class="text-center text-sm">
          <div v-if="spinWheelStore.season" class="font-semibold">{{ spinWheelStore.season.name }}</div>
          <span v-if="spinWheelStore.loading">Đang tải mùa quay...</span>
          <span v-else-if="spinWheelStore.error" role="alert">{{ spinWheelStore.error }}</span>
          <span v-else-if="!spinWheelStore.season">Chưa có mùa quay đang diễn ra.</span>
          <span v-else-if="!eligibleRewards.length">Mùa quay chưa có phần thưởng.</span>
          <span v-else>{{ eligibleRewards.length }} vật phẩm trong vòng quay</span>
        </div>
        <div class="flex items-center gap-2 text-xs">
          <span>Chi phí mỗi lượt quay:</span>
          <Tickets :amount="1" />
        </div>
        <div v-if="currencyStore.tickets < 1" class="text-sm text-amber-800">Bạn cần ít nhất 1 vé để quay.</div>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useSpinWheelStore } from "../../../stores/spinWheel.ts";
import { useCurrencyStore } from "../../../stores/currency.ts";
import ListItems from "./ListItems.vue";
import SpinWheel from "./SpinWheel.vue";
import Modal from "../../shared/Modal.vue";
import Tickets from "../currency/Tickets.vue";

const spinWheelStore = useSpinWheelStore();
const currencyStore = useCurrencyStore();
const viewportWidth = ref(window.innerWidth);
const eligibleRewards = computed(() => spinWheelStore.rewardList);
const canSpin = computed(() => !spinWheelStore.loading && !spinWheelStore.error && !!spinWheelStore.season && eligibleRewards.value.length > 0 && currencyStore.tickets >= 1);
const wheelSize = computed(() => (viewportWidth.value < 640 ? 200 : viewportWidth.value < 1024 ? 340 : 480));

function updateViewportWidth() {
  viewportWidth.value = window.innerWidth;
}

onMounted(() => window.addEventListener("resize", updateViewportWidth));
onBeforeUnmount(() => window.removeEventListener("resize", updateViewportWidth));

// item_id returned by the RPC is matched back to its segment in eligibleRewards.
async function fetchRewardIndex(): Promise<number> {
  const itemId = await spinWheelStore.claimRandomItem();
  const index = eligibleRewards.value.findIndex((reward) => String(reward.id) === itemId);
  if (index === -1) {
    throw new Error("Không tìm thấy vật phẩm tương ứng với item_id trả về.");
  }
  return index;
}

</script>
