<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useMissionStore } from "../../stores/mission";
import { useCaughtStore } from "../../stores/caught";
import Cash from "../currency/Cash.vue";
import Modal from "../Modal.vue";

const missionStore = useMissionStore();
const caughtStore = useCaughtStore();
const selectedMissionId = ref("");
const selectedCaughtIds = ref<string[]>([]);
const isLoading = ref(true);
const isRefreshing = ref(false);
const isClaiming = ref(false);
const statusMessage = ref("");
const statusIsError = ref(false);
const claimSuccess = ref(false);
const claimedReward = ref(0);
let claimSuccessTimer: ReturnType<typeof setTimeout> | null = null;

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
    if (caught?.species?.id) {
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

function isFishRequired(fishId: string | undefined) {
  return !!fishId && (requiredFishCounts.value.get(fishId) ?? 0) > 0;
}

function canSelectCaught(caught: any) {
  const fishId = caught.species.id;
  return !!fishId && (selectedFishCounts.value.get(fishId) ?? 0) < (requiredFishCounts.value.get(fishId) ?? 0);
}

function toggleCaught(caught: any) {
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
  if (initialLoad) {
    isLoading.value = true;
  } else {
    isRefreshing.value = true;
  }
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
    if (initialLoad) {
      isLoading.value = false;
    } else {
      isRefreshing.value = false;
    }
  }
}

onMounted(() => {
  void loadMissionData(true);
});

function showClaimSuccess(reward: number) {
  claimedReward.value = reward;
  claimSuccess.value = true;
  if (claimSuccessTimer) clearTimeout(claimSuccessTimer);
  claimSuccessTimer = setTimeout(() => {
    claimSuccess.value = false;
  }, 2500);
}

