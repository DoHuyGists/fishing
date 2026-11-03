<script setup lang="ts">
import { useFishingPassStore } from "../../../stores/fishingPass";

type Reward = { name: string; icon: string; amount?: number };
type MonthReward = { day: number; freeReward: Reward; passReward: Reward; freeClaimed: boolean; passClaimed: boolean; unlocked: boolean };

defineProps<{ monthRewards: MonthReward[] }>();
const emit = defineEmits<{ claim: [day: MonthReward] }>();
const fishingPassStore = useFishingPassStore();
const showPassConfirm = defineModel<boolean>("showPassConfirm", { required: true });
</script>

<template>
  <section class="space-y-4">
    <div class="overflow-x-auto rounded-2xl border border-[#cbd9c6] bg-white p-3 sm:p-5">
      <div class="min-w-max space-y-2">
        <div class="flex w-max gap-2">
          <div class="sticky left-0 z-10 flex w-24 shrink-0 flex-col items-center justify-center gap-2 rounded-lg bg-amber-100 px-2 text-center text-xs font-black uppercase text-amber-900">
            <span>Fishing Pass</span>
            <button v-if="!fishingPassStore.hasFishingPass" type="button" class="rounded-md bg-amber-700 px-2 py-1 text-[10px] font-extrabold normal-case text-white hover:bg-amber-800" @click="showPassConfirm = true">Mua pass</button>
            <span v-else class="text-[10px] normal-case text-emerald-800">Đã sở hữu</span>
          </div>
          <article v-for="day in monthRewards" :key="`pass-${day.day}`" class="w-24 shrink-0 rounded-lg border p-2 text-center" :class="day.unlocked ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50 opacity-60'">
            <span class="block text-[10px] font-bold text-amber-900/75">Ngày {{ day.day }}</span>
            <span class="my-2 block text-2xl" :aria-label="day.passReward.name">{{ day.passReward.icon }}</span>
            <p class="mb-2 text-[10px] font-semibold text-[#24352a]">{{ day.passReward.name }} ×{{ day.passReward.amount }}</p>
            <span class="flex h-7 items-center justify-center text-slate-500" :aria-label="day.passClaimed ? 'Đã nhận' : 'Khóa Fishing Pass'" :title="day.passClaimed ? 'Đã nhận' : 'Cần có Fishing Pass để nhận'">
              <svg v-if="!day.passClaimed" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2" /><path stroke-linecap="round" stroke-linejoin="round" d="M8 10V7a4 4 0 1 1 8 0v3" /></svg>
              <span v-else class="text-xs font-extrabold text-amber-800">✓</span>
            </span>
          </article>
        </div>
        <div class="flex w-max gap-2">
          <div class="sticky left-0 z-10 flex w-24 shrink-0 items-center justify-center rounded-lg bg-emerald-100 px-2 text-center text-xs font-black uppercase text-emerald-900">Miễn phí</div>
          <article v-for="day in monthRewards" :key="`free-${day.day}`" class="w-24 shrink-0 rounded-lg border p-2 text-center" :class="day.unlocked ? 'border-emerald-200 bg-[#f5f9f0]' : 'border-slate-200 bg-slate-50 opacity-60'">
            <span class="block text-[10px] font-bold text-emerald-900/75">Ngày {{ day.day }}</span>
            <span class="my-2 block text-2xl" :aria-label="day.freeReward.name">{{ day.freeReward.icon }}</span>
            <p class="mb-2 text-[10px] font-semibold text-[#24352a]">{{ day.freeReward.name }} ×{{ day.freeReward.amount }}</p>
            <button type="button" class="w-full rounded-md px-1 py-1.5 text-[10px] font-extrabold" :class="day.freeClaimed ? 'bg-white text-emerald-800' : day.unlocked ? 'bg-emerald-700 text-white hover:bg-emerald-800' : 'bg-slate-200 text-slate-500'" :disabled="!day.unlocked || day.freeClaimed" @click="emit('claim', day)">{{ day.freeClaimed ? "Đã nhận" : day.unlocked ? "Nhận" : "Khóa" }}</button>
          </article>
        </div>
      </div>
    </div>
    <aside class="rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] p-4 sm:p-5" aria-labelledby="fishing-pass-info-title">
      <h4 id="fishing-pass-info-title" class="m-0 text-base font-extrabold text-[#24352a]">Thông tin Fishing Pass</h4>
      <p class="mb-0 mt-2 text-sm text-emerald-900/75">Fishing Pass chỉ cần mua một lần với giá <strong>{{ fishingPassStore.price }} vỏ sò</strong>. Khi đã sở hữu pass, bạn có thể nhận thêm phần thưởng ở hàng Fishing Pass vào từng ngày được mở khóa.</p>
      <p class="mb-0 mt-2 text-sm text-emerald-900/75">Cách nhận: mỗi ngày, nhận quà ở hàng miễn phí bằng nút <strong>Nhận</strong>; nếu đã có Fishing Pass, chạm biểu tượng ổ khóa ở hàng Fishing Pass để nhận quà của ngày đó. Ngày chưa tới sẽ chưa mở khóa.</p>
    </aside>
  </section>
</template>
