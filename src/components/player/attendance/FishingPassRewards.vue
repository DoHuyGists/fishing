<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useFishingPassStore } from "../../../stores/fishingPass";
import { useToast } from "../../../composables/useToast";

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

async function claimReward(rewardId: string) {
  if (claimingRewardId.value) return;
  claimingRewardId.value = rewardId;
  try {
    await fishingPassStore.claimReward(rewardId);
    toast.success("Đã nhận phần thưởng Fishing Pass.", { title: "Thành công", position: "bottom" });
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Không thể nhận phần thưởng. Vui lòng thử lại.", { title: "Nhận thưởng thất bại", position: "bottom" });
  } finally {
    claimingRewardId.value = null;
  }
}
</script>

<template>
  <section class="space-y-4">
    <div v-if="fishingPassStore.loading" class="rounded-2xl border border-[#cbd9c6] bg-white p-6 text-center text-sm text-[#24352a]">Đang tải Fishing Pass...</div>
    <div v-else-if="fishingPassStore.loadError" class="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{{ fishingPassStore.loadError }}</div>
    <div v-else-if="!fishingPassStore.currentPass" class="rounded-2xl border border-[#cbd9c6] bg-white p-6 text-center text-sm text-[#24352a]">Hiện chưa có Fishing Pass đang diễn ra.</div>
    <template v-else>
      <div class="overflow-x-auto rounded-2xl border border-[#cbd9c6] bg-white p-3 sm:p-5">
        <div class="min-w-max space-y-2">
          <div class="flex w-max gap-2">
            <div class="sticky left-0 z-10 flex w-24 shrink-0 flex-col items-center justify-center gap-2 rounded-lg bg-amber-100 px-2 text-center text-xs font-black uppercase text-amber-900">
              <span>Fishing Pass</span>
              <button v-if="!fishingPassStore.hasFishingPass" type="button" class="rounded-md bg-amber-700 px-2 py-1 text-[10px] font-extrabold normal-case text-white hover:bg-amber-800" @click="showPassConfirm = true">Mua pass</button>
              <span v-else class="text-[10px] normal-case text-emerald-800">Đã sở hữu</span>
            </div>
            <article v-for="day in rewardsByDay" :key="`pass-${day.day}`" class="w-24 shrink-0 rounded-lg border p-2 text-center" :class="day.unlocked ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50 opacity-60'">
              <span class="block text-[10px] font-bold text-amber-900/75">Ngày {{ day.day }}</span>
              <template v-if="day.passReward">
                <img v-if="day.passReward.item?.image" :src="day.passReward.item.image" :alt="day.passReward.item.name" class="mx-auto my-2 h-8 w-8 object-contain" />
                <span v-else class="my-2 block text-2xl" :aria-label="day.passReward.item?.name">{{ day.passReward.item?.icon || "🎁" }}</span>
                <p class="mb-2 text-[10px] font-semibold text-[#24352a]">{{ day.passReward.item?.name || "Phần thưởng" }} ×{{ day.passReward.quantity }}</p>
              </template>
              <span v-else class="my-2 block text-[10px] text-slate-500">Chưa có quà</span>
              <div class="flex h-7 items-center justify-center">
                <span v-if="day.passReward?.claimed_at" class="text-[10px] font-bold text-emerald-700" :title="`Đã nhận lúc ${new Date(day.passReward.claimed_at).toLocaleString('vi-VN')}`">Đã nhận</span>
                <button v-else-if="day.passReward && day.unlocked && fishingPassStore.hasFishingPass" type="button" class="rounded-md bg-amber-700 px-2 py-1 text-[10px] font-bold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50" :disabled="claimingRewardId !== null" @click="claimReward(day.passReward.id)">{{ claimingRewardId === day.passReward.id ? "Đang nhận..." : "Nhận" }}</button>
                <span v-else-if="!fishingPassStore.hasFishingPass" class="text-slate-500" aria-label="Khóa Fishing Pass" title="Cần có Fishing Pass để nhận"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2" /><path stroke-linecap="round" stroke-linejoin="round" d="M8 10V7a4 4 0 1 1 8 0v3" /></svg></span>
                <span v-else class="text-[10px] font-bold text-slate-500">Chưa mở</span>
              </div>
            </article>
          </div>
          <div class="flex w-max gap-2">
            <div class="sticky left-0 z-10 flex w-24 shrink-0 items-center justify-center rounded-lg bg-emerald-100 px-2 text-center text-xs font-black uppercase text-emerald-900">Miễn phí</div>
            <article v-for="day in rewardsByDay" :key="`free-${day.day}`" class="w-24 shrink-0 rounded-lg border p-2 text-center" :class="day.unlocked ? 'border-emerald-200 bg-[#f5f9f0]' : 'border-slate-200 bg-slate-50 opacity-60'">
              <span class="block text-[10px] font-bold text-emerald-900/75">Ngày {{ day.day }}</span>
              <template v-if="day.freeReward">
                <img v-if="day.freeReward.item?.image" :src="day.freeReward.item.image" :alt="day.freeReward.item.name" class="mx-auto my-2 h-8 w-8 object-contain" />
                <span v-else class="my-2 block text-2xl" :aria-label="day.freeReward.item?.name">{{ day.freeReward.item?.icon || "🎁" }}</span>
                <p class="mb-2 text-[10px] font-semibold text-[#24352a]">{{ day.freeReward.item?.name || "Phần thưởng" }} ×{{ day.freeReward.quantity }}</p>
              </template>
              <span v-else class="my-2 block text-[10px] text-slate-500">Chưa có quà</span>
              <div class="flex h-7 items-center justify-center">
                <button v-if="day.freeReward && day.unlocked && !day.freeReward.claimed_at" type="button" class="rounded-md bg-emerald-700 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50" :disabled="claimingRewardId !== null" @click="claimReward(day.freeReward.id)">{{ claimingRewardId === day.freeReward.id ? "Đang nhận..." : "Nhận" }}</button>
                <span v-else-if="day.freeReward?.claimed_at" class="text-[10px] font-bold text-emerald-700">Đã nhận</span>
                <span v-else class="text-[10px] font-bold text-slate-500">{{ day.unlocked ? "Đang mở" : "Khóa" }}</span>
              </div>
            </article>
          </div>
        </div>
      </div>
      <aside class="rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] p-4 sm:p-5" aria-labelledby="fishing-pass-info-title">
        <h4 id="fishing-pass-info-title" class="m-0 text-base font-extrabold text-[#24352a]">{{ fishingPassStore.currentPass.name }}</h4>
        <p v-if="fishingPassStore.currentPass.description" class="mb-0 mt-2 text-sm text-emerald-900/75">{{ fishingPassStore.currentPass.description }}</p>
        <p class="mb-0 mt-2 text-sm text-emerald-900/75">Fishing Pass có giá <strong>{{ fishingPassStore.price }} vỏ sò</strong>. Thời gian: {{ new Date(fishingPassStore.currentPass.start_at).toLocaleDateString("vi-VN") }} – {{ new Date(fishingPassStore.currentPass.end_at).toLocaleDateString("vi-VN") }}.</p>
      </aside>
    </template>
  </section>
</template>
