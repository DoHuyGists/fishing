<script setup lang="ts">
import type { CaughtFish } from "../../stores/caught";

const props = defineProps<{
  caughtFishes: CaughtFish[];
  selectedCaughtIds: string[];
  requiredFishCounts: Map<string, number>;
  selectedFishCounts: Map<string, number>;
}>();

const emit = defineEmits<{
  toggle: [caught: CaughtFish];
}>();

function isFishRequired(fishId: string | undefined) {
  return !!fishId && (props.requiredFishCounts.get(fishId) ?? 0) > 0;
}

function canSelectCaught(caught: CaughtFish) {
  const fishId = caught.species.id;
  return !!fishId && (props.selectedFishCounts.get(fishId) ?? 0) < (props.requiredFishCounts.get(fishId) ?? 0);
}
</script>

<template>
  <section class="h-full flex flex-col border-b md:border-b-0 md:border-r border-emerald-950/10">
    <div class="px-5 py-3 sm:px-6 border-b border-emerald-950/10 flex items-center justify-between">
      <h3 class="m-0 text-sm font-bold">Cá đã câu</h3>
      <span class="text-xs text-emerald-900/60">{{ caughtFishes.length }} con</span>
    </div>
    <p v-if="!caughtFishes.length" class="py-8 text-center text-sm text-emerald-900/55">
      Bạn chưa có cá trong bộ sưu tập.
    </p>
    <div v-else class="p-3 sm:p-4 space-y-2 h-0 grow overflow-y-scroll grid grid-cols-2">
      <button
        v-for="caught in caughtFishes"
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
        @click="emit('toggle', caught)"
      >
        <img
          :src="caught.species?.image || '/fish/VN/fish.jpg'"
          :alt="caught.species?.name || 'Cá'"
          class="w-14 h-12 rounded-md object-cover bg-emerald-950/5 shrink-0"
        />
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-bold">{{ caught.species?.name || "Cá không tên" }}</span>
          <span class="block text-xs text-emerald-900/60">{{ caught.species?.rarity || "Không rõ độ hiếm" }} · {{ caught.weight }} kg</span>
        </span>
        <span v-if="selectedCaughtIds.includes(caught.id)" class="text-xs font-bold text-emerald-800">Đã chọn</span>
        <span v-else-if="isFishRequired(caught.species?.id)" class="text-xs font-bold text-amber-800">Phù hợp</span>
      </button>
    </div>
  </section>
</template>
