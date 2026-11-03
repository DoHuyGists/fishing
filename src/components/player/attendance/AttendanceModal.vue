<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import Modal from "../../shared/Modal.vue";
import Tab from "../../shared/Tab.vue";
import { useCurrencyStore } from "../../../stores/currency.ts";
import { supabaseCurrencyRepository } from "../../../data/supabaseCurrencyRepository.ts";
import { useToast } from "../../../composables/useToast.ts";
import FishingPassPurchaseModal from "./FishingPassPurchaseModal.vue";
import FishingPassRewards from "./FishingPassRewards.vue";

type Reward = { name: string; icon: string; amount?: number };
type MonthReward = { day: number; freeReward: Reward; passReward: Reward; freeClaimed: boolean; passClaimed: boolean; unlocked: boolean };

const tabs = [
  { key: "daily", label: "Điểm danh ngày" },
  { key: "monthly", label: "Điểm danh tháng" },
];
const activeTab = ref("daily");
const currencyStore = useCurrencyStore();
const toast = useToast();
const showPassConfirm = ref(false);
const mockItems: Reward[] = [
  { name: "Mồi câu", icon: "🪱", amount: 3 },
  { name: "Xu", icon: "🪙", amount: 150 },
  { name: "Năng lượng", icon: "⚡", amount: 2 },
  { name: "Rương ngư cụ", icon: "🎁", amount: 1 },
  { name: "Phao may mắn", icon: "🎈", amount: 1 },
];

