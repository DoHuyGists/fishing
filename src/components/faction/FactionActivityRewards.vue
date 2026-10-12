<script setup lang="ts">
import { computed } from "vue";
import {
  FACTION_ACTIVITY_MILESTONES,
  type ActivityMilestone,
} from "../../data/factionActivityMilestones";

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
  return (
    FACTION_ACTIVITY_MILESTONES.find((m) => m.points > safeCurrentPoints.value) ?? null
  );
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
    class="activity-section rounded-xl border border-[#3b4e44] bg-[#121c18] text-[#e3e8e4] p-4 sm:p-5 shadow-lg space-y-4"
  >
    <!-- Header của Section Năng Động -->
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[#24362d] pb-3">
      <div class="flex items-center gap-2.5">
        <span class="text-lg text-amber-400">⚡</span>
        <div>
          <h3 class="m-0 text-xs sm:text-sm font-bold uppercase tracking-wider font-serif text-amber-200">
            Phần Thưởng Năng Động Hàng Ngày
          </h3>
          <p class="m-0 text-[11px] text-[#8ea196]">
            Tích lũy hoạt động trong ngày để mở khóa 10 mốc ban thưởng
          </p>
        </div>
      </div>

      <!-- Huy hiệu điểm & Tiến độ mốc tiếp theo -->
      <div class="flex flex-wrap items-center gap-2 text-xs">
        <div class="px-3 py-1 rounded-full bg-[#1b2a23] border border-amber-600/50 flex items-center gap-1.5 shadow-sm">
          <span class="text-amber-400 font-bold font-serif">Điểm:</span>
          <span class="font-bold text-amber-300 font-mono text-sm sm:text-base">{{ safeCurrentPoints }}</span>
          <span class="text-[#7f9488] text-[11px]">/ {{ maxPoints }}</span>
        </div>

        <div
          v-if="nextMilestone"
          class="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#16231d] border border-[#2d4035] text-[11px] text-[#9db0a5]"
        >
          <span>Mục tiêu kế tiếp:</span>
          <strong class="text-amber-200">Mốc {{ nextMilestone.level }}</strong>
          <span class="text-[#768a7f]">(cần thêm {{ nextMilestone.points - safeCurrentPoints }} điểm)</span>
        </div>
        <div
          v-else
          class="hidden sm:flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-700/60 text-[11px] text-emerald-300 font-bold"
        >
          <span>👑 Đã đại mốc tối đa</span>
        </div>
      </div>
    </div>

    <!-- Thanh tiến trình tổng quan -->
    <div class="space-y-1.5">
      <div class="flex items-center justify-between text-[11px] text-[#869b8f]">
        <span>Tiến trình hoàn thành: <strong class="text-amber-200">{{ completedMilestonesCount }}/10 Mốc</strong></span>
        <span class="font-mono text-amber-300 font-bold">{{ overallProgressPercent }}%</span>
      </div>
      <div class="w-full h-2 rounded-full bg-[#0a110e] border border-[#203129] overflow-hidden p-[1px]">
        <div
          class="h-full rounded-full bg-gradient-to-r from-emerald-600 via-amber-500 to-amber-300 transition-all duration-500 ease-out shadow-sm"
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
              ? 'reached-card bg-gradient-to-b from-[#182820] to-[#121c17] border-amber-500/70 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
              : 'locked-card bg-[#0e1613] border-[#22332a] opacity-80 hover:opacity-100 hover:border-[#334c3e]',
          ]"
        >
          <!-- Huy hiệu góc khi đã đạt -->
          <div
            v-if="isMilestoneReached(item.points)"
            class="absolute top-0 right-0 w-8 h-8 pointer-events-none overflow-hidden"
          >
            <div
              class="absolute transform rotate-45 bg-amber-500/80 text-[8px] font-bold text-black py-0.5 right-[-20px] top-[4px] w-[55px] text-center uppercase tracking-tighter"
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
                    ? 'bg-amber-950 text-amber-300 border border-amber-600/60'
                    : 'bg-[#182620] text-[#788e82] border border-[#273a30]'
                "
              >
                Mốc {{ item.level }}
              </span>

              <span
                class="font-mono text-[11px] font-bold"
                :class="isMilestoneReached(item.points) ? 'text-amber-300' : 'text-[#849a8e]'"
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
                    ? 'bg-[#22352b] border border-amber-400/80 scale-105'
                    : 'bg-[#141e1a] border border-[#26372e] grayscale opacity-70'
                "
              >
                {{ item.icon }}
              </div>
              <h4
                class="m-0 text-xs font-serif font-bold truncate max-w-full"
                :class="isMilestoneReached(item.points) ? 'text-amber-100' : 'text-[#a2b5ab]'"
              >
                {{ item.title }}
              </h4>
            </div>

            <!-- Mô tả phần thưởng -->
            <div
              class="mt-2 p-1.5 rounded bg-[#09100d] border text-[11px] text-center leading-tight min-h-[38px] flex items-center justify-center"
              :class="isMilestoneReached(item.points) ? 'border-amber-900/60 text-amber-200/90' : 'border-[#1b2922] text-[#718579]'"
            >
              <span>{{ item.reward }}</span>
            </div>
          </div>

          <!-- Trạng thái mốc -->
          <div class="mt-3 pt-2 border-t border-[#1c2c24] text-center">
            <span
              v-if="isMilestoneReached(item.points)"
              class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300"
            >
              <span class="text-xs">✓</span> Đã hoàn thành
            </span>
            <span
              v-else
              class="inline-block text-[10px] text-[#72857a] font-medium"
            >
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
  mask-image: linear-gradient(
    to right,
    black 0%,
    black calc(100% - 16px),
    transparent 100%
  );
}

.no-scrollbar::-webkit-scrollbar {
  height: 6px;
}

.no-scrollbar::-webkit-scrollbar-track {
  background: #0d1512;
  border-radius: 4px;
}

.no-scrollbar::-webkit-scrollbar-thumb {
  background: #2b3d33;
  border-radius: 4px;
}

.no-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #466153;
}
</style>
