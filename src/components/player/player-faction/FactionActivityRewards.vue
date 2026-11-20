<script setup lang="ts">
import type { FactionActivityRewardsProps as Props } from "../../../types/model/faction";
import type { ActivityMilestone } from "../../../types/model/factionActivityMilestones";
import { t as tr } from "../../../i18n";

import { computed } from "vue";
import { FACTION_ACTIVITY_MILESTONES } from "../../../data/factionActivityMilestones.ts";
import Hint from "../../shared/Hint.vue";

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
    class="slide-fade-in from-bottom player-content-in activity-section rounded-xl border border-border-default bg-surface text-content p-4 sm:p-5 shadow-lg space-y-4"
  >
    <!-- Header của Section Năng Động -->
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border-default pb-3">
      <div class="flex items-center gap-2.5">
        <span class="text-lg text-content">⚡</span>
        <div>
          <div class="m-0 text-xs sm:text-sm font-bold uppercase tracking-wider font-serif text-content">
            {{ tr('FactionActivityRewards.phan_thuong_nang_dong_hang_ngay') }}
          </div>
          <div class="m-0 text-[11px] text-content-subtle">{{ tr('FactionActivityRewards.tich_luy_hoat_dong_trong_ngay_de_mo_khoa_10_moc_ban_thuong') }}</div>
        </div>
      </div>

      <!-- Huy hiệu điểm & Tiến độ mốc tiếp theo -->
      <div class="flex flex-col items-end gap-2 text-xs">
        <div class="px-3 py-1 rounded-full bg-surface-hover border border-border-default flex items-center gap-1.5 shadow-sm">
          <span class="text-content font-bold font-serif">{{ tr('FactionActivityRewards.diem') }}</span>
          <span class="font-bold text-content font-mono text-sm sm:text-base">{{ safeCurrentPoints }}</span>
          <span class="text-content-subtle text-[11px]">/ {{ maxPoints }}</span>
          <Hint :text="tr('FactionActivityRewards.diem_co_the_thu_thap_tu_hoat_dong_cau_ca')" />
        </div>

        <div
          v-if="nextMilestone"
          class="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-hover border border-border-default text-[11px] text-content"
        >
          <span class="text-content-subtle">{{ tr('FactionActivityRewards.can_them') }} {{ nextMilestone.points - safeCurrentPoints }} {{ tr('FactionActivityRewards.diem_2') }}</span>
          <span>{{ tr('FactionActivityRewards.de_dat_moc_ke_tiep') }}</span>
          <strong class="text-content">{{ tr('FactionActivityRewards.moc') }} {{ nextMilestone.level }}</strong>
        </div>
        <div
          v-else
          class="hidden sm:flex items-center gap-1 px-3 py-1 rounded-full bg-surface border border-accent text-[11px] text-content font-bold"
        >
          <span>{{ tr('FactionActivityRewards.da_dai_moc_toi_da') }}</span>
        </div>
      </div>
    </div>

    <!-- Thanh tiến trình tổng quan -->
    <div class="space-y-1.5">
      <div class="flex items-center justify-between text-[11px] text-content-subtle">
        <span
          >{{ tr('FactionActivityRewards.tien_trinh_hoan_thanh') }} <strong class="text-content">{{ completedMilestonesCount }}{{ tr('FactionActivityRewards.10_moc') }}</strong></span
        >
        <span class="font-mono text-content font-bold">{{ overallProgressPercent }}%</span>
      </div>
      <div class="w-full h-2 rounded-full bg-surface border border-border-default overflow-hidden p-[1px]">
        <div
          class="h-full rounded-full bg-linear-to-r from-accent via-accent to-accent transition-all duration-500 ease-out shadow-sm"
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
              ? 'reached-card bg-gradient-to-b from-surface to-surface-hover border-accent/70 shadow-[0_0_12px_color-mix(in_srgb,_var(--color-accent)_12%,_transparent)]'
              : 'locked-card bg-surface-hover border-border-default opacity-90 hover:opacity-100 hover:border-content-disabled',
          ]"
        >
          <!-- Huy hiệu góc khi đã đạt -->
          <div
            v-if="isMilestoneReached(item.points)"
            class="absolute top-0 right-0 w-8 h-8 pointer-events-none overflow-hidden"
          >
            <div
              class="absolute transform rotate-45 bg-accent text-[8px] font-bold text-white py-0.5 right-[-20px] top-[4px] w-[55px] text-center uppercase tracking-tighter"
            >
              {{ tr('FactionActivityRewards.dat') }}
            </div>
          </div>

          <!-- Header thẻ mốc: Số thứ tự mốc & Điểm yêu cầu -->
          <div>
            <div class="flex items-center justify-between gap-1 mb-2">
              <span
                class="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase font-serif tracking-wider"
                :class="
                  isMilestoneReached(item.points)
                    ? 'bg-surface text-content border border-accent'
                    : 'bg-surface text-content border border-border-default'
                "
              >
                {{ tr('FactionActivityRewards.moc') }} {{ item.level }}
              </span>

              <span
                class="font-mono text-[11px] font-bold"
                :class="isMilestoneReached(item.points) ? 'text-content' : 'text-content-subtle'"
              >
                {{ item.points }} {{ tr('FactionActivityRewards.d') }}
              </span>
            </div>

            <!-- Icon & Tên mốc -->
            <div class="flex flex-col items-center text-center my-1.5">
              <div
                class="size-11 rounded-full flex items-center justify-center text-2xl mb-1.5 transition-transform duration-200 select-none inset-shadow-sm"
                :class="
                  isMilestoneReached(item.points)
                    ? 'bg-surface-selected border border-accent/80 scale-105'
                    : 'bg-surface border border-border-default grayscale opacity-70'
                "
              >
                {{ item.icon }}
              </div>
              <div
                class="m-0 text-xs font-serif font-bold truncate max-w-full"
                :class="isMilestoneReached(item.points) ? 'text-content' : 'text-content'"
              >
                {{ item.title }}
              </div>
            </div>

            <!-- Mô tả phần thưởng -->
            <div
              class="mt-2 p-1.5 rounded bg-surface border text-[11px] text-center leading-tight min-h-[38px] flex items-center justify-center"
              :class="
                isMilestoneReached(item.points)
                  ? 'border-accent text-content'
                  : 'border-border-default text-content-subtle'
              "
            >
              <span>{{ item.reward }}</span>
            </div>
          </div>

          <!-- Trạng thái mốc -->
          <div class="mt-3 pt-2 border-t border-border-default text-center">
            <span
              v-if="isMilestoneReached(item.points)"
              class="inline-flex items-center gap-1 text-[11px] font-bold text-content"
            >
              <span class="text-xs">✓</span> {{ tr('FactionActivityRewards.da_hoan_thanh') }}
            </span>
            <span v-else class="inline-block text-[10px] text-content-subtle font-medium">
              {{ tr('FactionActivityRewards.can_them_2') }} {{ item.points - safeCurrentPoints }} {{ tr('FactionActivityRewards.d_2') }}
            </span>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.milestones-track-wrapper {
  mask-image: linear-gradient(to right, var(--color-content) 0%, var(--color-content) calc(100% - 16px), transparent 100%);
}

.no-scrollbar::-webkit-scrollbar {
  height: 6px;
}

.no-scrollbar::-webkit-scrollbar-track {
  background: var(--color-surface);
  border-radius: 4px;
}

.no-scrollbar::-webkit-scrollbar-thumb {
  background: var(--color-surface);
  border-radius: 4px;
}

.no-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--color-content-disabled);
}
</style>
