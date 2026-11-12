<script setup lang="ts">
import type { CurrencyConversionRate } from "../../../types/model/currency";
import { getFormattingLocale } from '../../../i18n';
import { t as tr } from "../../../i18n";

import { onMounted, ref } from "vue";
import { useCurrencyStore } from "../../../stores/currency";
import { useToast } from "../../../composables/useToast";

import TwoOptionsModal from "../../shared/TwoOptionsModal.vue";
import Cash from "../currency/Cash.vue";
import Shells from "../currency/Shells.vue";
import Tickets from "../currency/Tickets.vue";

const currencyStore = useCurrencyStore();
const toast = useToast();
const currencies = { cash: Cash, shells: Shells, tickets: Tickets };
const pendingConversion = ref<{
  rate: CurrencyConversionRate;
  batches: number;
  cost: number;
  received: number;
} | null>(null);

function requestConversion(rate: CurrencyConversionRate) {
  if (pendingConversion.value || !currencyStore.canConvert(rate)) return;
  pendingConversion.value = { rate: { ...rate }, ...currencyStore.conversionAmounts(rate) };
}

function dismissConfirmation() {
  if (!currencyStore.converting) pendingConversion.value = null;
}

async function confirmConversion() {
  const pending = pendingConversion.value;
  if (!pending || currencyStore.converting) return;
  if (!currencyStore.canConvert(pending.rate)
    || currencyStore.conversionAmounts(pending.rate).batches !== pending.batches) {
    pendingConversion.value = null;
    toast.warning(tr('CurrencyConvertTable.thong_tin_quy_doi_da_thay_doi_vui_long_kiem_tra_so_goi_va_so_du_'));
    return;
  }
  await currencyStore.convertCurrency(pending.rate);
  pendingConversion.value = null;
}

onMounted(() => {
  void currencyStore.fetchConversionRates();
  void currencyStore.fetchCurrency();
});
</script>

