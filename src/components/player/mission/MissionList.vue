<script setup lang="ts">
import type { HourMission } from "../../../data/supabaseMissionRepository.ts";
import Cash from "../currency/Cash.vue";

defineProps<{
  missions: HourMission[];
  selectedMission: HourMission | null;
  selectedMissionId: string;
  selectedCaughtIds: string[];
  requiredFishCounts: Map<string, number>;
  selectedFishCounts: Map<string, number>;
  statusMessage: string;
  statusIsError: boolean;
  isMissionComplete: boolean;
  isClaiming: boolean;
}>();

const emit = defineEmits<{
  select: [missionId: string];
  claim: [];
}>();
</script>

<template>
  <section class="min-h-0 flex flex-col">
    <div class="px-5 py-3 sm:px-6 border-b border-emerald-950/10 flex items-center justify-between">
      <h3 class="m-0 text-sm font-bold">Nhiệm vụ</h3>
      <span class="text-xs text-emerald-900/60">{{ missions.length }} nhiệm vụ</span>
    </div>
    <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
      <p v-if="!missions.length" class="py-8 text-center text-sm text-emerald-900/55">Hiện không có nhiệm vụ.</p>
      <button
        v-for="mission in missions"
        :key="mission.id"
        type="button"
        class="w-full p-3 rounded-lg border text-left transition-colors"
        :class="
          selectedMissionId === mission.id
            ? 'border-emerald-700 bg-emerald-100'
            : 'border-emerald-950/10 bg-white/55 hover:bg-white'
        "
        @click="emit('select', mission.id)"
      >
        <span class="flex items-center justify-between gap-3">
          <strong class="text-sm">{{ mission.start }} - {{ mission.end }}</strong>
          <span class="flex items-center gap-2"
            ><span class="text-sm">Phần thưởng:</span><Cash :amount="mission.cash"
          /></span>
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
            <span class="min-w-0 flex-1"
              ><strong class="block truncate text-sm">{{ fish.name }}</strong
              ><span class="block text-xs text-emerald-900/60">{{ fish.rarity }} · {{ fish.length }}</span></span
            >
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
      <p v-if="statusMessage" class="m-0 mb-2 text-xs" :class="statusIsError ? 'text-red-700' : 'text-emerald-800'">
        {{ statusMessage }}
      </p>
      <div class="flex items-center justify-between gap-3">
        <span class="text-xs text-emerald-900/65">Đã chọn {{ selectedCaughtIds.length }} cá</span>
        <button
          type="button"
          class="px-4 py-2 rounded-md bg-emerald-800 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
          :disabled="!isMissionComplete || isClaiming"
          @click="emit('claim')"
        >
          {{ isClaiming ? "Đang gửi..." : "Nộp" }}
        </button>
      </div>
    </footer>
  </section>
</template>
