<script setup lang="ts">
import { getFormattingLocale } from '../../../i18n';
import { t as tr } from "../../../i18n";

import { computed, onMounted, onUnmounted, ref } from "vue";
import { useFishingPassStore } from "../../../stores/fishingPass";
import { useToast } from "../../../composables/useToast";
import Shells from "../currency/Shells.vue";
import { formatDateTime } from "../../../utils/time";

const fishingPassStore = useFishingPassStore();
const toast = useToast();
const claimingRewardId = ref<string | null>(null);
const now = ref(Date.now());
const showPassConfirm = defineModel<boolean>("showPassConfirm", { required: true });
let clockInterval: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  clockInterval = setInterval(() => { now.value = Date.now(); }, 60_000);
});
onUnmounted(() => {
  if (clockInterval) clearInterval(clockInterval);
});

const unlockedThroughDay = computed(() => {
  const startAt = fishingPassStore.currentPass?.start_at;
  if (!startAt) return 0;
  const start = new Date(startAt).getTime();
  if (!Number.isFinite(start) || now.value < start) return 0;
  return Math.floor((now.value - start) / (24 * 60 * 60 * 1000)) + 1;
});

const rewardsByDay = computed(() => {
  const rows = fishingPassStore.currentPass?.rewards ?? [];
  return Array.from({ length: fishingPassStore.currentPass?.total_days ?? 0 }, (_, index) => {
    const day = index + 1;
    return {
      day,
      freeReward: rows.find((reward) => reward.day_number === day && reward.reward_type === "FREE"),
      passReward: rows.find((reward) => reward.day_number === day && reward.reward_type === "PREMIUM"),
      unlocked: day <= unlockedThroughDay.value,
    };
  });
});

