<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useMissionStore } from "../../stores/mission";
import { useCaughtStore, type CaughtFish } from "../../stores/caught";
import { useToast } from "../../composables/useToast.ts";
import Modal from "../Modal.vue";
import CaughtFishList from "./CaughtFishList.vue";
import MissionList from "./MissionList.vue";

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

const selectedMission = computed(() =>
  missionStore.missions.find((mission) => mission.id === selectedMissionId.value) ?? null,
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
  return requirements.length > 0 && requirements.every(
    ([fishId, required]) => (selectedFishCounts.value.get(fishId) ?? 0) >= required,
  );
});

function canSelectCaught(caught: CaughtFish) {
  const fishId = caught.species.id;
  return (selectedFishCounts.value.get(fishId) ?? 0) < (requiredFishCounts.value.get(fishId) ?? 0);
}

function toggleCaught(caught: CaughtFish) {
  if(caught.status === 'on-market'){
    toast.error("Con này đang ở được bày bán", {title: "Không thể chọn",position: 'bottom'});
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
    statusMessage.value = initialLoad ? "" : "Đã làm mới dữ liệu.";
  } catch (error) {
    statusIsError.value = true;
    statusMessage.value = error instanceof Error ? error.message : "Không thể tải dữ liệu nhiệm vụ.";
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
    toast.success(`Nhận ${reward}`, { title: "Nhiệm vụ hoàn tất", position: "bottom" });
  } catch (error) {
    statusIsError.value = true;
    statusMessage.value = error instanceof Error ? error.message : "Không thể nhận nhiệm vụ.";
  } finally {
    isClaiming.value = false;
  }
}

onMounted(() => void loadMissionData(true));
</script>

<template>
  <Modal title="Bảng nhiệm vụ" sub-title="Nhiệm vụ theo giờ" :on-refresh="loadMissionData">
    <div v-if="isLoading || isRefreshing" class="h-full grid place-items-center text-sm text-emerald-900/70">
      Đang tải cá và nhiệm vụ...
    </div>
    <div v-else class="grid grid-rows-[minmax(0,1fr)_minmax(0,1fr)] md:grid-rows-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] h-full flex-1">
      <CaughtFishList
        :caught-fishes="caughtStore.caughtFishes"
        :selected-caught-ids="selectedCaughtIds"
        :required-fish-counts="requiredFishCounts"
        :selected-fish-counts="selectedFishCounts"
        @toggle="toggleCaught"
      />
      <MissionList
        :missions="missionStore.missions"
        :selected-mission="selectedMission"
        :selected-mission-id="selectedMissionId"
        :selected-caught-ids="selectedCaughtIds"
        :required-fish-counts="requiredFishCounts"
        :selected-fish-counts="selectedFishCounts"
        :status-message="statusMessage"
        :status-is-error="statusIsError"
        :is-mission-complete="isMissionComplete"
        :is-claiming="isClaiming"
        @select="selectMission"
        @claim="claimMission"
      />
    </div>
  </Modal>
</template>
