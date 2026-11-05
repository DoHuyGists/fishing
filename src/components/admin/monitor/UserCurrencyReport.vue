<script setup lang="ts">
import { useAdminMonitorStore } from "./admin-monitor-store";

const store = useAdminMonitorStore();
</script>

<template>
  <div class="space-y-6 text-[#24352a]">
    <div>
      <h3 class="text-lg font-bold">Tiền tệ thế giới</h3>
      <p class="mt-1 text-sm text-slate-600">Số dư hiện tại của tất cả ví người chơi, bao gồm người không ở trong bãi câu. Tiền và vỏ sò được thống kê riêng.</p>
    </div>

    <div class="grid gap-3 sm:grid-cols-3">
      <div v-for="currency in store.currencyReport" :key="currency.key" class="min-w-0 rounded-xl border border-[#cbd9c6] bg-white p-4">
        <p class="flex items-center gap-2 text-sm text-slate-600">
          <img :src="currency.icon" alt="" class="size-6" aria-hidden="true" />
          Tổng {{ currency.label.toLocaleLowerCase("vi-VN") }} toàn thế giới
        </p>
        <p class="mt-2 break-words text-3xl font-extrabold tabular-nums">{{ currency.total.toLocaleString("vi-VN") }}</p>
        <p class="mt-2 text-xs text-slate-600">{{ currency.holderCount.toLocaleString("vi-VN") }} ví có số dư {{ currency.label.toLocaleLowerCase("vi-VN") }} dương</p>
      </div>
      <div class="rounded-xl border border-[#cbd9c6] bg-white p-4">
        <p class="text-sm text-slate-600">Tổng số ví người chơi</p>
        <p class="mt-2 text-3xl font-extrabold tabular-nums">{{ store.currencies.length.toLocaleString("vi-VN") }}</p>
        <p class="mt-2 text-xs text-slate-600">{{ store.emptyWalletCount.toLocaleString("vi-VN") }} ví không có tiền và vỏ sò</p>
      </div>
    </div>

    <p v-if="!store.currencies.length" role="status" class="rounded-xl border border-[#cbd9c6] bg-white p-8 text-center text-sm text-slate-500">
      Chưa có dữ liệu ví tiền tệ của người chơi.
    </p>
    <div v-else class="grid items-start gap-6 xl:grid-cols-2">
      <section v-for="currency in store.currencyReport" :key="currency.key" class="min-w-0 overflow-hidden rounded-xl border border-[#cbd9c6] bg-white">
        <div class="border-b border-[#cbd9c6] p-4 sm:px-5">
          <h3 class="font-bold">Top 10 người chơi có nhiều {{ currency.label.toLocaleLowerCase("vi-VN") }} nhất</h3>
          <p class="mt-1 text-sm text-slate-600">Xếp theo số dư giảm dần, chỉ tính ví có số dư dương.</p>
        </div>
        <p v-if="!currency.topHolders.length" class="p-8 text-center text-sm text-slate-500">Chưa có người chơi sở hữu {{ currency.label.toLocaleLowerCase("vi-VN") }}.</p>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <caption class="sr-only">Top người chơi theo số dư {{ currency.label.toLocaleLowerCase("vi-VN") }}</caption>
            <thead class="bg-[#f5f9f0] text-xs text-slate-600">
              <tr>
                <th scope="col" class="px-4 py-3">Hạng</th>
                <th scope="col" class="px-4 py-3">ID người chơi</th>
                <th scope="col" class="px-4 py-3 text-right">Số dư ({{ currency.unit }})</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#cbd9c6]">
              <tr v-for="(wallet, index) in currency.topHolders" :key="wallet.id" :class="index === 0 ? 'bg-amber-50' : ''">
                <td class="px-4 py-3 tabular-nums">{{ index + 1 }}</td>
                <th scope="row" class="min-w-48 break-all px-4 py-3 font-mono text-xs font-medium">{{ wallet.userId }}</th>
                <td class="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">{{ wallet.balance.toLocaleString("vi-VN") }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>
