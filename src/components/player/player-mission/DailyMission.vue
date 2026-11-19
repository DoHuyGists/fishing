<script setup lang="ts">
import { getFormattingLocale } from "../../../i18n";
import { t as tr } from "../../../i18n";

import { onMounted, ref } from "vue";
import { useMissionStore } from "../../../stores/player-mission-store.ts";
import { useToast } from "../../../composables/useToast.ts";
import { useMilestoneTrack } from "../../../composables/useMilestoneTrack.ts";

const missionStore = useMissionStore();
const toast = useToast();
const isLoading = ref(true);
const errorMessage = ref("");
const { trackElement, trackHeight, filledHeight } = useMilestoneTrack(
  () => missionStore.dailyRewardMilestones.map((reward) => reward.required_points),
  () => missionStore.dailyMissions?.total_points ?? 0,
);

async function loadDailyMissions() {
  isLoading.value = true;
  errorMessage.value = "";
  try {
    await missionStore.setDailyMissions();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : tr("DailyMission.khong_the_tai_nhiem_vu_hang_ngay");
  } finally {
    isLoading.value = false;
  }
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(getFormattingLocale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function rewardLabel(value: unknown) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const reward = value as Record<string, unknown>;
    const name = reward.name ?? reward.item_name ?? reward.type ?? tr("FishingPassRewards.phan_thuong");
    const quantity = reward.quantity ?? reward.amount;
    return quantity === undefined
      ? String(name)
      : tr("DailyMission.value0_value1", { value0: String(name), value1: String(quantity) });
  }
  return tr("FishingPassRewards.phan_thuong");
}

function rewardVisual(value: unknown) {
  if (!value || typeof value !== "object") return { image: "", icon: "🎁" };
  const reward = value as Record<string, unknown>;
  const image = reward.image ?? reward.icon_url ?? reward.image_url;
  const icon = reward.icon;
  return {
    image: typeof image === "string" ? image : "",
    icon: typeof icon === "string" && icon.length <= 8 ? icon : "🎁",
  };
}

function difficultyLabel(difficulty: string) {
  switch (difficulty.toUpperCase()) {
    case "EASY":
      return tr("DailyMission.difficulty_easy");
    case "MEDIUM":
      return tr("DailyMission.difficulty_medium");
    case "HARD":
      return tr("DailyMission.difficulty_hard");
    default:
      return difficulty;
  }
}

async function claimReward(rewardId: string) {
  try {
    if (await missionStore.claimDailyMissionReward(rewardId)) {
      toast.success(tr("AttendanceModal.thanh_cong"));
    }
  } catch (error) {
    toast.error(error instanceof Error ? error.message : tr("DailyMission.khong_the_nhan_thuong"), {
      get title() {
        return tr("DailyMission.khong_the_nhan_thuong");
      },
    });
  }
}

onMounted(() => void loadDailyMissions());
</script>

