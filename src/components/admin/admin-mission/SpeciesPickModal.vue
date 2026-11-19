<script setup lang="ts">
import type { SpeciesRow } from "../../../types/table/species";
import { computed, onMounted, ref, watch } from "vue";

import { useAdminHourMissionStore } from "./admin-hour-mission-store";

const props = defineProps<{ selectedIds: string[] }>();
const emit = defineEmits<{ (e: "confirm", selected: SpeciesRow[]): void; (e: "close"): void }>();

const store = useAdminHourMissionStore();
const viewMode = ref<"list" | "grid">("list");
const search = ref("");
const picked = ref<Set<string>>(new Set(props.selectedIds));

onMounted(() => store.loadSpecies());
watch(
  () => props.selectedIds,
  (ids) => (picked.value = new Set(ids)),
);

const filtered = computed(() => {
  const keyword = search.value.trim().toLocaleLowerCase();
  return store.species.filter((item) => !keyword || item.name.toLocaleLowerCase().includes(keyword));
});

function toggle(id: string) {
  const next = new Set(picked.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  picked.value = next;
}

function confirm() {
  // Giữ thứ tự theo danh sách loài
  emit(
    "confirm",
    store.species.filter((item) => picked.value.has(item.id)),
  );
}

const viewBtn = (active: boolean) =>
  `rounded-md px-3 py-1.5 text-xs font-bold ${active ? "bg-[#153221] text-white" : "text-[#24352a] hover:bg-[#f5f9f0]"}`;
</script>

<template>
  <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" @click.self="emit('close')">
    <div class="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-[#cbd9c6] bg-white shadow-xl">
      <div class="flex shrink-0 items-center justify-between border-b border-[#cbd9c6] px-5 py-3">
        <div class="m-0 text-base font-extrabold text-[#24352a]">Chọn cá ({{ picked.size }})</div>
        <button
          type="button"
          aria-label="Đóng"
          class="grid size-8 place-items-center rounded-md text-xl text-gray-500 hover:bg-gray-100"
          @click="emit('close')"
        >
          &times;
        </button>
      </div>

      <div class="flex shrink-0 items-center gap-3 border-b border-[#cbd9c6] bg-[#f5f9f0] px-5 py-3">
        <input
          v-model="search"
          type="search"
          placeholder="Tìm tên cá..."
          class="min-w-0 flex-1 rounded-md border border-[#cbd9c6] bg-white px-3 py-2 text-sm text-[#24352a] focus:border-emerald-600 focus:outline-none"
        />
        <div class="flex rounded-md border border-[#cbd9c6] bg-white p-0.5">
          <button type="button" :class="viewBtn(viewMode === 'list')" @click="viewMode = 'list'">Danh sách</button>
          <button type="button" :class="viewBtn(viewMode === 'grid')" @click="viewMode = 'grid'">Lưới</button>
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto p-4">
        <div v-if="store.isLoadingSpecies" class="m-0 py-8 text-center text-sm text-gray-500">Đang tải...</div>
        <div v-else-if="store.speciesError" class="m-0 py-8 text-center text-sm text-red-700">
          {{ store.speciesError }}
        </div>
        <div v-else-if="!filtered.length" class="m-0 py-8 text-center text-sm text-gray-500">Không có loài cá nào</div>

        <div v-else-if="viewMode === 'list'" class="m-0 flex list-none flex-col gap-2 p-0">
          <div v-for="item in filtered" :key="item.id">
            <label
              class="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2"
              :class="picked.has(item.id) ? 'border-emerald-700 bg-[#f5f9f0]' : 'border-[#cbd9c6] hover:bg-[#f5f9f0]'"
            >
              <input
                type="checkbox"
                class="size-4 accent-emerald-800"
                :checked="picked.has(item.id)"
                @change="toggle(item.id)"
              />
              <img v-if="item.image" :src="item.image" :alt="item.name" class="size-10 object-contain" />
              <span class="min-w-0 flex-1 truncate text-sm font-bold text-[#24352a]">{{ item.name }}</span>
              <span class="text-xs text-gray-500">{{ item.rarity }}</span>
            </label>
          </div>
        </div>

        <div v-else class="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 md:grid-cols-4">
          <div v-for="item in filtered" :key="item.id">
            <label
              class="relative flex h-full cursor-pointer flex-col items-center gap-1 rounded-lg border p-3 text-center"
              :class="picked.has(item.id) ? 'border-emerald-700 bg-[#f5f9f0]' : 'border-[#cbd9c6] hover:bg-[#f5f9f0]'"
            >
              <input
                type="checkbox"
                class="absolute left-2 top-2 size-4 accent-emerald-800"
                :checked="picked.has(item.id)"
                @change="toggle(item.id)"
              />
              <img v-if="item.image" :src="item.image" :alt="item.name" class="h-20 w-full object-contain" />
              <div v-else class="h-20" />
              <span class="text-sm font-bold text-[#24352a]">{{ item.name }}</span>
              <span class="text-xs text-gray-500">{{ item.rarity }}</span>
            </label>
          </div>
        </div>
      </div>

      <div class="flex shrink-0 justify-end gap-2 border-t border-[#cbd9c6] px-5 py-3">
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100"
          @click="emit('close')"
        >
          Huỷ
        </button>
        <button
          type="button"
          class="rounded-lg bg-[#153221] px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800"
          @click="confirm"
        >
          Xác nhận
        </button>
      </div>
    </div>
  </div>
</template>
