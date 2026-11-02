<script setup lang="ts">
import { computed, ref } from "vue";
import Modal from "../../shared/Modal.vue";
import Tab from "../../shared/Tab.vue";

type Reward = {
  name: string;
  icon: string;
  amount?: number;
};

type HourReward = {
  hour: number;
  reward: Reward;
  claimed: boolean;
};

type MonthReward = {
  day: number;
  freeReward: Reward;
  passReward: Reward;
  freeClaimed: boolean;
  passClaimed: boolean;
  unlocked: boolean;
};

const tabs = [
  { key: "hourly", label: "Điểm danh theo giờ" },
  { key: "daily", label: "Điểm danh ngày" },
];
const activeTab = ref("hourly");

// Mock data for trying the attendance UI before connecting it to a repository.
const hourlyRewards = ref<HourReward[]>([
  { hour: 7, reward: { name: "Mồi câu", icon: "🪱", amount: 5 }, claimed: true },
  { hour: 8, reward: { name: "Xu", icon: "🪙", amount: 250 }, claimed: false },
  { hour: 9, reward: { name: "Phao may mắn", icon: "🎈", amount: 1 }, claimed: false },
]);

const mockItems: Reward[] = [
  { name: "Mồi câu", icon: "🪱", amount: 3 },
  { name: "Xu", icon: "🪙", amount: 150 },
  { name: "Năng lượng", icon: "⚡", amount: 2 },
  { name: "Rương ngư cụ", icon: "🎁", amount: 1 },
  { name: "Phao may mắn", icon: "🎈", amount: 1 },
];

const currentDay = 12;
const monthRewards = ref<MonthReward[]>(
  Array.from({ length: 30 }, (_, index) => {
    const day = index + 1;
    return {
      day,
      freeReward: mockItems[(day - 1) % mockItems.length],
      passReward: mockItems[(day + 1) % mockItems.length],
      freeClaimed: day < currentDay,
      passClaimed: day < currentDay && day % 3 === 0,
      unlocked: day <= currentDay,
    };
  }),
);

const randomDailyReward = ref<Reward | null>(null);
const claimedHourlyCount = computed(() => hourlyRewards.value.filter((entry) => entry.claimed).length);

function claimHourly(entry: HourReward) {
  if (entry.claimed) return;
  entry.claimed = true;
}

function claimDailyReward() {
  if (randomDailyReward.value) return;
  randomDailyReward.value = mockItems[Math.floor(Math.random() * mockItems.length)];
}

function claimMonthReward(day: MonthReward, lane: "free" | "pass") {
  if (!day.unlocked) return;
  if (lane === "free") day.freeClaimed = true;
  else day.passClaimed = true;
}
</script>

