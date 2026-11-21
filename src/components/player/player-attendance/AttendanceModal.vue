<script setup lang="ts">
import type { MonthReward } from "../../../types/model/attendance";
import { getFormattingLocale } from "../../../i18n";
import { t as tr } from "../../../i18n";

import { computed, onMounted, onUnmounted, ref } from "vue";
import Modal from "../../shared/Modal.vue";
import Tab from "../../shared/Tab.vue";
import { useAttendanceStore } from "../../../stores/player-attendance-store";
import { useToast } from "../../../composables/useToast.ts";
import FishingPassPurchaseModal from "./FishingPassPurchaseModal.vue";
import FishingPassRewards from "./FishingPassRewards.vue";
import DailyAttendance from "./DailyAttendance.vue";
import { useFishingPassStore } from "../../../stores/player-fishing-pass-store.ts";

const tabs = [
  {
    key: "daily",
    get label() {
      return tr("AttendanceModal.diem_danh_ngay");
    },
  },
  {
    key: "monthly",
    get label() {
      return tr("AttendanceModal.diem_danh_thang");
    },
  },
];
const activeTab = ref("daily");
const attendanceStore = useAttendanceStore();
const toast = useToast();
const showPassConfirm = ref(false);
const fishingPassStore = useFishingPassStore();

const now = ref(new Date());
let clockInterval: ReturnType<typeof setInterval> | undefined;
const dateKey = (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
const todayKey = computed(() => dateKey(now.value));
const currentMonthLabel = computed(() =>
  now.value.toLocaleDateString(getFormattingLocale(), { month: "long", year: "numeric" }),
);

const dailyRewardToday = computed(() => {
  const claimed = attendanceStore.dailyReward;
  return claimed && dateKey(new Date(claimed.claimedAt)) === todayKey.value ? claimed.reward : null;
});
const nextClaimDailyRewardAt = computed(() => attendanceStore.nextClaimAt ? new Date(attendanceStore.nextClaimAt) : null);
const monthRewards = computed(() => [] as MonthReward[]);

async function loadData() {
  if (attendanceStore.isClaimingDailyReward || fishingPassStore.isBuying) return;
  now.value = new Date();
  try {
    await fishingPassStore.fetchCurrentPass();
  } catch {
    // The store exposes the loading error in the pass panel.
  }
  try {
    await attendanceStore.fetchStatus();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : tr("AttendanceModal.khong_the_tai_trang_thai_diem_danh"), {
      get title() {
        return tr("AttendanceModal.tai_that_bai");
      },
    });
  }
}

onMounted(() => {
  void loadData();
  clockInterval = setInterval(() => {
    now.value = new Date();
  }, 30_000);
});
onUnmounted(() => {
  if (clockInterval) clearInterval(clockInterval);
});

async function claimDailyReward() {
  if ((nextClaimDailyRewardAt.value && now.value < nextClaimDailyRewardAt.value) || attendanceStore.isClaimingDailyReward) return;
  try {
    if (!await attendanceStore.claimDailyReward()) return;
    toast.success(tr("AttendanceModal.da_nhan_phan_thuong_diem_danh"), {
      get title() {
        return tr("AttendanceModal.thanh_cong");
      },
    });
  } catch (err) {
    toast.error(
      err instanceof Error ? err.message : tr("AttendanceModal.khong_the_nhan_phan_thuong_vui_long_thu_lai"),
      {
        get title() {
          return tr("AttendanceModal.nhan_thuong_that_bai");
        },
      },
    );
  }
}
function claimMonthReward(_day: MonthReward, _lane: "free" | "pass") {
  /* Claims require a server-side reward endpoint. */
}
</script>

<template>
  <Modal :title="tr('AttendanceModal.diem_danh')" :on-refresh="loadData">
    <div class="w-full">
      <Tab v-model="activeTab" :tabs="tabs" :aria-label="tr('AttendanceModal.loai_diem_danh')">
        <template #daily>
          <DailyAttendance
            :reward="dailyRewardToday"
            :next-claim-at="nextClaimDailyRewardAt"
            :is-claiming="attendanceStore.isClaimingDailyReward"
            @claim="claimDailyReward"
          />
        </template>

        <template #monthly>
          <section class="space-y-4 py-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="m-0 text-lg font-extrabold text-content">
                {{ tr("AttendanceModal.diem_danh") }} {{ currentMonthLabel }}
              </div>
              <span class="rounded-full bg-surface px-3 py-1 text-xs font-bold text-content"
                >{{ tr("AttendanceModal.da_nhan") }} {{ fishingPassStore.rewardProgress.claimed }}/{{
                  fishingPassStore.rewardProgress.total
                }}
                {{ tr("AttendanceModal.qua") }}</span
              >
            </div>
            <FishingPassRewards
              v-model:show-pass-confirm="showPassConfirm"
              :month-rewards="monthRewards"
              @claim="claimMonthReward($event, 'free')"
            />
          </section>
        </template>
      </Tab>
    </div>
  </Modal>
  <FishingPassPurchaseModal v-if="showPassConfirm" @close="showPassConfirm = false" />
</template>
