<script setup lang="ts">
import { useId } from "vue";
import { Bar } from "vue-chartjs";
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, type ChartOptions } from "chart.js";
import { useAdminMonitorStore } from "./admin-monitor-store";
import { THEME_COLORS } from '../../../utils/themePalette';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

const store = useAdminMonitorStore();
const tableId = useId();
const chartOptions: ChartOptions<"bar"> = {
  indexAxis: "y",
  responsive: true,
  maintainAspectRatio: false,
  color: THEME_COLORS.content,
  borderColor: THEME_COLORS.border,
  backgroundColor: THEME_COLORS.accent,
  plugins: {
    tooltip: {
      backgroundColor: THEME_COLORS.content,
      titleColor: THEME_COLORS.white,
      bodyColor: THEME_COLORS.white,
      footerColor: THEME_COLORS.white,
      borderColor: THEME_COLORS.border,
      multiKeyBackground: THEME_COLORS.surface,
      callbacks: { label: (context) => `${context.parsed.x} người chơi` },
    },
  },
  scales: {
    x: { beginAtZero: true, grid: { color: THEME_COLORS.border }, border: { color: THEME_COLORS.border }, ticks: { precision: 0, color: THEME_COLORS.content }, title: { display: true, text: "Số người chơi", color: THEME_COLORS.content } },
    y: { grid: { display: false }, border: { color: THEME_COLORS.border }, ticks: { color: THEME_COLORS.content } },
  },
};
</script>

<template>
  <div class="space-y-6 text-content">
    <div class="grid gap-3 sm:grid-cols-3">
      <div class="rounded-xl border border-border-default bg-white p-4">
        <div class="text-sm text-content">Người đang trong bãi</div>
        <div class="mt-2 text-3xl font-extrabold">{{ store.totalPlayers.toLocaleString("vi-VN") }}</div>
      </div>
      <div class="rounded-xl border border-border-default bg-white p-4">
        <div class="text-sm text-content">Bãi câu có người</div>
        <div class="mt-2 text-3xl font-extrabold">{{ store.occupiedAreas.length }} <span class="text-base font-normal text-content">/ {{ store.areaReport.length }} bãi</span></div>
      </div>
      <div class="rounded-xl border border-border-default bg-white p-4">
        <div class="text-sm text-content">Đông nhất trong một bãi</div>
        <div class="mt-2 text-3xl font-extrabold text-gold">{{ store.busiestCount.toLocaleString("vi-VN") }} <span class="text-base font-normal">người</span></div>
        <div v-if="store.busiestAreas.length" class="mt-2 break-words text-xs text-content">
          {{ store.busiestAreas.map((area) => area.title).join(", ") }}
        </div>
      </div>
    </div>

    <section class="rounded-xl border border-border-default bg-white p-4 sm:p-5">
      <div class="font-bold">Bãi câu đông người nhất</div>
      <div class="mt-1 text-sm text-content">Tối đa 10 bãi, xếp theo số người giảm dần. Màu cam đánh dấu bãi đông nhất.</div>
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
      <div v-else class="py-10 text-center text-sm text-content">Hiện chưa có người chơi nào đang ở trong bãi câu.</div>
    </section>

    <section class="overflow-hidden rounded-xl border border-border-default bg-white">
      <div class="border-b border-border-default p-4 sm:px-5">
        <div class="font-bold">Chi tiết theo bãi câu</div>
        <div class="mt-1 text-sm text-content">Chỉ tính người đang ở trong bãi; người vừa rời bãi hoặc không hoạt động không được tính.</div>
      </div>
      <div v-if="!store.areaReport.length" class="p-8 text-center text-sm text-content">Chưa có dữ liệu bãi câu.</div>
      <div v-else class="overflow-x-auto">
        <table :id="tableId" class="w-full text-left text-sm">
          <caption class="sr-only">Số người chơi đang trong từng bãi câu, xếp từ đông đến ít.</caption>
          <thead class="bg-surface text-xs text-content">
            <tr>
              <th scope="col" class="px-4 py-3">Bãi câu</th>
              <th scope="col" class="px-4 py-3">Quốc gia</th>
              <th scope="col" class="px-4 py-3 text-right">Người chơi</th>
              <th scope="col" class="px-4 py-3 text-right">Tỷ lệ tổng số người</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-default">
            <tr v-for="area in store.areaReport" :key="area.id" :class="area.playerCount > 0 && area.playerCount === store.busiestCount ? 'bg-surface' : ''">
              <th scope="row" class="px-4 py-3 font-medium">
                <span class="break-words">{{ area.title }}</span>
                <span v-if="area.playerCount > 0 && area.playerCount === store.busiestCount" class="ml-2 inline-block rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-gold">Đông nhất</span>
                <span v-if="!area.isAvailable" class="mt-1 block text-xs font-normal text-content">Chưa mở</span>
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
