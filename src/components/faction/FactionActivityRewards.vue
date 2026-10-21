<script setup lang="ts">
import { computed } from "vue";
import { FACTION_ACTIVITY_MILESTONES, type ActivityMilestone } from "../../data/factionActivityMilestones";
import Hint from "../shared/Hint.vue";

interface Props {
  currentPoints: number;
}

const props = withDefaults(defineProps<Props>(), {
  currentPoints: 0,
});

const maxPoints = computed(() => {
  const lastMilestone = FACTION_ACTIVITY_MILESTONES[FACTION_ACTIVITY_MILESTONES.length - 1];
  return lastMilestone ? lastMilestone.points : 500;
});

const safeCurrentPoints = computed(() => Math.max(0, props.currentPoints));

/**
 * Tỉ lệ % tổng thể điểm năng động so với mốc tối đa.
 */
const overallProgressPercent = computed(() => {
  if (maxPoints.value <= 0) return 0;
  return Math.min(100, Math.round((safeCurrentPoints.value / maxPoints.value) * 100));
});

/**
 * Mốc tiếp theo người chơi đang hướng tới.
 */
const nextMilestone = computed<ActivityMilestone | null>(() => {
  return FACTION_ACTIVITY_MILESTONES.find((m) => m.points > safeCurrentPoints.value) ?? null;
});

/**
 * Số mốc người chơi đã đạt được (0-10).
 */
const completedMilestonesCount = computed(() => {
  return FACTION_ACTIVITY_MILESTONES.filter((m) => safeCurrentPoints.value >= m.points).length;
});

function isMilestoneReached(pointsRequired: number): boolean {
  return safeCurrentPoints.value >= pointsRequired;
}
</script>

