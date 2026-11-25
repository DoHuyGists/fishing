<script setup lang="ts">
import type { ShopItem } from "../../../types/model/item";
import { getFormattingLocale, t as tr } from "../../../i18n";

import PaymentConfirmation from "../../shared/PaymentConfirmation.vue";
import Cash from "../player-currency/Cash.vue";

defineProps<{
  selectedItem: ShopItem | null;
  totalPrice: number;
  totalReceived: number;
  canBuy: boolean;
  cash: number;
  busy: boolean;
}>();

const quantity = defineModel<number>("quantity", { required: true });
const emit = defineEmits<{ buy: [] }>();
</script>

<template>
  <aside class="shop-order slide-fade-in from-right player-content-in h-fit min-w-0 rounded-2xl border border-border-default bg-white p-4 text-content shadow-sm lg:sticky lg:top-0">
    <PaymentConfirmation
      v-if="selectedItem"
      embedded
      :title="tr('ShopModal.don_hang')"
      :balance="cash"
      :total="totalPrice"
      :busy="busy"
      :disabled="!canBuy"
      :confirm-text="tr('ShopModal.mua_vat_pham')"
      :error="!Number.isInteger(quantity) || quantity < 1 ? tr('ShopModal.so_luong_mua_khong_hop_le') : ''"
      @confirm="emit('buy')"
    >
      <div class="flex items-center gap-3 rounded-xl border border-border-default bg-surface p-3">
        <div
          class="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-border-default bg-white text-2xl"
        >
          <img
            v-if="selectedItem.image"
            :src="selectedItem.image"
            :alt="selectedItem.name"
            class="h-full w-full object-contain"
          /><span v-else>{{ selectedItem.icon || "🎁" }}</span>
        </div>
        <div class="min-w-0">
          <div class="m-0 break-words text-sm font-bold text-content">{{ selectedItem.name }}</div>
          <div class="m-0 mt-1 text-xs text-content">{{ selectedItem.category || tr('ShopModal.vat_pham') }}</div>
        </div>
      </div>
      <label class="my-5 block text-sm font-semibold"
        >{{ tr('ShopModal.so_luot_mua') }}
        <input
          v-model.number="quantity"
          type="number"
          min="1"
          step="1"
          class="mt-2 min-h-11 w-full rounded-xl border border-border-default bg-surface px-3 py-2 text-sm text-content focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
        />
      </label>
      <template #summary>
        <div class="flex flex-wrap justify-between gap-2">
          <span>{{ tr('ShopModal.so_luong_moi_luot') }}</span><span>{{ (selectedItem.quantity ?? 1).toLocaleString(getFormattingLocale()) }}</span>
        </div>
        <div class="flex flex-wrap justify-between gap-2">
          <span>{{ tr('ShopModal.tong_so_luong_nhan') }}</span><span>{{ totalReceived.toLocaleString(getFormattingLocale()) }}</span>
        </div>
        <div class="flex flex-wrap justify-between gap-2">
          <span>{{ tr('ShopModal.don_gia') }}</span>
          <Cash :amount="selectedItem.price" :interactive="false" class="max-w-full font-semibold tabular-nums [&>span]:min-w-0 [&>span]:break-all [&>img]:shrink-0" />
        </div>
      </template>
    </PaymentConfirmation>
    <template v-else>
      <div class="text-base font-extrabold">{{ tr('ShopModal.don_hang') }}</div>
      <div class="mt-4 rounded-xl border border-dashed border-border-default bg-surface p-4 text-sm leading-relaxed text-content">{{ tr('ShopModal.chon_mot_vat_pham_de_xem_gia_va_mua') }}</div>
    </template>
  </aside>
</template>

<style scoped>
.shop-order {
  border-color: var(--color-border);
  background: var(--color-white);
  box-shadow: var(--shadow-sm);
}

.shop-order :deep(.shared-payment__title) {
  color: var(--color-content);
}

.shop-order :deep(.shared-payment__summary) {
  border-color: var(--color-border);
  background: var(--color-surface);
  box-shadow: none;
}
</style>
