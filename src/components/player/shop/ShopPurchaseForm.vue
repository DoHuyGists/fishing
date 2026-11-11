<script setup lang="ts">
import { getFormattingLocale, t as tr } from "../../../i18n";
import type { ShopItem } from "../../../data/supabaseItemRepository";
import Cash from "../currency/Cash.vue";

defineProps<{
  selectedItem: ShopItem | null;
  totalPrice: number;
  totalReceived: number;
  canBuy: boolean;
  cash: number;
  formattedCash: string;
  busy: boolean;
}>();

const quantity = defineModel<number>("quantity", { required: true });
const emit = defineEmits<{ buy: [] }>();
</script>

<template>
  <aside class="h-fit rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-4 lg:sticky lg:top-0">
    <div class="m-0 text-base font-extrabold">{{ tr('ShopModal.don_hang') }}</div>
    <div v-if="selectedItem" class="mt-4">
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
      <div class="mt-4 space-y-2 border-t border-[#cbd9c6] pt-3 text-sm">
        <div class="flex justify-between gap-2">
          <span>{{ tr('ShopModal.so_luong_moi_luot') }}</span><span>{{ (selectedItem.quantity ?? 1).toLocaleString(getFormattingLocale()) }}</span>
        </div>
        <div class="flex justify-between gap-2">
          <span>{{ tr('ShopModal.tong_so_luong_nhan') }}</span><span>{{ totalReceived.toLocaleString(getFormattingLocale()) }}</span>
        </div>
        <div class="flex justify-between">
          <span>{{ tr('ShopModal.don_gia') }}</span><span>{{ selectedItem.price.toLocaleString(getFormattingLocale()) }} {{ tr('currency.cashUnit') }}</span>
        </div>
        <div class="flex justify-between font-extrabold">
          <span>{{ tr('ShopModal.thanh_tien') }}</span><span>{{ totalPrice.toLocaleString(getFormattingLocale()) }} {{ tr('currency.cashUnit') }}</span>
        </div>
        <div class="flex justify-between text-xs text-emerald-900/65">
          <span>{{ tr('ShopModal.so_du_hien_tai') }}</span><Cash :amount="formattedCash" />
        </div>
      </div>
      <div v-if="!Number.isInteger(quantity) || quantity < 1" class="mt-3 text-xs text-red-700">
        {{ tr('ShopModal.so_luong_mua_khong_hop_le') }}
      </div>
      <div v-else-if="cash < totalPrice" class="mt-3 text-xs text-red-700">
        {{ tr('ShopModal.ban_khong_du_tien') }}
      </div>
      <button
        type="button"
        class="mt-4 w-full rounded-lg bg-[#24352a] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-45"
        :disabled="busy || !canBuy"
        @click="emit('buy')"
      >
        {{ busy ? tr('DailyAttendance.dang_xu_ly') : tr('ShopModal.mua_vat_pham') }}
      </button>
    </div>
    <div v-else class="mt-4 text-sm text-emerald-950/60">{{ tr('ShopModal.chon_mot_vat_pham_de_xem_gia_va_mua') }}</div>
  </aside>
</template>
