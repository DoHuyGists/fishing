<script setup lang="ts">
import { onMounted } from "vue";
import { useCurrencyStore } from "../../../stores/currency";
import Cash from "../currency/Cash.vue";
import Shells from "../currency/Shells.vue";
import Tickets from "../currency/Tickets.vue";

const currencyStore = useCurrencyStore();
const currencies = { cash: Cash, shells: Shells, tickets: Tickets };

onMounted(() => {
  currencyStore.conversionNotice = null;
  void currencyStore.fetchConversionRates();
  void currencyStore.fetchCurrency();
});
</script>

<template>
  <section aria-label="Quy đổi tiền tệ" class="mx-auto my-6 w-full max-w-3xl rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] p-4 text-[#24352a] sm:p-6">
    <div class="text-lg font-bold">Quy đổi tiền tệ</div>
    <div class="mt-1 text-sm">Chọn số gói muốn đổi. Mỗi gói áp dụng theo mệnh giá trong bảng.</div>

    <div v-if="currencyStore.conversionRatesLoading" role="status" class="mt-4 text-sm">Đang tải tỷ giá...</div>
    <div v-else-if="currencyStore.conversionRatesError" role="alert" class="mt-4 text-sm text-red-700">
      {{ currencyStore.conversionRatesError }}
      <button type="button" class="ml-2 underline" @click="currencyStore.fetchConversionRates()">Thử lại</button>
    </div>
    <div v-else-if="!currencyStore.conversionRates.length" class="mt-4 text-sm">Chưa có tỷ giá quy đổi được kích hoạt.</div>
    <div v-else class="mt-4 overflow-x-auto">
      <table class="w-full text-left text-sm">
        <caption class="sr-only">Mệnh giá và số lượng quy đổi tiền, vỏ sò và vé</caption>
        <thead>
          <tr class="border-b border-[#cbd9c6]">
            <th scope="col" class="px-2 py-3">Chi mỗi gói</th>
            <th scope="col" class="px-2 py-3">Nhận mỗi gói</th>
            <th scope="col" class="px-2 py-3">Số gói</th>
            <th scope="col" class="px-2 py-3">Tổng quy đổi</th>
            <th scope="col" class="px-2 py-3"><span class="sr-only">Thao tác</span></th>
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
                :disabled="currencyStore.converting"
                class="w-20 rounded-lg border border-[#cbd9c6] bg-white px-2 py-2 disabled:opacity-50"
              />
            </td>
            <td class="px-2 py-3">
              <div v-if="currencyStore.canConvert(rate) || currencyStore.converting" class="flex flex-wrap items-center gap-1">
                <component :is="currencies[rate.source_currency]" :amount="currencyStore.conversionAmounts(rate).cost" :size="20" />
                <span aria-label="đổi thành">→</span>
                <component :is="currencies[rate.target_currency]" :amount="currencyStore.conversionAmounts(rate).received" :size="20" />
              </div>
              <span v-else class="text-xs text-red-700">Nhập số gói nguyên dương và kiểm tra số dư.</span>
            </td>
            <td class="px-2 py-3">
              <button type="button" :disabled="!currencyStore.canConvert(rate)" class="whitespace-nowrap rounded-lg bg-emerald-800 px-3 py-2 font-bold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50" @click="currencyStore.convertCurrency(rate)">
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
    <div v-if="currencyStore.conversionNotice" :role="currencyStore.conversionNotice.type === 'error' ? 'alert' : 'status'" class="mt-4 rounded-lg px-3 py-2 text-sm" :class="currencyStore.conversionNotice.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'">
      {{ currencyStore.conversionNotice.text }}
    </div>
  </section>
</template>
