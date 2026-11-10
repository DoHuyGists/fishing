<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useCurrencyStore } from "../../../stores/currency";
import { useToast } from "../../../composables/useToast";
import type { CurrencyConversionRate } from "../../../data/supabaseCurrencyRepository";
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
    toast.warning("Thông tin quy đổi đã thay đổi. Vui lòng kiểm tra số gói và số dư rồi thử lại.");
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
  <section aria-label="Quy đổi tiền tệ" class="min-w-0 w-full rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] p-4 text-[#24352a] sm:p-6">
    <div class="text-lg font-bold">Quy đổi tiền tệ</div>
    <div class="mt-1 text-sm">Chọn số gói muốn đổi. Mỗi gói áp dụng theo mệnh giá trong bảng.</div>

    <div v-if="currencyStore.conversionRatesLoading" role="status" class="mt-4 text-sm">Đang tải tỷ giá...</div>
    <div v-else-if="currencyStore.conversionRatesError" role="alert" class="mt-4 text-sm text-red-700">
      {{ currencyStore.conversionRatesError }}
      <button type="button" class="ml-2 underline" @click="currencyStore.fetchConversionRates()">Thử lại</button>
    </div>
    <div v-else-if="!currencyStore.conversionRates.length" class="mt-4 text-sm">Chưa có tỷ giá quy đổi được kích hoạt.</div>
    <div v-else class="mt-5 overflow-x-auto">
      <table class="w-full min-w-[680px] text-left text-sm">
        <caption class="sr-only">Mệnh giá và số lượng quy đổi tiền, vỏ sò và vé</caption>
        <thead>
          <tr class="border-b border-[#cbd9c6]">
            <th scope="col" class="w-[20%] whitespace-nowrap px-2 py-3">Chi mỗi gói</th>
            <th scope="col" class="w-[18%] whitespace-nowrap px-2 py-3">Nhận mỗi gói</th>
            <th scope="col" class="w-[16%] whitespace-nowrap px-2 py-3">Số gói</th>
            <th scope="col" class="px-2 py-3">Tổng quy đổi</th>
            <th scope="col" class="w-px px-2 py-3"><span class="sr-only">Thao tác</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="rate in currencyStore.conversionRates" :key="`${rate.source_currency}-${rate.target_currency}`" class="border-b border-[#cbd9c6] last:border-0">
            <td class="px-2 py-3"><component :is="currencies[rate.source_currency]" :amount="rate.source_amount" :size="22" /></td>
            <td class="px-2 py-3"><component :is="currencies[rate.target_currency]" :amount="rate.target_amount" :size="22" /></td>
            <td class="px-2 py-3">
              <input
                :id="`convert-${rate.source_currency}-${rate.target_currency}`"
                v-model.number="currencyStore.conversionBatches[`${rate.source_currency}-${rate.target_currency}`]"
                type="number" min="1" step="1"
                :aria-label="`Số gói ${rate.source_currency} sang ${rate.target_currency}`"
                :disabled="currencyStore.converting || !!pendingConversion"
                class="min-h-11 w-20 rounded-lg border border-[#cbd9c6] bg-white px-2 py-2 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 disabled:opacity-50"
              />
            </td>
            <td class="px-2 py-3">
              <div v-if="currencyStore.hasValidConversionAmounts(rate)" class="flex items-center gap-1 whitespace-nowrap">
                <component :is="currencies[rate.source_currency]" :amount="currencyStore.conversionAmounts(rate).cost" :size="20" />
                <span aria-label="đổi thành">→</span>
                <component :is="currencies[rate.target_currency]" :amount="currencyStore.conversionAmounts(rate).received" :size="20" />
              </div>
              <span v-else class="text-xs text-red-700">Số gói phải là số nguyên dương và tổng quy đổi trong giới hạn cho phép.</span>
            </td>
            <td class="px-2 py-3">
              <button type="button" :disabled="!currencyStore.canConvert(rate) || !!pendingConversion" class="min-h-11 whitespace-nowrap rounded-lg bg-emerald-800 px-3 py-2 font-bold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50" @click="requestConversion(rate)">
                {{ currencyStore.converting ? "Đang đổi..." : "Quy đổi" }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="currencyStore.error" role="alert" class="mt-4 text-sm text-red-700">
      {{ currencyStore.error }}
      <button type="button" class="ml-2 underline" :disabled="currencyStore.loading" @click="currencyStore.fetchCurrency()">Tải lại số dư</button>
    </div>
  </section>
  <Teleport to="body">
    <TwoOptionsModal
      v-if="pendingConversion"
      title="Xác nhận quy đổi"
      first-text="Hủy"
      :second-text="currencyStore.converting ? 'Đang đổi...' : 'Xác nhận'"
      :first-disabled="currencyStore.converting"
      :second-disabled="currencyStore.converting || !currencyStore.canConvert(pendingConversion.rate)"
      :on-first="dismissConfirmation"
      :on-second="confirmConversion"
      :on-dismiss="dismissConfirmation"
    >
      <div class="space-y-3 text-sm text-[#24352a]">
        <div>Bạn muốn quy đổi {{ pendingConversion.batches.toLocaleString('vi-VN') }} gói?</div>
        <div class="flex flex-wrap items-center gap-2 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] p-3">
          <component :is="currencies[pendingConversion.rate.source_currency]" :amount="pendingConversion.cost" :size="22" />
          <span aria-label="đổi thành">→</span>
          <component :is="currencies[pendingConversion.rate.target_currency]" :amount="pendingConversion.received" :size="22" />
        </div>
      </div>
    </TwoOptionsModal>
  </Teleport>
</template>