function scrollRewardsHorizontally(event: WheelEvent) {
  if (event.ctrlKey || event.shiftKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;

  const container = event.currentTarget as HTMLElement;
  const maxScrollLeft = container.scrollWidth - container.clientWidth;
  if (maxScrollLeft <= 0 || !event.cancelable) return;

  const deltaScale = event.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? 16
    : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? container.clientWidth : 1;
  const nextScrollLeft = Math.min(maxScrollLeft, Math.max(0, container.scrollLeft + event.deltaY * deltaScale));
  if (nextScrollLeft === container.scrollLeft) return;

  event.preventDefault();
  container.scrollLeft = nextScrollLeft;
}

async function claimReward(rewardId: string) {
  if (claimingRewardId.value) return;
  claimingRewardId.value = rewardId;
  try {
    await fishingPassStore.claimReward(rewardId);
    toast.success(tr('FishingPassRewards.da_nhan_phan_thuong_fishing_pass'), { get title() { return tr('AttendanceModal.thanh_cong'); } });
  } catch (err) {
    toast.error(err instanceof Error ? err.message : tr('AttendanceModal.khong_the_nhan_phan_thuong_vui_long_thu_lai'), { get title() { return tr('AttendanceModal.nhan_thuong_that_bai'); } });
  } finally {
    claimingRewardId.value = null;
  }
}
</script>

<template>
  <section class="space-y-4">
    <div v-if="fishingPassStore.loading" class="rounded-2xl border border-[#cbd9c6] bg-white p-6 text-center text-sm text-[#24352a]">{{ tr('FishingPassRewards.dang_tai_fishing_pass') }}</div>
    <div v-else-if="fishingPassStore.loadError" class="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{{ fishingPassStore.loadError }}</div>
    <div v-else-if="!fishingPassStore.currentPass" class="rounded-2xl border border-[#cbd9c6] bg-white p-6 text-center text-sm text-[#24352a]">{{ tr('FishingPassRewards.hien_chua_co_fishing_pass_dang_dien_ra') }}</div>
    <template v-else>
      <div class="flex gap-2">
        <div class="min-w-0 overflow-x-auto rounded-2xl border border-[#cbd9c6] bg-white p-3 sm:p-5" @wheel="scrollRewardsHorizontally">
          <div class="min-w-max space-y-2">
            <div class="flex w-max gap-2">
              <div class="sticky left-0 z-10 flex w-24 shrink-0 items-center justify-center rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-2 py-2 text-center text-xs font-black text-[#24352a]">{{ tr('FishingPassRewards.ngay_nhan') }}</div>
              <div v-for="day in rewardsByDay" :key="`day-${day.day}`" class="w-24 shrink-0 rounded-lg border px-2 py-2 text-center text-xs font-bold text-[#24352a]" :class="day.unlocked ? 'border-[#cbd9c6] bg-[#f5f9f0]' : 'border-slate-200 bg-slate-50 text-slate-500'">{{
                tr('FishingPassRewards.ngay') }} {{ day.day }}</div>
            </div>
            <div class="flex w-max gap-2">
              <div class="sticky left-0 z-10 flex w-24 shrink-0 flex-col items-center justify-center gap-2 rounded-lg bg-amber-100 px-2 text-center text-xs font-black uppercase text-amber-900">
                <span>Fishing Pass</span>
                <button v-if="!fishingPassStore.hasFishingPass" type="button" class="rounded-md bg-amber-700 px-2 py-1 text-[10px] font-extrabold normal-case text-white hover:bg-amber-800" @click="showPassConfirm = true">{{ tr('FishingPassRewards.mua_pass') }}</button>
                <span v-else class="text-[10px] normal-case text-emerald-800">{{ tr('FishingPassRewards.da_so_huu') }}</span>
              </div>
              <article v-for="day in rewardsByDay" :key="`pass-${day.day}`" class="w-24 shrink-0 rounded-lg border p-2 text-center" :class="day.unlocked ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50 opacity-60'">
                <template v-if="day.passReward">
                  <img v-if="day.passReward.item?.image" :src="day.passReward.item.image" :alt="day.passReward.item.name" class="mx-auto my-2 h-8 w-8 object-contain" />
                  <span v-else class="my-2 block text-2xl" :aria-label="day.passReward.item?.name">{{ day.passReward.item?.icon || "🎁" }}</span>
                  <div class="mb-2 text-[10px] font-semibold text-[#24352a]">{{ day.passReward.item?.name || tr('FishingPassRewards.phan_thuong') }} ×{{ day.passReward.quantity }}</div>
                </template>
                <span v-else class="my-2 block text-[10px] text-slate-500">{{ tr('FishingPassRewards.chua_co_qua') }}</span>
                <div class="flex h-7 items-center justify-center">
                  <span v-if="day.passReward?.claimed_at" class="text-[10px] font-bold text-emerald-700" :title="tr('FishingPassRewards.da_nhan_luc_value0', { value0: new Date(day.passReward.claimed_at).toLocaleString(getFormattingLocale()) })">{{ tr('AttendanceModal.da_nhan') }}</span>
                  <button v-else-if="day.passReward && day.unlocked && fishingPassStore.hasFishingPass" type="button" class="rounded-md bg-amber-700 px-2 py-1 text-[10px] font-bold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50" :disabled="claimingRewardId !== null"
                    @click="claimReward(day.passReward.id)">{{ claimingRewardId === day.passReward.id ? tr('FishingPassRewards.dang_nhan') : tr('FishingPassRewards.nhan') }}</button>
                  <span v-else-if="!fishingPassStore.hasFishingPass" class="text-slate-500" :aria-label="tr('FishingPassRewards.khoa_fishing_pass')" :title="tr('FishingPassRewards.can_co_fishing_pass_de_nhan')"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2" class="h-4 w-4" aria-hidden="true">
                      <rect x="4" y="10" width="16" height="11" rx="2" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M8 10V7a4 4 0 1 1 8 0v3" />
                    </svg></span>
                  <span v-else class="text-[10px] font-bold text-slate-500">{{ tr('FishingPassRewards.chua_mo') }}</span>
                </div>
              </article>
            </div>
            <div class="flex w-max gap-2">
              <div class="sticky left-0 z-10 flex w-24 shrink-0 items-center justify-center rounded-lg bg-emerald-100 px-2 text-center text-xs font-black uppercase text-emerald-900">{{ tr('FishingPassRewards.mien_phi') }}</div>
              <article v-for="day in rewardsByDay" :key="`free-${day.day}`" class="w-24 shrink-0 rounded-lg border p-2 text-center" :class="day.unlocked ? 'border-emerald-200 bg-[#f5f9f0]' : 'border-slate-200 bg-slate-50 opacity-60'">
                <template v-if="day.freeReward">
                  <img v-if="day.freeReward.item?.image" :src="day.freeReward.item.image" :alt="day.freeReward.item.name" class="mx-auto my-2 h-8 w-8 object-contain" />
                  <span v-else class="my-2 block text-2xl" :aria-label="day.freeReward.item?.name">{{ day.freeReward.item?.icon || "🎁" }}</span>
                  <div class="mb-2 text-[10px] font-semibold text-[#24352a]">{{ day.freeReward.item?.name || tr('FishingPassRewards.phan_thuong') }} ×{{ day.freeReward.quantity }}</div>
                </template>
                <span v-else class="my-2 block text-[10px] text-slate-500">{{ tr('FishingPassRewards.chua_co_qua') }}</span>
                <div class="flex h-7 items-center justify-center">
                  <button v-if="day.freeReward && day.unlocked && !day.freeReward.claimed_at" type="button" class="rounded-md bg-emerald-700 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50" :disabled="claimingRewardId !== null"
                    @click="claimReward(day.freeReward.id)">{{ claimingRewardId === day.freeReward.id ? tr('FishingPassRewards.dang_nhan') : tr('FishingPassRewards.nhan') }}</button>
                  <span v-else-if="day.freeReward?.claimed_at" class="text-[10px] font-bold text-emerald-700">{{ tr('AttendanceModal.da_nhan') }}</span>
                  <span v-else class="text-[10px] font-bold text-slate-500">{{ day.unlocked ? tr('FishingPassRewards.dang_mo') : tr('FishingPassRewards.khoa') }}</span>
                </div>
              </article>
            </div>
          </div>
        </div>
        <aside class="rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] px-5 py-3" aria-labelledby="fishing-pass-info-title">
          <div class="mb-0 mt-2 text-sm text-emerald-900/75 space-y-3">
            <div id="fishing-pass-info-title" class="text-base font-extrabold text-[#24352a]">{{ fishingPassStore.currentPass.name }}</div>
            <div v-if="fishingPassStore.currentPass.description" class="text-sm text-emerald-900/75">{{ fishingPassStore.currentPass.description }}</div>
            <div class="flex items-center gap-1">
              <div>{{ tr('FishingPassRewards.fishing_pass_co_gia') }}</div>
              <Shells :amount="fishingPassStore.price" />
            </div>
            <div>{{ tr('FishingPassRewards.thoi_gian') }} <span class="bg-white p-1 rounded-2xl">{{ formatDateTime(fishingPassStore.currentPass.start_at) }}</span> – <span class="bg-white p-1 rounded-2xl">{{ formatDateTime(fishingPassStore.currentPass.end_at) }}</span></div>
          </div>
        </aside>
      </div>
    </template>
  </section>
</template>
