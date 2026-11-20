<script lang="ts" setup>
import { computed, reactive, ref } from "vue";
import type { CaughtFish } from "../../../types/model/caughtFish";
import type { PostProductionViewMode } from "../../../types/model/postProduction";
import { t as tr } from "../../../i18n/index";
import PostProductionFishItem from "./PostProductionFishItem.vue";

const props = defineProps<{
  title: string;
  fishes: CaughtFish[];
  capacity?: number;
  selected: Set<string>;
  isLoading: boolean;
}>();

const emit = defineEmits<{
  toggle: [id: string];
  selectAll: [fishes: CaughtFish[]];
}>();

const search = ref("");
const viewMode = ref<PostProductionViewMode>("grid");
const expandedSpecies = reactive(new Set<string>());
const filteredFishes = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  if (!keyword) return props.fishes;
  return props.fishes.filter((fish) => fish.species?.name?.toLowerCase().includes(keyword));
});
const speciesGroups = computed(() => groupedBySpecies(filteredFishes.value));

function groupedBySpecies(fishes: CaughtFish[]) {
  const groups = new Map<string, { key: string; name: string; image: string | null; fishes: CaughtFish[] }>();
  for (const fish of fishes) {
    const key = fish.species?.id ?? "unknown";
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        name: fish.species?.name || tr("PostProduction.chua_ro_loai"),
        image: fish.species?.image ?? null,
        fishes: [],
      };
      groups.set(key, group);
    }
    group.fishes.push(fish);
  }
  return [...groups.values()];
}

function toggleSpecies(key: string) {
  if (expandedSpecies.has(key)) expandedSpecies.delete(key);
  else expandedSpecies.add(key);
}
</script>

<template>
  <section
    class="slide-fade-in from-bottom player-content-in flex min-w-0 flex-1 flex-col rounded-lg border border-emerald-900/15 bg-white"
  >
    <div class="flex flex-wrap items-center gap-2 border-b border-emerald-900/10 p-2">
      <div class="m-0 text-sm font-bold text-emerald-950">
        {{ title }} ({{ fishes.length
        }}<template v-if="capacity !== undefined">/{{ capacity }}</template
        >)
      </div>
      <input
        v-model="search"
        type="search"
        :placeholder="tr('PostProduction.tim_ca')"
        class="min-w-0 grow rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-emerald-600 focus:outline-none"
      />
      <button
        type="button"
        class="rounded-md border border-emerald-900/15 px-2 py-1 text-xs font-bold hover:bg-emerald-50"
        @click="emit('selectAll', filteredFishes)"
      >
        {{ tr("PostProduction.chon_tat_ca") }}
      </button>
      <div
        class="flex rounded-md border border-emerald-900/15 p-0.5 text-xs font-bold"
        role="group"
        :aria-label="tr('PostProduction.che_do_xem')"
      >
        <button
          type="button"
          class="rounded px-2 py-1"
          :class="viewMode === 'list' ? 'bg-emerald-800 text-white' : 'hover:bg-emerald-50'"
          :aria-pressed="viewMode === 'list'"
          @click="viewMode = 'list'"
        >
          {{ tr("CaughtModal.danh_sach") }}
        </button>
        <button
          type="button"
          class="rounded px-2 py-1"
          :class="viewMode === 'grid' ? 'bg-emerald-800 text-white' : 'hover:bg-emerald-50'"
          :aria-pressed="viewMode === 'grid'"
          @click="viewMode = 'grid'"
        >
          {{ tr("CaughtModal.luoi") }}
        </button>
        <button
          type="button"
          class="rounded px-2 py-1"
          :class="viewMode === 'species' ? 'bg-emerald-800 text-white' : 'hover:bg-emerald-50'"
          :aria-pressed="viewMode === 'species'"
          @click="viewMode = 'species'"
        >
          {{ tr("CaughtModal.theo_loai") }}
        </button>
      </div>
    </div>

    <div class="grow h-0 overflow-y-auto p-2">
      <div v-if="isLoading" class="text-center text-sm text-gray-500">
        {{ tr("WeatherSection.dang_tai") }}
      </div>
      <div v-else-if="filteredFishes.length === 0" class="text-center text-sm text-gray-500">
        {{ tr("PostProduction.khong_co_ca") }}
      </div>

      <div v-else-if="viewMode === 'species'" class="flex flex-col gap-2">
        <section
          v-for="group in speciesGroups"
          :key="group.key"
          class="overflow-hidden rounded-md border border-emerald-900/15 bg-surface"
        >
          <button
            type="button"
            class="flex w-full items-center gap-2 p-2 text-left hover:bg-emerald-50"
            :aria-expanded="expandedSpecies.has(group.key)"
            @click="toggleSpecies(group.key)"
          >
            <img
              :src="group.image || '/fish/VN/fish.jpg'"
              :alt="group.name"
              class="h-12 w-14 shrink-0 rounded object-cover"
            />
            <span class="min-w-0 grow truncate text-sm font-bold text-content">{{ group.name }}</span>
            <span class="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-bold"
              >{{ group.fishes.length }} {{ tr("Fishfarm.ca_2") }}</span
            >
            <span aria-hidden="true" class="text-sm">{{
              expandedSpecies.has(group.key) ? "▴" : "▾"
            }}</span>
          </button>
          <div
            v-if="expandedSpecies.has(group.key)"
            class="m-0 flex max-h-48 list-none flex-col gap-1 overflow-y-auto border-t border-emerald-900/10 p-2"
          >
            <div v-for="fish in group.fishes" :key="fish.id">
              <PostProductionFishItem
                :fish="fish"
                :selected="selected.has(fish.id)"
                variant="species"
                @click="emit('toggle', fish.id)"
              />
            </div>
          </div>
        </section>
      </div>

      <div
        v-else-if="viewMode === 'grid'"
        class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2"
      >
        <PostProductionFishItem
          v-for="fish in filteredFishes"
          :key="fish.id"
          :fish="fish"
          :selected="selected.has(fish.id)"
          variant="grid"
          @click="emit('toggle', fish.id)"
        />
      </div>

      <div v-else class="m-0 flex list-none flex-col gap-1 p-0">
        <div v-for="fish in filteredFishes" :key="fish.id">
          <PostProductionFishItem
            :fish="fish"
            :selected="selected.has(fish.id)"
            variant="list"
            @click="emit('toggle', fish.id)"
          />
        </div>
      </div>
    </div>
  </section>
</template>
