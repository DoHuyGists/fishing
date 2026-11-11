<template>
  <Modal title="Gacha" :on-refresh="refreshRewards">
    <div class="flex w-full flex-col lg:flex-row">
      <div
        class="h-75 overflow-y-scroll min-h-0 w-full border-b border-emerald-300/20 p-2 sm:p-2 lg:h-full lg:w-1/2 lg:border-b-0 lg:border-r"
      >
        <ListItems />
      </div>
      <div
        class="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-4 overflow-y-auto lg:w-1/2"
      >
        <SpinWheel
          :rewards="eligibleRewards"
          :fetch-reward-index="fetchRewardIndex"
          :spin-confirmation="{ currentBalance: currencyStore.tickets, totalCost: 1 }"
          :disabled="!canSpin"
          :size="wheelSize"
          @spin-start="isSpinning = true"
          @spin-end="isSpinning = false"
          @error="isSpinning = false"
        />
        <div class="text-center text-sm">
          <div v-if="spinWheelStore.season" class="font-semibold">{{ spinWheelStore.season.name }}</div>
          <span v-if="spinWheelStore.loading">{{ tr('SpinWheelModal.dang_tai_mua_quay') }}</span>
          <span v-else-if="spinWheelStore.error" role="alert">{{ spinWheelStore.error }}</span>
          <span v-else-if="!spinWheelStore.season">{{ tr('ListItems.chua_co_mua_quay_dang_dien_ra') }}</span>
          <span v-else-if="!eligibleRewards.length">{{ tr('SpinWheelModal.mua_quay_chua_co_phan_thuong') }}</span>
          <span v-else>{{ eligibleRewards.length }} {{ tr('SpinWheelModal.vat_pham_trong_vong_quay') }}</span>
        </div>
        <div class="flex items-center gap-2 text-xs">
          <span>{{ tr('SpinWheelModal.chi_phi_moi_luot_quay') }}</span>
          <Tickets :amount="1" />
        </div>
        <div v-if="currencyStore.tickets < 1" class="text-sm text-amber-800">{{ tr('SpinWheelModal.ban_can_it_nhat_1_ve_de_quay') }}</div>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { t as tr } from "../../../i18n";

import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useSpinWheelStore } from "../../../stores/spinWheel.ts";
import { useCurrencyStore } from "../../../stores/currency.ts";
import ListItems from "./ListItems.vue";
import SpinWheel from "./SpinWheel.vue";
import Modal from "../../shared/Modal.vue";
import Tickets from "../currency/Tickets.vue";

const spinWheelStore = useSpinWheelStore();
const currencyStore = useCurrencyStore();
const isSpinning = ref(false);
const viewportWidth = ref(window.innerWidth);
const eligibleRewards = computed(() => spinWheelStore.rewardList);
const canSpin = computed(() => !spinWheelStore.loading && !spinWheelStore.error && !!spinWheelStore.season && eligibleRewards.value.length > 0 && currencyStore.tickets >= 1);
const wheelSize = computed(() => (viewportWidth.value < 640 ? 200 : viewportWidth.value < 1024 ? 340 : 480));

function updateViewportWidth() {
  viewportWidth.value = window.innerWidth;
}

async function refreshRewards() {
  if (isSpinning.value) return;
  await Promise.all([spinWheelStore.setReward(), currencyStore.fetchCurrency()]);
}

onMounted(() => window.addEventListener("resize", updateViewportWidth));
onBeforeUnmount(() => window.removeEventListener("resize", updateViewportWidth));

// item_id returned by the RPC is matched back to its segment in eligibleRewards.
async function fetchRewardIndex(): Promise<number> {
  const itemId = await spinWheelStore.claimRandomItem();
  const index = eligibleRewards.value.findIndex((reward) => String(reward.id) === itemId);
  if (index === -1) {
    throw new Error(tr('SpinWheelModal.khong_tim_thay_vat_pham_tuong_ung_voi_item_id_tra_ve'));
  }
  return index;
}

</script>