const now = ref(new Date());
let clockInterval: ReturnType<typeof setInterval> | undefined;
const dateKey = (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
const todayKey = computed(() => dateKey(now.value));
const currentDay = computed(() => now.value.getDate());
const daysInMonth = computed(() => new Date(now.value.getFullYear(), now.value.getMonth() + 1, 0).getDate());
const currentMonthLabel = computed(() => now.value.toLocaleDateString("vi-VN", { month: "long", year: "numeric" }));

const dailyReward = ref<{ date: string; reward: Reward } | null>(null);
const dailyRewardToday = computed(() => dailyReward.value?.date === todayKey.value ? dailyReward.value.reward : null);
const nextClaimDailyRewardAt = ref<Date | null>(null);
const isClaimingDailyReward = ref(false);
const canClaimDailyReward = computed(() => !nextClaimDailyRewardAt.value || now.value >= nextClaimDailyRewardAt.value);
const monthRewards = ref<MonthReward[]>([]);
const claimedMonth = ref("");

function resetForDateChange() {
  const monthKey = `${now.value.getFullYear()}-${now.value.getMonth() + 1}`;
  if (claimedMonth.value !== monthKey) {
    claimedMonth.value = monthKey;
    monthRewards.value = Array.from({ length: daysInMonth.value }, (_, index) => {
      const day = index + 1;
      return {
        day,
        freeReward: mockItems[(day - 1) % mockItems.length],
        passReward: mockItems[(day + 1) % mockItems.length],
        freeClaimed: false,
        passClaimed: false,
        unlocked: day <= currentDay.value,
      };
    });
  } else {
    monthRewards.value.forEach((entry) => { entry.unlocked = entry.day <= currentDay.value; });
  }
}

onMounted(async () => {
  resetForDateChange();
  try {
    const nextClaimAt = await supabaseCurrencyRepository.getNextDailyRewardAt();
    nextClaimDailyRewardAt.value = nextClaimAt ? new Date(nextClaimAt) : null;
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Không thể tải trạng thái điểm danh.", { title: "Tải thất bại", position: "bottom" });
  }
  clockInterval = setInterval(() => {
    now.value = new Date();
    resetForDateChange();
  }, 30_000);
});
onUnmounted(() => { if (clockInterval) clearInterval(clockInterval); });

async function claimDailyReward() {
  if (!canClaimDailyReward.value || isClaimingDailyReward.value) return;
  isClaimingDailyReward.value = true;
  try {
    const result = await supabaseCurrencyRepository.claimDailyReward();
    if (!result?.success) throw new Error(result?.message || "Không thể nhận phần thưởng hôm nay.");
    const item = result.item ?? {};
    dailyReward.value = {
      date: todayKey.value,
      reward: {
        name: item.name ?? item.item_name ?? "Phần thưởng hằng ngày",
        icon: item.icon ?? "🎁",
        amount: item.amount ?? item.quantity,
      },
    };
    nextClaimDailyRewardAt.value = result.next_claim_daily_reward_at ? new Date(result.next_claim_daily_reward_at) : new Date(Date.now() + 24 * 60 * 60 * 1000);
    await currencyStore.fetchCurrency();
    toast.success("Đã nhận phần thưởng điểm danh!", { title: "Thành công", position: "bottom" });
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Không thể nhận phần thưởng. Vui lòng thử lại.", { title: "Nhận thưởng thất bại", position: "bottom" });
  } finally {
    isClaimingDailyReward.value = false;
  }
}
function claimMonthReward(day: MonthReward, lane: "free" | "pass") {
  if (!day.unlocked) return;
  if (lane === "free") day.freeClaimed = true;
  else day.passClaimed = true;
}
</script>

<template>
  <Modal title="Điểm danh" sub-title="Quà mỗi ngày và mỗi tháng">
    <div class="mx-auto max-w-6xl">
      <Tab v-model="activeTab" :tabs="tabs" aria-label="Loại điểm danh">
        <template #daily>
          <section class="space-y-5">
            <div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] p-4 sm:p-5">
              <div>
                <h3 class="m-0 text-lg font-extrabold text-[#24352a]">Quà điểm danh ngày</h3>
                <p class="mb-0 mt-1 text-sm text-emerald-900/65">Mỗi ngày chỉ nhận một phần thưởng. Phần thưởng mới được mở khi sang ngày tiếp theo.</p>
              </div>
              <button type="button" class="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-800 disabled:cursor-default disabled:bg-emerald-900/40" :disabled="!canClaimDailyReward || isClaimingDailyReward" @click="claimDailyReward">
                {{ isClaimingDailyReward ? "Đang xử lý..." : canClaimDailyReward ? "Nhận thưởng" : "Chưa đến giờ nhận thưởng" }}
              </button>
            </div>
            <div v-if="dailyRewardToday" class="flex items-center gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-4" role="status">
              <span class="text-4xl" aria-hidden="true">{{ dailyRewardToday.icon }}</span>
              <div>
                <p class="m-0 text-xs font-bold uppercase tracking-wide text-amber-800">Bạn nhận được</p>
                <p class="mb-0 mt-1 font-extrabold text-[#24352a]">{{ dailyRewardToday.name }}<span v-if="dailyRewardToday.amount"> ×{{ dailyRewardToday.amount }}</span></p>
              </div>
            </div>
          </section>
        </template>

        <template #monthly>
          <section class="space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 class="m-0 text-lg font-extrabold text-[#24352a]">Thẻ điểm danh {{ currentMonthLabel }}</h3>
                <p class="mb-0 mt-1 text-sm text-emerald-900/60">Hàng Fishing Pass cần mua pass để mở khóa; hàng miễn phí nhận theo từng ngày.</p>
              </div>
              <span class="rounded-full bg-[#f5f9f0] px-3 py-1 text-xs font-bold text-[#24352a]">Ngày {{ currentDay }}/{{ daysInMonth }}</span>
            </div>
            <FishingPassRewards v-model:show-pass-confirm="showPassConfirm" :month-rewards="monthRewards" @claim="claimMonthReward($event, 'free')" />
          </section>
        </template>
      </Tab>
    </div>
  </Modal>
  <FishingPassPurchaseModal v-if="showPassConfirm" @close="showPassConfirm = false" />
</template>
