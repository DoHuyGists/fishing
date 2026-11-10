<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import Modal from "../../shared/Modal.vue";
import Tab from "../../shared/Tab.vue";
import { useCurrencyStore } from "../../../stores/currency.ts";
import { supabaseCurrencyRepository } from "../../../data/supabaseCurrencyRepository.ts";
import { useToast } from "../../../composables/useToast.ts";
import FishingPassPurchaseModal from "./FishingPassPurchaseModal.vue";
import FishingPassRewards from "./FishingPassRewards.vue";
import DailyAttendance from "./DailyAttendance.vue";
import { useFishingPassStore } from "../../../stores/fishingPass";

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
const fishingPassStore = useFishingPassStore();

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
const monthRewards = computed(() => [] as MonthReward[]);

async function loadData() {
  if (isClaimingDailyReward.value || fishingPassStore.isBuying) return;
  now.value = new Date();
  try {
    await fishingPassStore.fetchCurrentPass();
  } catch {
    // The store exposes the loading error in the pass panel.
  }
  try {
    const nextClaimAt = await supabaseCurrencyRepository.getNextDailyRewardAt();
    nextClaimDailyRewardAt.value = nextClaimAt ? new Date(nextClaimAt) : null;
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Không thể tải trạng thái điểm danh.", { title: "Tải thất bại", position: "bottom" });
  }
}

onMounted(() => {
  void loadData();
  clockInterval = setInterval(() => {
    now.value = new Date();
  }, 30_000);
});
onUnmounted(() => { if (clockInterval) clearInterval(clockInterval); });

async function claimDailyReward() {
  if ((nextClaimDailyRewardAt.value && now.value < nextClaimDailyRewardAt.value) || isClaimingDailyReward.value) return;
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
function claimMonthReward(_day: MonthReward, _lane: "free" | "pass") { /* Claims require a server-side reward endpoint. */ }
</script>

<template>
  <Modal title="Điểm danh" sub-title="Quà mỗi ngày và mỗi tháng" :on-refresh="loadData">
    <div class="w-full">
      <Tab v-model="activeTab" :tabs="tabs" aria-label="Loại điểm danh">
        <template #daily>
          <DailyAttendance :reward="dailyRewardToday" :next-claim-at="nextClaimDailyRewardAt" :is-claiming="isClaimingDailyReward" @claim="claimDailyReward" />
        </template>

        <template #monthly>
          <section class="space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 class="m-0 text-lg font-extrabold text-[#24352a]">Thẻ điểm danh {{ currentMonthLabel }}</h3>
                <p class="mb-0 mt-1 text-sm text-emerald-900/60">Phần thưởng Fishing Pass cần mua pass để mở khóa</p>
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
