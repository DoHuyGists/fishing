<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import type { CaughtFish } from "../../../stores/caught";

type ViewMode = "list" | "grid" | "species";

const props = defineProps<{
  caughtFishes: CaughtFish[];
  selectedCaughtIds: string[];
  requiredFishCounts: Map<string, number>;
  selectedFishCounts: Map<string, number>;
}>();

const emit = defineEmits<{
  toggle: [caught: CaughtFish];
}>();

const viewMode = ref<ViewMode>("list");
const expandedSpecies = reactive(new Set<string>());

const groupedBySpecies = computed(() => {
  const groups = new Map<string, { key: string; name: string; image: string | null; fishes: CaughtFish[] }>();
  for (const caught of props.caughtFishes) {
    const key = caught.species?.id || "unknown";
    let group = groups.get(key);
    if (!group) {
      group = { key, name: caught.species?.name || "Cá chưa rõ tên", image: caught.species?.image ?? null, fishes: [] };
      groups.set(key, group);
    }
    group.fishes.push(caught);
  }
  return [...groups.values()];
});

function toggleSpecies(key: string) {
  if (expandedSpecies.has(key)) expandedSpecies.delete(key);
  else expandedSpecies.add(key);
}

function isFishRequired(fishId: string | undefined) {
  return !!fishId && (props.requiredFishCounts.get(fishId) ?? 0) > 0;
}

function canSelectCaught(caught: CaughtFish) {
  const fishId = caught.species.id;
  return !!fishId && (props.selectedFishCounts.get(fishId) ?? 0) < (props.requiredFishCounts.get(fishId) ?? 0);
}

function isSelected(caught: CaughtFish) {
  return props.selectedCaughtIds.includes(caught.id);
}

function selectionClass(caught: CaughtFish) {
  return isSelected(caught)
    ? "border-emerald-700 bg-emerald-100 ring-2 ring-emerald-700/20"
    : isFishRequired(caught.species?.id)
      ? "border-amber-500 bg-amber-50 hover:bg-amber-100 cursor-pointer"
      : "border-emerald-950/10 bg-white/50 opacity-55";
}
</script>