<template>
  <section
    class="activity-section rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] p-4 sm:p-5 shadow-lg space-y-4"
  >
    <!-- Header của Section Năng Động -->
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[#cbd9c6] pb-3">
      <div class="flex items-center gap-2.5">
        <span class="text-lg text-emerald-700">⚡</span>
        <div>
          <h3 class="m-0 text-xs sm:text-sm font-bold uppercase tracking-wider font-serif text-emerald-900">
            Phần Thưởng Năng Động Hàng Ngày
          </h3>
          <p class="m-0 text-[11px] text-[#617565]">Tích lũy hoạt động trong ngày để mở khóa 10 mốc ban thưởng</p>
        </div>
      </div>

      <!-- Huy hiệu điểm & Tiến độ mốc tiếp theo -->
      <div class="flex flex-col items-end gap-2 text-xs">
        <div class="px-3 py-1 rounded-full bg-[#eaf2e5] border border-[#cbd9c6] flex items-center gap-1.5 shadow-sm">
          <span class="text-emerald-800 font-bold font-serif">Điểm:</span>
          <span class="font-bold text-emerald-700 font-mono text-sm sm:text-base">{{ safeCurrentPoints }}</span>
          <span class="text-[#617565] text-[11px]">/ {{ maxPoints }}</span>
          <Hint text="Điểm có thể thu thập từ hoạt động câu cá" />
        </div>

        <div
          v-if="nextMilestone"
          class="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#eaf2e5] border border-[#cbd9c6] text-[11px] text-[#526a58]"
        >
          <span class="text-[#617565]">(cần thêm {{ nextMilestone.points - safeCurrentPoints }} điểm)</span>
          <span>để đạt mốc kế tiếp:</span>
          <strong class="text-emerald-800">Mốc {{ nextMilestone.level }}</strong>
        </div>
        <div
          v-else
          class="hidden sm:flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-[11px] text-emerald-800 font-bold"
        >
          <span>👑 Đã đại mốc tối đa</span>
        </div>
      </div>
    </div>

    <!-- Thanh tiến trình tổng quan -->
    <div class="space-y-1.5">
      <div class="flex items-center justify-between text-[11px] text-[#617565]">
        <span
          >Tiến trình hoàn thành: <strong class="text-emerald-800">{{ completedMilestonesCount }}/10 Mốc</strong></span
        >
        <span class="font-mono text-emerald-700 font-bold">{{ overallProgressPercent }}%</span>
      </div>
      <div class="w-full h-2 rounded-full bg-[#e1eadc] border border-[#cbd9c6] overflow-hidden p-[1px]">
        <div
          class="h-full rounded-full bg-linear-to-r from-emerald-700 via-emerald-600 to-lime-500 transition-all duration-500 ease-out shadow-sm"
          :style="{ width: `${overallProgressPercent}%` }"
        />
      </div>
    </div>

    <!-- Dải 10 mốc thiết kế nằm ngang (Horizontal Scrollable Track) -->
    <div class="milestones-track-wrapper relative">
      <div class="overflow-x-auto pb-3 pt-1 flex items-stretch gap-3 no-scrollbar scroll-smooth">
        <article
          v-for="item in FACTION_ACTIVITY_MILESTONES"
          :key="item.level"
          class="milestone-card shrink-0 w-[160px] sm:w-[175px] rounded-lg border p-3 flex flex-col justify-between transition-all duration-200 relative overflow-hidden"
          :class="[
            isMilestoneReached(item.points)
              ? 'reached-card bg-gradient-to-b from-[#f5f9f0] to-[#eaf2e5] border-emerald-500/70 shadow-[0_0_12px_rgba(34,120,62,0.12)]'
              : 'locked-card bg-[#eaf2e5] border-[#cbd9c6] opacity-90 hover:opacity-100 hover:border-[#8eaa91]',
          ]"
        >
          <!-- Huy hiệu góc khi đã đạt -->
          <div
            v-if="isMilestoneReached(item.points)"
            class="absolute top-0 right-0 w-8 h-8 pointer-events-none overflow-hidden"
          >
            <div
              class="absolute transform rotate-45 bg-emerald-600 text-[8px] font-bold text-white py-0.5 right-[-20px] top-[4px] w-[55px] text-center uppercase tracking-tighter"
            >
              ĐẠT
            </div>
          </div>

          <!-- Header thẻ mốc: Số thứ tự mốc & Điểm yêu cầu -->
          <div>
            <div class="flex items-center justify-between gap-1 mb-2">
              <span
                class="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase font-serif tracking-wider"
                :class="
                  isMilestoneReached(item.points)
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-[#f5f9f0] text-[#526a58] border border-[#cbd9c6]'
                "
              >
                Mốc {{ item.level }}
              </span>

              <span
                class="font-mono text-[11px] font-bold"
                :class="isMilestoneReached(item.points) ? 'text-emerald-700' : 'text-[#617565]'"
              >
                {{ item.points }} Đ
              </span>
            </div>

            <!-- Icon & Tên mốc -->
            <div class="flex flex-col items-center text-center my-1.5">
              <div
                class="size-11 rounded-full flex items-center justify-center text-2xl mb-1.5 transition-transform duration-200 select-none shadow-inner"
                :class="
                  isMilestoneReached(item.points)
                    ? 'bg-[#dce9d7] border border-emerald-500/80 scale-105'
                    : 'bg-[#f5f9f0] border border-[#cbd9c6] grayscale opacity-70'
                "
              >
                {{ item.icon }}
              </div>
              <h4
                class="m-0 text-xs font-serif font-bold truncate max-w-full"
                :class="isMilestoneReached(item.points) ? 'text-emerald-950' : 'text-[#526a58]'"
              >
                {{ item.title }}
              </h4>
            </div>

            <!-- Mô tả phần thưởng -->
            <div
              class="mt-2 p-1.5 rounded bg-[#f5f9f0] border text-[11px] text-center leading-tight min-h-[38px] flex items-center justify-center"
              :class="
                isMilestoneReached(item.points)
                  ? 'border-emerald-300 text-emerald-900'
                  : 'border-[#cbd9c6] text-[#617565]'
              "
            >
              <span>{{ item.reward }}</span>
            </div>
          </div>

          <!-- Trạng thái mốc -->
          <div class="mt-3 pt-2 border-t border-[#cbd9c6] text-center">
            <span
              v-if="isMilestoneReached(item.points)"
              class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700"
            >
              <span class="text-xs">✓</span> Đã hoàn thành
            </span>
            <span v-else class="inline-block text-[10px] text-[#617565] font-medium">
              Cần thêm {{ item.points - safeCurrentPoints }} đ
            </span>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.milestones-track-wrapper {
  mask-image: linear-gradient(to right, black 0%, black calc(100% - 16px), transparent 100%);
}

.no-scrollbar::-webkit-scrollbar {
  height: 6px;
}

.no-scrollbar::-webkit-scrollbar-track {
  background: #e1eadc;
  border-radius: 4px;
}

.no-scrollbar::-webkit-scrollbar-thumb {
  background: #b7cbb4;
  border-radius: 4px;
}

.no-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #8eaa91;
}
</style>