<template>
  <Modal title="Điểm danh" sub-title="Quà mỗi giờ, mỗi ngày và mỗi tháng">
    <div class="mx-auto max-w-6xl">
      <Tab v-model="activeTab" :tabs="tabs" aria-label="Loại điểm danh">
        <template #hourly>
          <section class="space-y-5">
            <div class="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 class="m-0 text-lg font-extrabold text-[#24352a]">Khung giờ hôm nay</h3>
                <p class="mb-0 mt-1 text-sm text-emerald-900/65">Đăng nhập vào các mốc 7h, 8h và 9h để nhận quà.</p>
              </div>
              <span class="rounded-full bg-[#f5f9f0] px-3 py-1 text-xs font-bold text-[#24352a]">
                Đã nhận {{ claimedHourlyCount }}/{{ hourlyRewards.length }}
              </span>
            </div>

            <div class="grid gap-3 sm:grid-cols-3">
              <article
                v-for="entry in hourlyRewards"
                :key="entry.hour"
                class="rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] p-4 shadow-sm"
              >
                <div class="flex items-center justify-between">
                  <span class="rounded-lg bg-white px-3 py-1 text-sm font-black text-[#24352a]">{{ entry.hour }}:00</span>
                  <span v-if="entry.claimed" class="text-xs font-bold text-emerald-700">Đã nhận ✓</span>
                  <span v-else class="text-xs font-bold text-amber-700">Chưa nhận</span>
                </div>
                <div class="my-6 text-center">
                  <div class="text-5xl" aria-hidden="true">{{ entry.reward.icon }}</div>
                  <p class="mb-0 mt-2 font-extrabold text-[#24352a]">{{ entry.reward.name }}</p>
                  <p class="mb-0 mt-1 text-sm text-emerald-900/65">×{{ entry.reward.amount }}</p>
                </div>
                <button
                  type="button"
                  class="w-full rounded-xl px-4 py-2.5 text-sm font-extrabold transition"
                  :class="entry.claimed ? 'cursor-default bg-white text-emerald-800' : 'bg-emerald-700 text-white hover:bg-emerald-800'"
                  :disabled="entry.claimed"
                  @click="claimHourly(entry)"
                >
                  {{ entry.claimed ? "Đã nhận" : "Nhận quà" }}
                </button>
              </article>
            </div>
          </section>
        </template>

        <template #daily>
          <section class="space-y-5">
            <div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] p-4 sm:p-5">
              <div>
                <h3 class="m-0 text-lg font-extrabold text-[#24352a]">Quà điểm danh ngày</h3>
                <p class="mb-0 mt-1 text-sm text-emerald-900/65">Mỗi ngày nhận ngẫu nhiên một vật phẩm.</p>
              </div>
              <button
                type="button"
                class="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-800 disabled:cursor-default disabled:bg-emerald-900/40"
                :disabled="!!randomDailyReward"
                @click="claimDailyReward"
              >
                {{ randomDailyReward ? "Đã điểm danh hôm nay" : "Điểm danh nhận quà" }}
              </button>
            </div>

            <div v-if="randomDailyReward" class="flex items-center gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-4" role="status">
              <span class="text-4xl" aria-hidden="true">{{ randomDailyReward.icon }}</span>
              <div>
                <p class="m-0 text-xs font-bold uppercase tracking-wide text-amber-800">Bạn nhận được</p>
                <p class="mb-0 mt-1 font-extrabold text-[#24352a]">{{ randomDailyReward.name }}<span v-if="randomDailyReward.amount"> ×{{ randomDailyReward.amount }}</span></p>
              </div>
            </div>

            <div class="rounded-2xl border border-[#cbd9c6] bg-white p-3 sm:p-5">
              <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 class="m-0 text-lg font-extrabold text-[#24352a]">Thẻ điểm danh tháng 11</h3>
                  <p class="mb-0 mt-1 text-xs text-emerald-900/60">Mở khóa quà theo tiến độ điểm danh trong tháng.</p>
                </div>
                <span class="rounded-full bg-[#f5f9f0] px-3 py-1 text-xs font-bold text-[#24352a]">Ngày {{ currentDay }}/30</span>
              </div>

              <div class="grid grid-cols-[3.25rem_repeat(5,minmax(4.5rem,1fr))] gap-1.5 sm:grid-cols-[5rem_repeat(6,minmax(0,1fr))] sm:gap-2">
                <div class="flex items-center justify-center rounded-lg bg-amber-100 px-1 py-2 text-center text-[10px] font-black uppercase leading-tight text-amber-900 sm:text-xs">
                  Fishing<br class="sm:hidden" /> Pass
                </div>
                <div
                  v-for="day in monthRewards"
                  :key="`pass-${day.day}`"
                  class="min-w-0 rounded-lg border p-1 text-center sm:p-2"
                  :class="day.unlocked ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50 opacity-60'"
                >
                  <span class="block text-[9px] font-bold text-amber-900/75 sm:text-[10px]">{{ day.day }}</span>
                  <span class="my-1 block text-xl sm:text-2xl" :aria-label="day.passReward.name">{{ day.passReward.icon }}</span>
                  <button
                    type="button"
                    class="w-full rounded-md px-1 py-1 text-[9px] font-extrabold leading-tight sm:text-[10px]"
                    :class="day.passClaimed ? 'bg-white text-amber-800' : day.unlocked ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-slate-200 text-slate-500'"
                    :disabled="!day.unlocked || day.passClaimed"
                    @click="claimMonthReward(day, 'pass')"
                  >{{ day.passClaimed ? "Đã nhận" : day.unlocked ? "Nhận" : "Khóa" }}</button>
                </div>

                <div class="flex items-center justify-center rounded-lg bg-emerald-100 px-1 py-2 text-center text-[10px] font-black uppercase leading-tight text-emerald-900 sm:text-xs">
                  Miễn<br class="sm:hidden" /> phí
                </div>
                <div
                  v-for="day in monthRewards"
                  :key="`free-${day.day}`"
                  class="min-w-0 rounded-lg border p-1 text-center sm:p-2"
                  :class="day.unlocked ? 'border-emerald-200 bg-[#f5f9f0]' : 'border-slate-200 bg-slate-50 opacity-60'"
                >
                  <span class="block text-[9px] font-bold text-emerald-900/75 sm:text-[10px]">{{ day.day }}</span>
                  <span class="my-1 block text-xl sm:text-2xl" :aria-label="day.freeReward.name">{{ day.freeReward.icon }}</span>
                  <button
                    type="button"
                    class="w-full rounded-md px-1 py-1 text-[9px] font-extrabold leading-tight sm:text-[10px]"
                    :class="day.freeClaimed ? 'bg-white text-emerald-800' : day.unlocked ? 'bg-emerald-700 text-white hover:bg-emerald-800' : 'bg-slate-200 text-slate-500'"
                    :disabled="!day.unlocked || day.freeClaimed"
                    @click="claimMonthReward(day, 'free')"
                  >{{ day.freeClaimed ? "Đã nhận" : day.unlocked ? "Nhận" : "Khóa" }}</button>
                </div>
              </div>
              <p class="mb-0 mt-3 text-xs text-emerald-900/60">Hàng Fishing Pass yêu cầu sở hữu pass tháng; hàng Miễn phí dành cho tất cả người chơi. (Mock giao diện)</p>
            </div>
          </section>
        </template>
      </Tab>
    </div>
  </Modal>
</template>
