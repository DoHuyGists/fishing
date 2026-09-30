<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useMissionStore } from "../../stores/mission";
import { useCaughtStore } from "../../stores/caught";

const emit = defineEmits<{ close: [] }>();
const missionStore = useMissionStore();
const caughtStore = useCaughtStore();
const selectedMissionId = ref("");
const selectedCaughtIds = ref<string[]>([]);
const isLoading = ref(true);
const isClaiming = ref(false);
const statusMessage = ref("");
const statusIsError = ref(false);

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
    if (caught?.fish?.id) {
      counts.set(caught.fish.id, (counts.get(caught.fish.id) ?? 0) + 1);
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

function canSelectCaught(caught: { id: string; fish: { id?: string } }) {
  const fishId = caught.fish?.id;
  return !!fishId && (selectedFishCounts.value.get(fishId) ?? 0) < (requiredFishCounts.value.get(fishId) ?? 0);
}

function toggleCaught(caught: { id: string; fish: { id?: string } }) {
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

onMounted(async () => {
  try {
    await Promise.all([missionStore.SetMission(), caughtStore.loadCaughtFishes()]);
    selectedMissionId.value = missionStore.missions[0]?.id ?? "";
  } catch (error) {
    statusIsError.value = true;
    statusMessage.value = error instanceof Error ? error.message : "Không thể tải dữ liệu nhiệm vụ.";
  } finally {
    isLoading.value = false;
  }
});

async function claimMission() {
  if (!selectedMission.value || !isMissionComplete.value || isClaiming.value) return;
  isClaiming.value = true;
  statusMessage.value = "";
  try {
    await missionStore.ClaimMission(selectedMission.value.id, selectedCaughtIds.value);
    statusIsError.value = false;
    statusMessage.value = "Nhận nhiệm vụ thành công.";
    selectedCaughtIds.value = [];
    await Promise.all([caughtStore.loadCaughtFishes(), missionStore.SetMission()]);
  } catch (error) {
    statusIsError.value = true;
    statusMessage.value = error instanceof Error ? error.message : "Không thể nhận nhiệm vụ.";
  } finally {
    isClaiming.value = false;
  }
}
</script>
<template>
  <div class="fixed inset-0 z-50 bg-black/65 p-3 sm:p-6 grid place-items-center" @click.self="emit('close')">
    <section
      class="relative w-full max-w-6xl h-[min(780px,94vh)] overflow-hidden rounded-xl border border-emerald-900/20 bg-[#f4f5e9] text-[#20372a] shadow-2xl flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mission-title"
    >
      <header
        class="flex items-center justify-between gap-4 px-5 py-4 sm:px-7 border-b border-emerald-950/10 bg-[#e7ecda]"
      >
        <div>
          <p class="m-0 text-[10px] font-extrabold tracking-[0.14em] uppercase text-emerald-800">Bảng nhiệm vụ</p>
          <h2 id="mission-title" class="m-0 mt-1 text-xl sm:text-2xl font-bold">Nhiệm vụ theo giờ</h2>
        </div>
        <button
          type="button"
          class="w-9 h-9 rounded-full border border-emerald-900/15 bg-white/70 text-emerald-950 hover:bg-white text-2xl leading-none cursor-pointer"
          aria-label="Đóng nhiệm vụ"
          @click="emit('close')"
        >
          &times;
        </button>
      </header>

      <div v-if="isLoading" class="flex-1 grid place-items-center text-sm text-emerald-900/70">
        Đang tải cá và nhiệm vụ...
      </div>
      <div v-else class="grid grid-rows-[minmax(0,1fr)_minmax(0,1fr)] md:grid-rows-1 md:grid-cols-2 min-h-0 flex-1">
        <section class="min-h-0 flex flex-col border-b md:border-b-0 md:border-r border-emerald-950/10">
          <div class="px-5 py-3 sm:px-6 border-b border-emerald-950/10 flex items-center justify-between">
            <h3 class="m-0 text-sm font-bold">Cá đã câu</h3>
            <span class="text-xs text-emerald-900/60">{{ caughtStore.caughtFishes.length }} con</span>
          </div>
          <div class="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
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
                  : isFishRequired(caught.fish?.id)
                    ? 'border-amber-500 bg-amber-50 hover:bg-amber-100 cursor-pointer'
                    : 'border-emerald-950/10 bg-white/50 opacity-55'
              "
              :disabled="!selectedCaughtIds.includes(caught.id) && !canSelectCaught(caught)"
              @click="toggleCaught(caught)"
            >
              <img
                :src="caught.fish?.image || '/fish/VN/fish.jpg'"
                :alt="caught.fish?.name || 'Cá'"
                class="w-14 h-12 rounded-md object-cover bg-emerald-950/5 shrink-0"
              />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-bold">{{ caught.fish?.name || "Cá không tên" }}</span>
                <span class="block text-xs text-emerald-900/60"
                  >{{ caught.fish?.rarity || "Không rõ độ hiếm" }} ·
                  {{ caught.fish?.length || "Chưa rõ kích thước" }}</span
                >
              </span>
              <span v-if="selectedCaughtIds.includes(caught.id)" class="text-xs font-bold text-emerald-800"
                >Đã chọn</span
              >
              <span v-else-if="isFishRequired(caught.fish?.id)" class="text-xs font-bold text-amber-800">Phù hợp</span>
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
                <span class="text-xs font-bold text-amber-800"
                  >{{ Number(mission.cash).toLocaleString("vi-VN") }} xu</span
                >
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
                    class="text-xs font-bold"
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
    </section>
  </div>
</template>