<template>
  <section :aria-label="tr('CurrencyConvertTable.quy_doi_tien_te')" class="min-w-0 w-full rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] p-4 text-[#24352a] sm:p-6">
    <div class="text-lg font-bold">{{ tr('CurrencyConvertTable.quy_doi_tien_te') }}</div>
    <div class="mt-1 text-sm">{{ tr('CurrencyConvertTable.chon_so_goi_muon_doi_moi_goi_ap_dung_theo_menh_gia_trong_bang') }}</div>

    <div v-if="currencyStore.conversionRatesLoading" role="status" class="mt-4 text-sm">{{ tr('CurrencyConvertTable.dang_tai_ty_gia') }}</div>
    <div v-else-if="currencyStore.conversionRatesError" role="alert" class="mt-4 text-sm text-red-700">
      {{ currencyStore.conversionRatesError }}
      <button type="button" class="ml-2 underline" @click="currencyStore.fetchConversionRates()">{{ tr('Maintenance.thu_lai') }}</button>
    </div>
    <div v-else-if="!currencyStore.conversionRates.length" class="mt-4 text-sm">{{ tr('CurrencyConvertTable.chua_co_ty_gia_quy_doi_duoc_kich_hoat') }}</div>
    <div v-else class="mt-5 overflow-x-auto">
      <table class="w-full min-w-[680px] text-left text-sm">
        <caption class="sr-only">{{ tr('CurrencyConvertTable.menh_gia_va_so_luong_quy_doi_tien_vo_so_va_ve') }}</caption>
        <thead>
          <tr class="border-b border-[#cbd9c6]">
            <th scope="col" class="w-[20%] whitespace-nowrap px-2 py-3">{{ tr('CurrencyConvertTable.chi_moi_goi') }}</th>
            <th scope="col" class="w-[18%] whitespace-nowrap px-2 py-3">{{ tr('CurrencyConvertTable.nhan_moi_goi') }}</th>
            <th scope="col" class="w-[16%] whitespace-nowrap px-2 py-3">{{ tr('CurrencyConvertTable.so_goi') }}</th>
            <th scope="col" class="px-2 py-3">{{ tr('CurrencyConvertTable.tong_quy_doi') }}</th>
            <th scope="col" class="w-px px-2 py-3"><span class="sr-only">{{ tr('CurrencyConvertTable.thao_tac') }}</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="rate in currencyStore.conversionRates" :key="`${rate.source_currency}-${rate.target_currency}`" class="border-b border-[#cbd9c6] last:border-0">
            <td class="px-2 py-3"><component :is="currencies[rate.source_currency]" :amount="rate.source_amount" :size="22" /></td>
            <td class="px-2 py-3"><component :is="currencies[rate.target_currency]" :amount="rate.target_amount" :size="22" /></td>
            <td class="px-2 py-3">
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  :aria-label="tr('CurrencyConvertTable.giam_so_goi')"
                  :aria-controls="`convert-${rate.source_currency}-${rate.target_currency}`"
                  :disabled="currencyStore.converting || !!pendingConversion || currencyStore.conversionAmounts(rate).batches <= 1"
                  class="flex size-11 shrink-0 items-center justify-center rounded-lg border border-[#cbd9c6] bg-white text-lg font-bold hover:bg-[#e7efdf] focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  @click="currencyStore.adjustConversionBatches(rate, -1)"
                >−</button>
                <input
                  :id="`convert-${rate.source_currency}-${rate.target_currency}`"
                  v-model.number="currencyStore.conversionBatches[`${rate.source_currency}-${rate.target_currency}`]"
                  type="number" min="1" step="1"
                  :aria-label="tr('CurrencyConvertTable.so_goi_value0_sang_value1', { value0: rate.source_currency, value1: rate.target_currency })"
                  :disabled="currencyStore.converting || !!pendingConversion"
                  class="min-h-11 w-20 rounded-lg border border-[#cbd9c6] bg-white px-2 py-2 text-center outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 disabled:opacity-50"
                />
                <button
                  type="button"
                  :aria-label="tr('CurrencyConvertTable.tang_so_goi')"
                  :aria-controls="`convert-${rate.source_currency}-${rate.target_currency}`"
                  :disabled="currencyStore.converting || !!pendingConversion || currencyStore.conversionAmounts(rate).batches >= Number.MAX_SAFE_INTEGER"
                  class="flex size-11 shrink-0 items-center justify-center rounded-lg border border-[#cbd9c6] bg-white text-lg font-bold hover:bg-[#e7efdf] focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  @click="currencyStore.adjustConversionBatches(rate, 1)"
                >+</button>
              </div>
            </td>
            <td class="px-2 py-3">
              <div v-if="currencyStore.hasValidConversionAmounts(rate)" class="flex items-center gap-1 whitespace-nowrap">
                <component :is="currencies[rate.source_currency]" :amount="currencyStore.conversionAmounts(rate).cost" :size="20" />
                <span :aria-label="tr('CurrencyConvertTable.doi_thanh')">→</span>
                <component :is="currencies[rate.target_currency]" :amount="currencyStore.conversionAmounts(rate).received" :size="20" />
              </div>
              <span v-else class="text-xs text-red-700">{{ tr('CurrencyConvertTable.so_goi_phai_la_so_nguyen_duong_va_tong_quy_doi_trong_gioi_han_ch') }}</span>
            </td>
            <td class="px-2 py-3">
              <button type="button" :disabled="!currencyStore.canConvert(rate) || !!pendingConversion" class="min-h-11 whitespace-nowrap rounded-lg bg-emerald-800 px-3 py-2 font-bold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50" @click="requestConversion(rate)">
                {{ currencyStore.converting ? tr('CurrencyConvertTable.dang_doi') : tr('CurrencyConvertTable.quy_doi') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="currencyStore.error" role="alert" class="mt-4 text-sm text-red-700">
      {{ currencyStore.error }}
      <button type="button" class="ml-2 underline" :disabled="currencyStore.loading" @click="currencyStore.fetchCurrency()">{{ tr('CurrencyConvertTable.tai_lai_so_du') }}</button>
    </div>
  </section>
  <Teleport to="body">
    <TwoOptionsModal
      v-if="pendingConversion"
      :title="tr('CurrencyConvertTable.xac_nhan_quy_doi')"
      :first-text="tr('AccountInfoModal.huy')"
      :second-text="currencyStore.converting ? tr('CurrencyConvertTable.dang_doi') : tr('Fishfarm.xac_nhan')"
      :first-disabled="currencyStore.converting"
      :second-disabled="currencyStore.converting || !currencyStore.canConvert(pendingConversion.rate)"
      :on-first="dismissConfirmation"
      :on-second="confirmConversion"
      :on-dismiss="dismissConfirmation"
    >
      <div class="space-y-3 text-sm text-[#24352a]">
        <div>{{ tr('CurrencyConvertTable.ban_muon_quy_doi') }} {{ pendingConversion.batches.toLocaleString(getFormattingLocale()) }} {{ tr('CurrencyConvertTable.goi') }}</div>
        <div class="flex flex-wrap items-center gap-2 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] p-3">
          <component :is="currencies[pendingConversion.rate.source_currency]" :amount="pendingConversion.cost" :size="22" />
          <span :aria-label="tr('CurrencyConvertTable.doi_thanh')">→</span>
          <component :is="currencies[pendingConversion.rate.target_currency]" :amount="pendingConversion.received" :size="22" />
        </div>
      </div>
    </TwoOptionsModal>
  </Teleport>
</template>
