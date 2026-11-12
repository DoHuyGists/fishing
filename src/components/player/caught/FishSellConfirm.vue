<script setup lang="ts">
import { t as tr } from "../../../i18n";

import { computed, ref, watch } from "vue";
import PaymentConfirmation from "../../shared/PaymentConfirmation.vue";
import { useCurrencyStore } from "../../../stores/currency.ts";

const props = defineProps<{ fish: any; isLoading?: boolean; error?: string }>();
const emit = defineEmits<{ cancel: []; confirm: [price: number] }>();
const currencyStore = useCurrencyStore();
const price = ref<number | "">("");
const listedPrice = 500;
const balanceFee = computed(() => {
  const amount = Number(price.value);
  return amount >= 1000 ? Math.floor(amount * Math.floor(amount / 1000) * 0.01) : 0;
});
watch(
  () => props.fish,
  () => {
    price.value = "";
  },
);
function confirm() {
  if (!props.isLoading && Number.isSafeInteger(Number(price.value)) && Number(price.value) > 0 && currencyStore.cash >= listedPrice + balanceFee.value) emit("confirm", Number(price.value));
}
</script>

<template>
  <PaymentConfirmation
    v-if="fish"
    :title="tr('FishSellConfirm.dang_ban_ca')"
    :balance="currencyStore.cash"
    :total="listedPrice + balanceFee"
    :total-label="tr('FishSellConfirm.tong_phi')"
    :costs="[
      { label: tr('FishSellConfirm.phi_niem_yet_thi_truong'), amount: listedPrice },
      { label: tr('FishSellConfirm.phi_can_bang_thi_truong'), amount: balanceFee },
    ]"
    :confirm-text="tr('CaughtModal.dang_ban')"
    :busy="isLoading"
    :disabled="!Number.isSafeInteger(Number(price)) || Number(price) <= 0"
    :error="error || (price !== '' && Number(price) <= 0 ? tr('FishSellConfirm.gia_ban_phai_lon_hon_0') : '')"
    @cancel="emit('cancel')"
    @confirm="confirm"
  >
    <div class="text-sm text-emerald-900/70">
      {{ tr('CaughtModal.dang_ban') }} <strong>{{ fish.species?.name }}</strong> {{ tr('FishSellConfirm.len_thi_truong') }}
    </div>
    <input
      v-model.number="price"
      type="number"
      min="1"
      step="1"
      required
      :aria-label="tr('FishSellConfirm.nhap_gia_ban')"
      :placeholder="tr('FishSellConfirm.nhap_gia_ban')"
      class="w-full rounded-lg border border-[#cbd9c6] px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-emerald-700"
      @keydown="(e: KeyboardEvent) => { if (['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault(); }"
    />
  </PaymentConfirmation>
</template>