<template>
  <section
    class="mx-auto flex h-full min-h-0 w-full flex-col gap-3 overflow-y-auto px-1 text-[#24352a] lg:overflow-hidden py-1.5"
  >
    <div v-if="isLoading" class="rounded-xl border border-[#cbd9c6] bg-white p-6 text-center text-sm">
      {{ tr("DailyMission.dang_tai_nhiem_vu_hang_ngay") }}
    </div>
    <div
      v-else-if="errorMessage"
      role="alert"
      class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
    >
      {{ errorMessage }}
      <button type="button" class="ml-2 font-bold underline" @click="loadDailyMissions">
        {{ tr("Maintenance.thu_lai") }}
      </button>
    </div>
    <template v-else-if="missionStore.dailyMissions">
      <header
        class="slide-fade-in from-top player-content-in shrink-0 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] px-3 py-2 sm:px-4"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div class="m-0 text-base font-extrabold">{{ tr("DailyMission.nhiem_vu_hang_ngay") }}</div>
            <div class="mb-0 mt-0.5 text-xs capitalize text-emerald-900/65">
              {{ formatDate(missionStore.dailyMissions.mission_date) }}
            </div>
          </div>
          <div class="flex items-baseline gap-1.5 rounded-lg bg-white px-3 py-1.5">
            <strong class="text-xl tabular-nums">{{ missionStore.dailyMissions.total_points }}</strong>
            <span class="text-xs text-emerald-900/65">{{ tr("DailyMission.diem_nhiem_vu") }}</span>
          </div>
        </div>
      </header>

      <div class="grid shrink-0 gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(260px,0.9fr)_minmax(0,2fr)] xl:gap-4">
        <section
          :aria-label="tr('DailyMission.moc_thuong')"
          class="slide-fade-in from-left player-content-in order-1 flex min-h-0 min-w-0 flex-col gap-2 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-3 lg:overflow-y-auto xl:p-4"
        >
          <div class="flex items-end justify-between gap-2">
            <div>
              <div class="m-0 text-sm font-extrabold">{{ tr("DailyMission.moc_thuong") }}</div>
            </div>
            <span class="text-xs font-bold text-emerald-800"
              >{{ missionStore.dailyMissions.total_points }} {{ tr("DailyMission.diem") }}</span
            >
          </div>
          <div v-if="missionStore.dailyMissions.rewards.length" class="py-1">
            <div ref="trackElement" class="relative m-0 flex flex-col gap-2 pb-0 pt-6">
              <div
                aria-hidden="true"
                class="pointer-events-none absolute left-4 top-0 w-1 overflow-hidden rounded-full bg-emerald-950/10"
                :style="{ height: `${trackHeight}px` }"
              >
                <div
                  class="w-full rounded-full bg-emerald-600 transition-[height] motion-reduce:transition-none"
                  :style="{ height: `${filledHeight}px` }"
                />
              </div>
              <div
                v-for="reward in missionStore.dailyRewardMilestones"
                :key="reward.id"
                data-milestone
                class="relative pl-10"
              >
                <span
                  class="absolute left-1.5 top-1/2 z-10 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white shadow-sm"
                  :class="reward.is_unlocked ? 'bg-emerald-600' : 'bg-[#cbd9c6]'"
                >
                  <span v-if="reward.is_claimed" class="text-xs font-black text-white">✓</span>
                </span>
                <article
                  class="rounded-lg border p-2 transition-colors xl:p-2.5"
                  :class="reward.is_unlocked ? 'border-emerald-300 bg-white shadow-sm' : 'border-[#cbd9c6] bg-white/70'"
                >
                  <div class="mb-1.5 flex items-center justify-between gap-2">
                    <strong class="text-xs">{{ reward.required_points }} {{ tr("DailyMission.diem") }}</strong>
                    <span
                      class="rounded-full px-2 py-0.5 text-[10px] font-bold"
                      :class="
                        reward.is_claimed || reward.is_unlocked
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-[#f5f9f0] text-emerald-900/55'
                      "
                    >
                      {{
                        reward.is_claimed
                          ? tr("AttendanceModal.da_nhan")
                          : reward.is_unlocked
                            ? tr("DailyMission.da_mo_khoa")
                            : tr("FishingPassRewards.chua_mo")
                      }}
                    </span>
                  </div>
                  <div v-if="reward.reward_data?.length" class="flex flex-wrap gap-1.5">
                    <div
                      v-for="(item, itemIndex) in reward.reward_data"
                      :key="itemIndex"
                      class="group relative flex size-8 items-center justify-center rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] p-1 xl:size-9"
                      :title="rewardLabel(item)"
                    >
                      <img
                        v-if="rewardVisual(item).image"
                        :src="rewardVisual(item).image"
                        :alt="rewardLabel(item)"
                        class="size-full object-contain"
                      />
                      <span v-else class="text-xl" aria-hidden="true">{{ rewardVisual(item).icon }}</span>
                      <span
                        class="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden w-max max-w-48 -translate-x-1/2 rounded-md bg-[#24352a] px-2 py-1 text-[10px] text-white group-hover:block group-focus-within:block"
                        >{{ rewardLabel(item) }}</span
                      >
                    </div>
                  </div>
                  <div v-else class="m-0 text-xs text-emerald-900/55">
                    {{ tr("DailyMission.phan_thuong_theo_moc") }}
                  </div>
                  <button
                    v-if="reward.can_claim"
                    type="button"
                    :disabled="!!missionStore.claimingDailyRewardId"
                    :aria-busy="missionStore.claimingDailyRewardId === reward.id"
                    class="mt-2 w-full rounded-lg bg-emerald-700 px-2 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                    @click="claimReward(reward.id)"
                  >
                    {{
                      missionStore.claimingDailyRewardId === reward.id
                        ? tr("FishingPassRewards.dang_nhan")
                        : tr("DailyAttendance.nhan_thuong")
                    }}
                  </button>
                  <div v-else-if="!reward.is_unlocked" class="mb-0 mt-2 text-[10px] text-emerald-900/55">
                    {{ tr("Fishfarm.con") }}
                    {{ Math.max(0, reward.required_points - missionStore.dailyMissions.total_points) }}
                    {{ tr("DailyMission.diem") }}
                  </div>
                </article>
              </div>
            </div>
          </div>
          <div v-else class="m-0 rounded-xl bg-white/70 p-4 text-center text-xs text-emerald-900/55">
            {{ tr("DailyMission.chua_co_moc_thuong") }}
          </div>
        </section>

        <section
          :aria-label="tr('DailyMission.danh_sach_nhiem_vu')"
          class="order-2 flex min-h-0 min-w-0 flex-col gap-2"
        >
          <div class="m-0 text-sm font-extrabold">
            {{ tr("DailyMission.tien_do_nhiem_vu") }}
            <span class="font-medium text-emerald-900/60"
              >({{ missionStore.completedDailyMissionCount }}/{{ missionStore.dailyMissions.missions.length }})</span
            >
          </div>
          <div class="min-h-0 flex-1 space-y-2 pb-1 pr-2 lg:overflow-y-auto">
            <article
              v-for="mission in missionStore.dailyMissionProgress"
              :key="mission.id"
              class="slide-fade-in from-bottom player-content-in rounded-lg border p-2.5 xl:p-3"
              :class="mission.isTargetReached ? 'border-emerald-300 bg-[#f5f9f0]' : 'border-[#cbd9c6] bg-white'"
            >
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <div class="m-0 text-xs font-bold">{{ mission.name }}</div>
                    <span class="rounded-full bg-[#f5f9f0] px-2 py-0.5 text-[10px] font-bold">{{
                      difficultyLabel(mission.difficulty)
                    }}</span>
                  </div>
                  <div class="mb-0 mt-0.5 text-xs text-emerald-900/65">{{ mission.description }}</div>
                </div>
                <span class="shrink-0 text-xs font-bold"
                  >{{ mission.mission_points }} {{ tr("DailyMission.diem") }}</span
                >
              </div>
              <div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                <div
                  role="progressbar"
                  :aria-label="mission.name"
                  :aria-valuenow="mission.progressPercent"
                  :aria-valuemin="0"
                  :aria-valuemax="100"
                  class="h-1.5 min-w-12 flex-1 overflow-hidden rounded-full bg-emerald-950/10"
                >
                  <div class="h-full rounded-full bg-emerald-600" :style="{ width: `${mission.progressPercent}%` }" />
                </div>
                <span class="text-xs tabular-nums"
                  >{{ Math.min(mission.current_value, mission.target_value) }}/{{ mission.target_value }}</span
                >
                <span v-if="mission.isTargetReached" class="text-[10px] font-bold text-emerald-700"
                  >✓ {{ tr("FlipBook.hoan_thanh") }}</span
                >
              </div>
            </article>
            <div
              v-if="!missionStore.dailyMissions.missions.length"
              class="rounded-xl bg-[#f5f9f0] p-5 text-center text-sm"
            >
              {{ tr("DailyMission.hom_nay_chua_co_nhiem_vu") }}
            </div>
          </div>
        </section>
      </div>
    </template>
  </section>
</template>