<template>
  <section class="flex h-full flex-col border-b border-emerald-950/10 md:border-b-0 md:border-r">
    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-950/10 px-5 py-3 sm:px-6">
      <h3 class="m-0 text-sm font-bold">Cá đã câu</h3>
      <span class="text-xs text-emerald-900/60">{{ caughtFishes.length }} con</span>
      <div
        class="flex rounded-md border border-[#cbd9c6] p-0.5 text-xs font-bold"
        role="group"
        aria-label="Chế độ xem cá đã câu"
      >
        <button
          type="button"
          class="rounded px-2 py-1"
          :class="viewMode === 'list' ? 'bg-emerald-800 text-white' : 'hover:bg-emerald-50'"
          :aria-pressed="viewMode === 'list'"
          @click="viewMode = 'list'"
        >
          Danh sách
        </button>
        <button
          type="button"
          class="rounded px-2 py-1"
          :class="viewMode === 'grid' ? 'bg-emerald-800 text-white' : 'hover:bg-emerald-50'"
          :aria-pressed="viewMode === 'grid'"
          @click="viewMode = 'grid'"
        >
          Lưới
        </button>
        <button
          type="button"
          class="rounded px-2 py-1"
          :class="viewMode === 'species' ? 'bg-emerald-800 text-white' : 'hover:bg-emerald-50'"
          :aria-pressed="viewMode === 'species'"
          @click="viewMode = 'species'"
        >
          Theo loài
        </button>
      </div>
    </div>

    <p v-if="!caughtFishes.length" class="py-8 text-center text-sm text-emerald-900/55">
      Bạn chưa có cá trong bộ sưu tập.
    </p>
    <div v-else class="h-0 grow overflow-y-auto p-3 sm:p-4">
      <div v-if="viewMode === 'species'" class="flex flex-col gap-2">
        <section
          v-for="group in groupedBySpecies"
          :key="group.key"
          class="overflow-hidden rounded-lg border border-[#cbd9c6] bg-[#f5f9f0]"
        >
          <button
            type="button"
            class="flex w-full items-center gap-3 p-2.5 text-left hover:bg-emerald-50"
            :aria-expanded="expandedSpecies.has(group.key)"
            @click="toggleSpecies(group.key)"
          >
            <img
              :src="group.image || '/fish/VN/fish.jpg'"
              :alt="group.name"
              class="h-12 w-14 shrink-0 rounded-md bg-emerald-950/5 object-cover"
            />
            <span class="min-w-0 flex-1 truncate text-sm font-bold text-[#24352a]">{{ group.name }}</span>
            <span class="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-bold"
              >{{ group.fishes.length }} con</span
            >
            <span aria-hidden="true" class="text-sm">{{ expandedSpecies.has(group.key) ? "▴" : "▾" }}</span>
          </button>
          <ul
            v-if="expandedSpecies.has(group.key)"
            class="m-0 flex max-h-48 list-none flex-col gap-1 overflow-y-auto border-t border-[#cbd9c6] p-2"
          >
            <li v-for="caught in group.fishes" :key="caught.id">
              <button
                type="button"
                class="flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors disabled:cursor-not-allowed"
                :class="selectionClass(caught)"
                :disabled="!isSelected(caught) && !canSelectCaught(caught)"
                @click="emit('toggle', caught)"
              >
                <img
                  :src="caught.species?.image || '/fish/VN/fish.jpg'"
                  :alt="caught.species?.name || 'Cá'"
                  class="h-10 w-12 shrink-0 rounded-md object-cover"
                />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-bold">{{ caught.species?.name || "Cá chưa rõ tên" }}</span>
                  <span class="block text-xs text-emerald-900/60"
                    >{{ caught.species?.rarity || "Không rõ độ hiếm" }} · {{ caught.weight }} kg</span
                  >
                </span>
                <span v-if="isSelected(caught)" class="text-xs font-bold text-emerald-800">Đã chọn</span>
                <span v-else-if="isFishRequired(caught.species?.id)" class="text-xs font-bold text-amber-800"
                  >Phù hợp</span
                >
              </button>
            </li>
          </ul>
        </section>
      </div>

      <div v-else :class="viewMode === 'grid' ? 'grid grid-cols-3 gap-2' : 'flex flex-col gap-2'">
        <button
          v-for="caught in caughtFishes"
          :key="caught.id"
          type="button"
          class="w-full rounded-lg border text-left transition-colors disabled:cursor-not-allowed"
          :class="[
            selectionClass(caught),
            viewMode === 'grid'
              ? 'flex flex-col items-center gap-1.5 p-2 text-center'
              : 'flex items-center gap-3 p-2.5',
          ]"
          :disabled="!isSelected(caught) && !canSelectCaught(caught)"
          @click="emit('toggle', caught)"
        >
          <img
            :src="caught.species?.image || '/fish/VN/fish.jpg'"
            :alt="caught.species?.name || 'Cá'"
            :class="
              viewMode === 'grid'
                ? 'h-16 w-full rounded-md object-cover bg-emerald-950/5'
                : 'h-12 w-14 shrink-0 rounded-md object-cover bg-emerald-950/5'
            "
          />
          <span :class="viewMode === 'grid' ? 'w-full min-w-0' : 'min-w-0 flex-1'">
            <span class="block truncate text-sm font-bold">{{ caught.species?.name || "Cá chưa rõ tên" }}</span>
            <span class="block truncate text-xs text-emerald-900/60"
              >{{ caught.species?.rarity || "Không rõ độ hiếm" }} · {{ caught.weight }} kg</span
            >
          </span>
          <span v-if="isSelected(caught)" class="shrink-0 text-xs font-bold text-emerald-800">Đã chọn</span>
          <span v-else-if="isFishRequired(caught.species?.id)" class="shrink-0 text-xs font-bold text-amber-800"
            >Phù hợp</span
          >
        </button>
      </div>
    </div>
  </section>
</template>