function closeClaimSuccess() {
  claimSuccess.value = false;
  if (claimSuccessTimer) clearTimeout(claimSuccessTimer);
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
    showClaimSuccess(reward);
  } catch (error) {
    statusIsError.value = true;
    statusMessage.value = error instanceof Error ? error.message : "Không thể nhận nhiệm vụ.";
  } finally {
    isClaiming.value = false;
  }
}
</script>
<template>
  <Modal title="Bảng nhiệm vụ" sub-title="Nhiệm vụ theo giờ" @refresh="loadMissionData()">

      <div v-if="isLoading" class="flex-1 grid place-items-center text-sm text-emerald-900/70">
        Đang tải cá và nhiệm vụ...
      </div>
      <div v-else class="grid grid-rows-[minmax(0,1fr)_minmax(0,1fr)] md:grid-rows-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] h-full flex-1">
        <section class="h-full flex flex-col border-b md:border-b-0 md:border-r border-emerald-950/10">
          <div class="px-5 py-3 sm:px-6 border-b border-emerald-950/10 flex items-center justify-between">
            <h3 class="m-0 text-sm font-bold">Cá đã câu</h3>
            <span class="text-xs text-emerald-900/60">{{ caughtStore.caughtFishes.length }} con</span>
          </div>
          <div class="p-3 sm:p-4 space-y-2 h-0 grow overflow-y-scroll">
            <p v-if="!caughtStore.caughtFishes.length" class="py-8 text-center text-sm text-emerald-900/55">
              Bạn chưa có cá trong bộ sưu tập.
            </p>
            <button
              v-for="caught in caughtStore.caughtFishes"
              :key="caught.id"
              type="button"
              class="w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors disabled:cursor-not-allowed"
              :class="
                selectedCaughtIds.includes(caught.id)
                  ? 'border-emerald-700 bg-emerald-100 ring-2 ring-emerald-700/20'
                  : isFishRequired(caught.species.id)
                    ? 'border-amber-500 bg-amber-50 hover:bg-amber-100 cursor-pointer'
                    : 'border-emerald-950/10 bg-white/50 opacity-55'
              "
              :disabled="!selectedCaughtIds.includes(caught.id) && !canSelectCaught(caught)"
              @click="toggleCaught(caught)"
            >
              <img
                :src="caught.species?.image || '/fish/VN/fish.jpg'"
                :alt="caught.species?.name || 'Cá'"
                class="w-14 h-12 rounded-md object-cover bg-emerald-950/5 shrink-0"
              />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-bold">{{ caught.species?.name || "Cá không tên" }}</span>
                <span class="block text-xs text-emerald-900/60"
                  >{{ caught.species?.rarity || "Không rõ độ hiếm" }} · {{ caught.weight }} kg</span
                >
              </span>
              <span v-if="selectedCaughtIds.includes(caught.id)" class="text-xs font-bold text-emerald-800"
                >Đã chọn</span
              >
              <span v-else-if="isFishRequired(caught.species?.id)" class="text-xs font-bold text-amber-800">Phù hợp</span>
            </button>
          </div>
        </section>

        <section class="min-h-0 flex flex-col">
          <div class="px-5 py-3 sm:px-6 border-b border-emerald-950/10 flex items-center justify-between">
            <h3 class="m-0 text-sm font-bold">Nhiệm vụ</h3>
            <span class="text-xs text-emerald-900/60">{{ missionStore.missions.length }} nhiệm vụ</span>
          </div>
          <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            <p v-if="!missionStore.missions.length" class="py-8 text-center text-sm text-emerald-900/55">
              Hiện không có nhiệm vụ.
            </p>
            <button
              v-for="mission in missionStore.missions"
              :key="mission.id"
              type="button"
              class="w-full p-3 rounded-lg border text-left transition-colors"
              :class="
                selectedMissionId === mission.id
                  ? 'border-emerald-700 bg-emerald-100'
                  : 'border-emerald-950/10 bg-white/55 hover:bg-white'
              "
              @click="selectMission(mission.id)"
            >
              <span class="flex items-center justify-between gap-3">
                <strong class="text-sm">{{ mission.start }} - {{ mission.end }}</strong>
                <div class="flex items-center gap-2">
                  <span class="text-sm">Phần thưởng:</span>
                  <Cash :amount="mission.cash" />
                </div>
              </span>
              <span class="mt-1 block text-xs text-emerald-900/65">{{ mission.content.length }} cá cần nộp</span>
            </button>

            <div v-if="selectedMission" class="pt-1">
              <h4 class="m-0 mb-2 text-xs font-extrabold uppercase tracking-wide text-emerald-900/65">Cá cần có</h4>
              <div class="space-y-2">
                <div
                  v-for="(fish, index) in selectedMission.content"
                  :key="`${fish.id}-${index}`"
                  class="flex items-center gap-3 rounded-lg bg-white/75 border border-emerald-950/10 p-2"
                >
                  <img :src="fish.image" :alt="fish.name" class="w-12 h-10 rounded object-cover bg-emerald-950/5" />
                  <span class="min-w-0 flex-1">
                    <strong class="block truncate text-sm">{{ fish.name }}</strong>
                    <span class="block text-xs text-emerald-900/60">{{ fish.rarity }} · {{ fish.length }}</span>
                  </span>
                  <span
                    class="text-xs font-bold pr-2"
                    :class="(selectedFishCounts.get(fish.id) ?? 0) > 0 ? 'text-emerald-700' : 'text-emerald-950/45'"
                  >
                    {{ Math.min(selectedFishCounts.get(fish.id) ?? 0, requiredFishCounts.get(fish.id) ?? 0) }}/{{
                      requiredFishCounts.get(fish.id)
                    }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <footer class="px-4 py-3 sm:px-5 border-t border-emerald-950/10 bg-white/40">
            <p
              v-if="statusMessage"
              class="m-0 mb-2 text-xs"
              :class="statusIsError ? 'text-red-700' : 'text-emerald-800'"
            >
              {{ statusMessage }}
            </p>
            <div class="flex items-center justify-between gap-3">
              <span class="text-xs text-emerald-900/65">Đã chọn {{ selectedCaughtIds.length }} cá</span>
              <button
                type="button"
                class="px-4 py-2 rounded-md bg-emerald-800 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
                :disabled="!isMissionComplete || isClaiming"
                @click="claimMission"
              >
                {{ isClaiming ? "Đang gửi..." : "Nộp" }}
              </button>
            </div>
          </footer>
        </section>
      </div>
  </Modal>

  <!-- Popup thông báo nộp nhiệm vụ thành công -->
  <Transition name="claim-success">
    <div v-if="claimSuccess"
      class="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2.5 px-5 py-3 rounded-xl bg-emerald-600 text-white shadow-[0_8px_30px_rgba(21,50,33,0.35)] border border-emerald-500 cursor-pointer"
      @click="closeClaimSuccess">
      <span class="text-lg">✅</span>
      <span class="text-sm font-semibold">Nộp nhiệm vụ thành công! Nhận <strong><Cash :amount="claimedReward" /></strong></span>
    </div>
  </Transition>
</template>

<style scoped>
.claim-success-enter-active {
  animation: claim-success-in 0.4s ease-out;
}
.claim-success-leave-active {
  animation: claim-success-out 0.3s ease-in forwards;
}
@keyframes claim-success-in {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}
@keyframes claim-success-out {
  0% {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px) scale(0.95);
  }
}
</style>
