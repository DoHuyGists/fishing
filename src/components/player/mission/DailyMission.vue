<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useMissionStore } from "../../../stores/mission.ts";
import { useToast } from "../../../composables/useToast.ts";

const missionStore = useMissionStore();
const toast = useToast();
const isLoading = ref(true);
const errorMessage = ref("");

async function loadDailyMissions() {
  isLoading.value = true;
  errorMessage.value = "";
  try {
    await missionStore.setDailyMissions();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Không thể tải nhiệm vụ hằng ngày.";
  } finally {
    isLoading.value = false;
  }
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("vi-VN", {
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
    const name = reward.name ?? reward.item_name ?? reward.type ?? "Phần thưởng";
    const quantity = reward.quantity ?? reward.amount;
    return quantity === undefined ? String(name) : `${String(name)} ×${String(quantity)}`;
  }
  return "Phần thưởng";
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

function claimReward() {
  toast.error("Chưa có API nhận mốc thưởng nhiệm vụ hằng ngày.", {
    title: "Không thể nhận thưởng",
    position: "bottom",
  });
}

onMounted(() => void loadDailyMissions());
</script>

<template>
  <section class="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-1 text-[#24352a] sm:px-4 lg:h-[calc(100dvh-10rem)] lg:min-h-[400px] lg:px-6">
    <div v-if="isLoading" class="rounded-xl border border-[#cbd9c6] bg-white p-6 text-center text-sm">
      Đang tải nhiệm vụ hằng ngày...
    </div>
    <div v-else-if="errorMessage" role="alert" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      {{ errorMessage }}
      <button type="button" class="ml-2 font-bold underline" @click="loadDailyMissions">Thử lại</button>
    </div>
    <template v-else-if="missionStore.dailyMissions">
      <header class="shrink-0 rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] px-4 py-3 sm:px-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="m-0 text-lg font-extrabold">Nhiệm vụ hằng ngày</div>
            <div class="mb-0 mt-1 text-sm capitalize text-emerald-900/65">
              {{ formatDate(missionStore.dailyMissions.mission_date) }}
            </div>
          </div>
          <div class="flex items-baseline gap-2 rounded-xl bg-white px-4 py-2">
            <strong class="text-2xl tabular-nums">{{ missionStore.dailyMissions.total_points }}</strong>
            <span class="text-xs text-emerald-900/65">điểm nhiệm vụ</span>
          </div>
        </div>
      </header>

      <div class="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,2fr)] xl:gap-6">
      <section aria-label="Mốc thưởng" class="order-1 flex min-h-0 min-w-0 flex-col gap-3 rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] p-4 lg:overflow-y-auto xl:p-5">
        <div class="flex items-end justify-between gap-2">
          <div>
            <div class="m-0 text-sm font-extrabold">Mốc thưởng</div>
            <div class="mb-0 mt-1 text-xs text-emerald-900/60">Tích lũy điểm để nhận quà</div>
          </div>
          <span class="text-xs font-bold text-emerald-800">{{ missionStore.dailyMissions.total_points }} điểm</span>
        </div>
        <div v-if="missionStore.dailyMissions.rewards.length" class="relative flex-1 py-2">
          <div class="absolute bottom-5 left-[23px] top-5 w-1 rounded-full bg-emerald-950/10" />
          <div class="pointer-events-none absolute bottom-5 left-[23px] top-5 w-1 overflow-hidden rounded-full">
            <div class="w-full rounded-full bg-emerald-600 transition-[height]"
              :style="{ height: `${Math.max(0, Math.min(100, missionStore.dailyMissions.total_points / Math.max(...missionStore.dailyMissions.rewards.map((reward) => reward.required_points), 1) * 100))}%` }" />
          </div>
          <div class="relative m-0 flex min-h-full list-none flex-col justify-between gap-3 p-0">
            <div v-for="reward in missionStore.dailyMissions.rewards" :key="reward.id" class="relative pl-10">
              <span class="absolute left-[15px] top-4 z-10 flex size-[17px] items-center justify-center rounded-full border-2 border-white shadow-sm"
                :class="reward.is_unlocked ? 'bg-emerald-600' : 'bg-[#cbd9c6]'">
                <span v-if="reward.is_claimed" class="text-[9px] font-black text-white">✓</span>
              </span>
              <article class="rounded-xl border p-2.5 transition-colors xl:p-3"
                :class="reward.is_unlocked ? 'border-emerald-300 bg-white shadow-sm' : 'border-[#cbd9c6] bg-white/70'">
                <div class="mb-2 flex items-center justify-between gap-2">
                  <strong class="text-xs">{{ reward.required_points }} điểm</strong>
                  <span class="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    :class="reward.is_claimed || reward.is_unlocked ? 'bg-emerald-100 text-emerald-800' : 'bg-[#f5f9f0] text-emerald-900/55'">
                    {{ reward.is_claimed ? 'Đã nhận' : reward.is_unlocked ? 'Đã mở khóa' : 'Chưa mở' }}
                  </span>
                </div>
                <div v-if="reward.reward_data?.length" class="flex flex-wrap gap-2">
                  <div v-for="(item, itemIndex) in reward.reward_data" :key="itemIndex"
                    class="group relative flex size-10 items-center justify-center rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] p-1 xl:size-12"
                    :title="rewardLabel(item)">
                    <img v-if="rewardVisual(item).image" :src="rewardVisual(item).image" :alt="rewardLabel(item)" class="size-full object-contain" />
                    <span v-else class="text-2xl" aria-hidden="true">{{ rewardVisual(item).icon }}</span>
                    <span class="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden w-max max-w-48 -translate-x-1/2 rounded-md bg-[#24352a] px-2 py-1 text-[10px] text-white group-hover:block group-focus-within:block">{{ rewardLabel(item) }}</span>
                  </div>
                </div>
                <div v-else class="m-0 text-xs text-emerald-900/55">Phần thưởng theo mốc</div>
                <button v-if="reward.can_claim" type="button"
                  class="mt-2 w-full rounded-lg bg-emerald-700 px-2 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-800"
                  @click="claimReward">Nhận thưởng</button>
                <div v-else-if="!reward.is_unlocked" class="mb-0 mt-2 text-[10px] text-emerald-900/55">
                  Còn {{ Math.max(0, reward.required_points - missionStore.dailyMissions.total_points) }} điểm
                </div>
              </article>
            </div>
          </div>
        </div>
        <div v-else class="m-0 rounded-xl bg-white/70 p-4 text-center text-xs text-emerald-900/55">Chưa có mốc thưởng.</div>
      </section>

      <section aria-label="Danh sách nhiệm vụ" class="order-2 flex min-h-0 min-w-0 flex-col gap-3">
        <div class="m-0 text-sm font-extrabold">Tiến độ nhiệm vụ <span class="font-medium text-emerald-900/60">({{ missionStore.dailyMissions.missions.length }}/{{ missionStore.dailyMissions.mission_count }})</span></div>
        <div class="min-h-0 flex-1 space-y-3 overflow-y-auto pb-1 pr-2 lg:overflow-y-scroll">
        <article v-for="mission in missionStore.dailyMissions.missions" :key="mission.id"
          class="rounded-xl border border-[#cbd9c6] bg-white p-3.5 xl:p-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <div class="m-0 text-sm font-bold">{{ mission.name }}</div>
                <span class="rounded-full bg-[#f5f9f0] px-2 py-0.5 text-[10px] font-bold">{{ mission.difficulty }}</span>
              </div>
              <div class="mb-0 mt-1 text-sm text-emerald-900/65">{{ mission.description }}</div>
            </div>
            <span class="shrink-0 text-xs font-bold">{{ mission.mission_points }} điểm</span>
          </div>
          <div class="mt-3 flex items-center gap-3">
            <div class="h-2 flex-1 overflow-hidden rounded-full bg-emerald-950/10">
              <div class="h-full rounded-full bg-emerald-600" :style="{ width: `${Math.min(100, mission.target_value > 0 ? mission.current_value / mission.target_value * 100 : 0)}%` }" />
            </div>
            <span class="text-xs tabular-nums">{{ Math.min(mission.current_value, mission.target_value) }}/{{ mission.target_value }}</span>
            <span v-if="mission.is_completed" class="text-xs font-bold text-emerald-700">Hoàn thành</span>
          </div>
        </article>
        <div v-if="!missionStore.dailyMissions.missions.length" class="rounded-xl bg-[#f5f9f0] p-5 text-center text-sm">Hôm nay chưa có nhiệm vụ.</div>
        </div>
      </section>
      </div>
    </template>
  </section>
</template>
