<script setup lang="ts">
import type { ShopItem } from "../../../types/model/item";
import { getFormattingLocale, t as tr } from "../../../i18n";

import PaymentConfirmation from "../../shared/PaymentConfirmation.vue";

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
  <aside class="h-fit rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-4 lg:sticky lg:top-0">
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
      <div class="flex items-center gap-3">
        <div
          class="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-[#cbd9c6] bg-white text-2xl"
        >
          <img
            v-if="selectedItem.image"
            :src="selectedItem.image"
            :alt="selectedItem.name"
            class="h-full w-full object-contain"
          /><span v-else>{{ selectedItem.icon || "🎁" }}</span>
        </div>
        <div class="min-w-0">
          <div class="m-0 truncate font-bold">{{ selectedItem.name }}</div>
          <div class="m-0 text-xs text-emerald-950/60">{{ selectedItem.category || tr('ShopModal.vat_pham') }}</div>
        </div>
      </div>
      <label class="mt-5 block text-xs font-bold"
        >{{ tr('ShopModal.so_luot_mua') }}
        <input
          v-model.number="quantity"
          type="number"
          min="1"
          step="1"
          class="mt-1 w-full rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm"
        />
      </label>
      <template #summary>
        <div class="flex justify-between gap-2">
          <span>{{ tr('ShopModal.so_luong_moi_luot') }}</span><span>{{ (selectedItem.quantity ?? 1).toLocaleString(getFormattingLocale()) }}</span>
        </div>
        <div class="flex justify-between gap-2">
          <span>{{ tr('ShopModal.tong_so_luong_nhan') }}</span><span>{{ totalReceived.toLocaleString(getFormattingLocale()) }}</span>
        </div>
        <div class="flex justify-between">
          <span>{{ tr('ShopModal.don_gia') }}</span><span>{{ selectedItem.price.toLocaleString(getFormattingLocale()) }} {{ tr('currency.cashUnit') }}</span>
        </div>
      </template>
    </PaymentConfirmation>
    <template v-else>
      <div class="text-base font-extrabold">{{ tr('ShopModal.don_hang') }}</div>
      <div class="mt-4 text-sm text-emerald-950/60">{{ tr('ShopModal.chon_mot_vat_pham_de_xem_gia_va_mua') }}</div>
    </template>
  </aside>
</template>
