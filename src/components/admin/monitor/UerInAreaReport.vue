<script setup lang="ts">
import { useId } from "vue";
import { Bar } from "vue-chartjs";
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, type ChartOptions } from "chart.js";
import { useAdminMonitorStore } from "./admin-monitor-store";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

const store = useAdminMonitorStore();
const tableId = useId();
const chartOptions: ChartOptions<"bar"> = {
  indexAxis: "y",
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    tooltip: { callbacks: { label: (context) => `${context.parsed.x} người chơi` } },
  },
  scales: {
    x: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: "Số người chơi" } },
    y: { grid: { display: false } },
  },
};
</script>

<template>
  <div class="space-y-6 text-[#24352a]">
    <div class="grid gap-3 sm:grid-cols-3">
      <div class="rounded-xl border border-[#cbd9c6] bg-white p-4">
        <p class="text-sm text-slate-600">Người đang trong bãi</p>
        <p class="mt-2 text-3xl font-extrabold">{{ store.totalPlayers.toLocaleString("vi-VN") }}</p>
      </div>
      <div class="rounded-xl border border-[#cbd9c6] bg-white p-4">
        <p class="text-sm text-slate-600">Bãi câu có người</p>
        <p class="mt-2 text-3xl font-extrabold">{{ store.occupiedAreas.length }} <span class="text-base font-normal text-slate-500">/ {{ store.areaReport.length }} bãi</span></p>
      </div>
      <div class="rounded-xl border border-[#cbd9c6] bg-white p-4">
        <p class="text-sm text-slate-600">Đông nhất trong một bãi</p>
        <p class="mt-2 text-3xl font-extrabold text-amber-700">{{ store.busiestCount.toLocaleString("vi-VN") }} <span class="text-base font-normal">người</span></p>
        <p v-if="store.busiestAreas.length" class="mt-2 break-words text-xs text-slate-600">
          {{ store.busiestAreas.map((area) => area.title).join(", ") }}
        </p>
      </div>
    </div>

    <section class="rounded-xl border border-[#cbd9c6] bg-white p-4 sm:p-5">
      <h3 class="font-bold">Bãi câu đông người nhất</h3>
      <p class="mt-1 text-sm text-slate-600">Tối đa 10 bãi, xếp theo số người giảm dần. Màu cam đánh dấu bãi đông nhất.</p>
      <div v-if="store.totalPlayers > 0" class="mt-4 overflow-x-auto">
        <div class="relative min-w-[480px]" :style="{ height: `${store.chartHeight}px` }">
          <Bar
            :data="store.chartData"
            :options="chartOptions"
            aria-label="Biểu đồ số người chơi đang ở trong từng bãi câu"
            :aria-describedby="tableId"
          />
        </div>
      </div>
      <p v-else class="py-10 text-center text-sm text-slate-500">Hiện chưa có người chơi nào đang ở trong bãi câu.</p>
    </section>

    <section class="overflow-hidden rounded-xl border border-[#cbd9c6] bg-white">
      <div class="border-b border-[#cbd9c6] p-4 sm:px-5">
        <h3 class="font-bold">Chi tiết theo bãi câu</h3>
        <p class="mt-1 text-sm text-slate-600">Chỉ tính người đang ở trong bãi; người vừa rời bãi hoặc không hoạt động không được tính.</p>
      </div>
      <p v-if="!store.areaReport.length" class="p-8 text-center text-sm text-slate-500">Chưa có dữ liệu bãi câu.</p>
      <div v-else class="overflow-x-auto">
        <table :id="tableId" class="w-full text-left text-sm">
          <caption class="sr-only">Số người chơi đang trong từng bãi câu, xếp từ đông đến ít.</caption>
          <thead class="bg-[#f5f9f0] text-xs text-slate-600">
            <tr>
              <th scope="col" class="px-4 py-3">Bãi câu</th>
              <th scope="col" class="px-4 py-3">Quốc gia</th>
              <th scope="col" class="px-4 py-3 text-right">Người chơi</th>
              <th scope="col" class="px-4 py-3 text-right">Tỷ lệ tổng số người</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#cbd9c6]">
            <tr v-for="area in store.areaReport" :key="area.id" :class="area.playerCount > 0 && area.playerCount === store.busiestCount ? 'bg-amber-50' : ''">
              <th scope="row" class="px-4 py-3 font-medium">
                <span class="break-words">{{ area.title }}</span>
                <span v-if="area.playerCount > 0 && area.playerCount === store.busiestCount" class="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Đông nhất</span>
                <span v-if="!area.isAvailable" class="mt-1 block text-xs font-normal text-slate-500">Chưa mở</span>
              </th>
              <td class="px-4 py-3">{{ area.countryId }}</td>
              <td class="px-4 py-3 text-right font-semibold tabular-nums">{{ area.playerCount.toLocaleString("vi-VN") }}</td>
              <td class="px-4 py-3 text-right tabular-nums">{{ area.share.toLocaleString("vi-VN", { maximumFractionDigits: 1 }) }}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
