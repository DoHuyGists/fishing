<script lang="ts" setup>
import { t as tr } from "../../../i18n";

import { computed, onMounted, ref } from "vue";
import { useMissionStore } from "../../../stores/mission.ts";
import { useCaughtStore, type CaughtFish } from "../../../stores/caught.ts";
import { useToast } from "../../../composables/useToast.ts";
import Modal from "../../shared/Modal.vue";
import Tab from "../../shared/Tab.vue";
import type { TabItem } from "../../shared/Tab.vue";
import CaughtFishList from "./CaughtFishList.vue";
import MissionList from "./MissionList.vue";
import DailyMission from "./DailyMission.vue";

const missionStore = useMissionStore();
const caughtStore = useCaughtStore();
const toast = useToast();
const selectedMissionId = ref("");
const selectedCaughtIds = ref<string[]>([]);
const isLoading = ref(true);
const isRefreshing = ref(false);
const isClaiming = ref(false);
const statusMessage = ref("");
const statusIsError = ref(false);
const activeTab = ref("hourly");
const tabs: TabItem[] = [
  { key: "hourly", get label() { return tr('MissionModal.nhiem_vu_theo_gio'); } },
  { key: "daily", get label() { return tr('DailyMission.nhiem_vu_hang_ngay'); } },
];

const selectedMission = computed(
  () => missionStore.missions.find((mission) => mission.id === selectedMissionId.value) ?? null,
);
const requiredFishCounts = computed(() => {
  const counts = new Map<string, number>();
  for (const fish of selectedMission.value?.content ?? []) {
    counts.set(fish.id, (counts.get(fish.id) ?? 0) + 1);
  }
  return counts;
});
const selectedFishCounts = computed(() => {
  const counts = new Map<string, number>();
  for (const caughtId of selectedCaughtIds.value) {
    const caught = caughtStore.caughtFishes.find((item) => item.id === caughtId);
    if (caught?.species.id) {
      counts.set(caught.species.id, (counts.get(caught.species.id) ?? 0) + 1);
    }
  }
  return counts;
});
const isMissionComplete = computed(() => {
  const requirements = [...requiredFishCounts.value.entries()];
  return (
    requirements.length > 0 &&
    requirements.every(([fishId, required]) => (selectedFishCounts.value.get(fishId) ?? 0) >= required)
  );
});

function canSelectCaught(caught: CaughtFish) {
  const fishId = caught.species.id;
  return (selectedFishCounts.value.get(fishId) ?? 0) < (requiredFishCounts.value.get(fishId) ?? 0);
}

function toggleCaught(caught: CaughtFish) {
  if (caught.status === "on-market") {
    toast.error(tr('MissionModal.con_nay_dang_o_duoc_bay_ban'), { get title() { return tr('MissionModal.khong_the_chon'); } });
    return;
  }

  if (selectedCaughtIds.value.includes(caught.id)) {
    selectedCaughtIds.value = selectedCaughtIds.value.filter((id) => id !== caught.id);
  } else if (canSelectCaught(caught)) {
    selectedCaughtIds.value = [...selectedCaughtIds.value, caught.id];
  }
}

function selectMission(missionId: string) {
  selectedMissionId.value = missionId;
  selectedCaughtIds.value = [];
  statusMessage.value = "";
}

async function loadMissionData(initialLoad = false) {
  if (initialLoad) isLoading.value = true;
  else isRefreshing.value = true;

  try {
    await Promise.all([missionStore.SetMission(), caughtStore.loadCaughtFishes()]);
    if (!missionStore.missions.some((mission) => mission.id === selectedMissionId.value)) {
      selectedMissionId.value = missionStore.missions[0]?.id ?? "";
    }
    selectedCaughtIds.value = [];
    statusIsError.value = false;
    statusMessage.value = initialLoad ? "" : tr('MissionModal.da_lam_moi_du_lieu');
  } catch (error) {
    statusIsError.value = true;
    statusMessage.value = error instanceof Error ? error.message : tr('MissionModal.khong_the_tai_du_lieu_nhiem_vu');
  } finally {
    if (initialLoad) isLoading.value = false;
    else isRefreshing.value = false;
  }
}

async function claimMission() {
  if (!selectedMission.value || !isMissionComplete.value || isClaiming.value) return;
  isClaiming.value = true;
  statusMessage.value = "";
  try {
    const reward = selectedMission.value.cash ?? 0;
    await missionStore.ClaimMission(selectedMission.value.id, selectedCaughtIds.value);
    statusIsError.value = false;
    statusMessage.value = "";
    selectedCaughtIds.value = [];
    await Promise.all([caughtStore.loadCaughtFishes(), missionStore.SetMission()]);
    toast.success(tr('MissionModal.nhan_value0', { value0: reward }), { get title() { return tr('MissionModal.nhiem_vu_hoan_tat'); } });
  } catch (error) {
    statusIsError.value = true;
    statusMessage.value = error instanceof Error ? error.message : tr('MissionModal.khong_the_nhan_nhiem_vu');
  } finally {
    isClaiming.value = false;
  }
}

onMounted(() => void loadMissionData(true));
</script>

<template>
  <Modal :title="tr('MissionModal.bang_nhiem_vu')" :sub-title="tr('MissionModal.nhiem_vu_theo_gio_va_hang_ngay')" :on-refresh="loadMissionData">
    <div class="h-full">
      <Tab v-model="activeTab" :tabs="tabs" :aria-label="tr('MissionModal.loai_nhiem_vu')" lazy>
        <template #hourly>
          <div v-if="isLoading || isRefreshing" class="grid h-full place-items-center text-sm text-emerald-900/70">
            {{ tr('MissionModal.dang_tai_ca_va_nhiem_vu') }}
          </div>
          <div v-else class="grid grid-rows-[minmax(0,1fr)_minmax(0,1fr)] md:grid-rows-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] h-full flex-1">
            <CaughtFishList :caught-fishes="caughtStore.caughtFishes" :selected-caught-ids="selectedCaughtIds" :required-fish-counts="requiredFishCounts" :selected-fish-counts="selectedFishCounts" @toggle="toggleCaught" />
            <MissionList :missions="missionStore.missions" :selected-mission="selectedMission" :selected-mission-id="selectedMissionId" :selected-caught-ids="selectedCaughtIds" :required-fish-counts="requiredFishCounts" :selected-fish-counts="selectedFishCounts" :status-message="statusMessage"
              :status-is-error="statusIsError" :is-mission-complete="isMissionComplete" :is-claiming="isClaiming" @select="selectMission" @claim="claimMission" />
          </div>
        </template>
        <template #daily>
          <DailyMission />
        </template>
      </Tab>
    </div>
  </Modal>
</template>
