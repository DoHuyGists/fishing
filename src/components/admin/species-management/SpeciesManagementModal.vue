<script lang="ts" setup>
import type { SpeciesRow } from "../../../types/table/species";
import AdminModal from "../AdminModal.vue";
import Pagination from '../../shared/Pagination.vue';
import { usePagedListFilters } from '../../../composables/usePagedListFilters';
import { onMounted, ref } from "vue";
import { storeToRefs } from "pinia";

import { useAdminSpeciesStore } from "./admin-species-store.ts";
import SpeciesManagementForm from "./SpeciesManagementForm.vue";

const emit = defineEmits(["close"]);
const speciesStore = useAdminSpeciesStore();
usePagedListFilters([() => speciesStore.search, () => speciesStore.statusFilter, () => speciesStore.rarityFilter], () => { void speciesStore.fetchAll(1); }, () => { ++speciesStore.requestId; });

const { search, statusFilter, rarityFilter, viewMode, statusOptions, rarityOptions, filteredSpecies, speciesGroups } =
  storeToRefs(speciesStore);
const viewModes = [
  { value: "list", label: "Danh sách" },
  { value: "grid", label: "Lưới" },
  { value: "grouped", label: "Theo khu vực" },
] as const;
const isFormOpen = ref(false);
const selectedSpecies = ref<SpeciesRow | null>(null);
const deletingId = ref<string | null>(null);
const confirmDeleteId = ref<string | null>(null);

function openCreateForm() {
  selectedSpecies.value = null;
  isFormOpen.value = true;
}

function openEditForm(species: SpeciesRow) {
  selectedSpecies.value = species;
  isFormOpen.value = true;
}

function closeForm() {
  isFormOpen.value = false;
  selectedSpecies.value = null;
}

async function handleDelete() {
  if (!confirmDeleteId.value) return;
  deletingId.value = confirmDeleteId.value;
  try {
    await speciesStore.deleteSpecies(confirmDeleteId.value);
    confirmDeleteId.value = null;
  } catch {
    // The store exposes the operation error to the list.
  } finally {
    deletingId.value = null;
  }
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleString("vi-VN") : "—";
}

onMounted(() => speciesStore.fetchAll());
</script>

<template>
  <AdminModal
    title="Quản lý loài cá"
    icon="🐟"
    @close="emit('close')"
  >
    <template #subtitle>{{ speciesStore.species.length }} loài trong danh mục</template>

    <div class="flex shrink-0 flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-5 py-3 md:px-7">
      <div class="relative min-w-55 flex-1">
        <input
          v-model="search"
          type="search"
          placeholder="Tìm tên, khu vực, độ hiếm, mô tả..."
          class="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
        />
      </div>
      <label class="flex items-center gap-2 text-xs font-semibold text-gray-600">
        Trạng thái
        <select
          v-model="statusFilter"
          class="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-700"
        >
          <option value="ALL">Tất cả</option>
          <option v-for="status in statusOptions" :key="status" :value="status">{{ status }}</option>
        </select>
      </label>
      <label class="flex items-center gap-2 text-xs font-semibold text-gray-600">
        Độ hiếm
        <select
          v-model="rarityFilter"
          class="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-700"
        >
          <option value="ALL">Tất cả</option>
          <option v-for="rarity in rarityOptions" :key="rarity" :value="rarity">{{ rarity }}</option>
        </select>
      </label>
      <div role="group" aria-label="Chế độ hiển thị" class="flex rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] p-1">
        <button
          v-for="mode in viewModes"
          :key="mode.value"
          type="button"
          :aria-pressed="viewMode === mode.value"
          class="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          :class="viewMode === mode.value ? 'bg-white text-[#24352a] shadow-sm' : 'text-gray-600 hover:bg-white/60'"
          @click="viewMode = mode.value"
        >
          {{ mode.label }}
        </button>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <span class="hidden text-xs text-gray-500 sm:inline">{{ filteredSpecies.length }} kết quả</span>
        <button
          type="button"
          title="Làm mới danh sách"
          class="grid size-9 place-items-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          :disabled="speciesStore.isLoading"
          @click="speciesStore.fetchAll()"
        >
          <svg
            class="size-4"
            :class="{ 'animate-spin': speciesStore.isLoading }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
        <button
          type="button"
          class="rounded-lg bg-[#153221] px-3.5 py-2 text-sm font-bold text-white hover:bg-emerald-800"
          @click="openCreateForm"
        >
          + Thêm loài
        </button>
      </div>
    </div>

    <main class="relative flex min-h-0 flex-1">
      <section class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4 md:p-6">
        <div
          v-if="speciesStore.error"
          class="mb-4 flex shrink-0 items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{{ speciesStore.error }}</span>
          <button type="button" class="font-bold underline" @click="speciesStore.fetchAll()">Thử lại</button>
        </div>
        <div v-if="speciesStore.isLoading" class="grid min-h-64 place-items-center text-sm text-gray-500">
          Đang tải danh sách loài cá...
        </div>
        <div
          v-else-if="!filteredSpecies.length"
          class="grid min-h-64 place-items-center text-center text-sm text-gray-500"
        >
          <div>
            <span class="mb-2 block text-3xl">🎣</span>
            {{ speciesStore.species.length ? "Không tìm thấy loài cá phù hợp." : "Chưa có loài cá nào." }}
          </div>
        </div>
        <div v-else-if="viewMode === 'list'" class="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table class="w-full min-w-[1050px] border-collapse text-left text-sm">
            <thead class="text-[11px] uppercase text-gray-600">
              <tr>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Loài cá</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Khu vực</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Độ hiếm</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Khối lượng</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Tỉ lệ bắt</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Trạng thái</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Ngày tạo</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in filteredSpecies"
                :key="item.id"
                class="border-t border-gray-100 hover:bg-emerald-50/40"
              >
                <td class="max-w-[25rem] px-4 py-3">
                  <div class="flex items-center gap-3">
                    <img
                      v-if="item.image"
                      :src="item.image"
                      :alt="item.name"
                      class="size-12 shrink-0 rounded-md border border-gray-200 bg-gray-50 object-cover"
                      loading="lazy"
                    />
                    <div
                      v-else
                      class="grid size-12 shrink-0 place-items-center rounded-md border border-gray-200 bg-gray-50 text-xl"
                    >
                      🐟
                    </div>
                    <div class="min-w-0">
                      <div class="truncate font-bold text-gray-800" :title="item.name">{{ item.name }}</div>
                      <div class="mt-1 max-w-[22rem] truncate text-xs text-gray-500" :title="item.information || ''">
                        {{ item.information || "Chưa có mô tả" }}
                      </div>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3 text-gray-700">{{ item.location || "—" }}</td>
                <td class="px-4 py-3 text-gray-700">{{ item.rarity || "—" }}</td>
                <td class="whitespace-nowrap px-4 py-3 text-gray-700">
                  {{ item.weight_min ?? "—" }} – {{ item.weight_max ?? "—" }}
                </td>
                <td class="px-4 py-3 text-gray-700">{{ item.base_catch_rate ?? "—" }}</td>
                <td class="px-4 py-3">
                  <span
                    class="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800"
                  >
                    {{ item.status || "—" }}
                  </span>
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{{ formatDate(item.created_at) }}</td>
                <td class="px-4 py-3">
                  <div class="flex justify-end gap-2">
                    <button
                      type="button"
                      class="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100"
                      @click="openEditForm(item)"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      class="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50"
                      @click="confirmDeleteId = item.id"
                    >
                      Xoá
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="min-h-0 flex-1 space-y-5 overflow-auto">
          <section v-for="group in speciesGroups" :key="group.location" class="space-y-3">
            <div
              v-if="viewMode === 'grouped'"
              class="m-0 flex items-center gap-2 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-4 py-3 text-sm font-bold text-[#24352a]"
            >
              <span class="min-w-0 break-words">{{ group.location || "Chưa có khu vực" }}</span>
              <span class="shrink-0 text-xs font-normal">({{ group.species.length }} loài)</span>
            </div>
            <div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-4">
              <article
                v-for="item in group.species"
                :key="item.id"
                class="flex min-w-0 flex-col overflow-hidden rounded-lg border border-[#cbd9c6] bg-white shadow-sm"
              >
                <div class="grid h-40 place-items-center bg-[#f5f9f0]">
                  <img v-if="item.image" :src="item.image" :alt="item.name" loading="lazy" class="h-full w-full object-contain p-3" />
                  <span v-else class="text-5xl" role="img" aria-label="Chưa có hình ảnh">🐟</span>
                </div>
                <div class="flex flex-1 flex-col gap-3 p-4">
                  <div>
                    <div class="m-0 break-words text-sm font-bold text-[#24352a]">{{ item.name }}</div>
                    <div class="m-0 mt-1 line-clamp-2 text-xs text-gray-500" :title="item.information || ''">
                      {{ item.information || "Chưa có mô tả" }}
                    </div>
                  </div>
                  <dl class="m-0 grid grid-cols-2 gap-3 text-xs">
                    <div class="min-w-0"><dt class="text-gray-500">Khu vực</dt><dd class="m-0 mt-1 break-words text-[#24352a]">{{ item.location || "—" }}</dd></div>
                    <div class="min-w-0"><dt class="text-gray-500">Độ hiếm</dt><dd class="m-0 mt-1 break-words text-[#24352a]">{{ item.rarity || "—" }}</dd></div>
                    <div><dt class="text-gray-500">Khối lượng</dt><dd class="m-0 mt-1 text-[#24352a]">{{ item.weight_min ?? "—" }} – {{ item.weight_max ?? "—" }}</dd></div>
                    <div><dt class="text-gray-500">Tỉ lệ bắt</dt><dd class="m-0 mt-1 text-[#24352a]">{{ item.base_catch_rate ?? "—" }}</dd></div>
                    <div class="min-w-0"><dt class="text-gray-500">Trạng thái</dt><dd class="m-0 mt-1 break-words text-emerald-800">{{ item.status || "—" }}</dd></div>
                    <div><dt class="text-gray-500">Ngày tạo</dt><dd class="m-0 mt-1 text-[#24352a]">{{ formatDate(item.created_at) }}</dd></div>
                  </dl>
                  <div class="mt-auto flex justify-end gap-2 border-t border-[#cbd9c6] pt-3">
                    <button type="button" :aria-label="`Sửa ${item.name}`" class="rounded-md border border-[#cbd9c6] px-2.5 py-1.5 text-xs font-bold text-[#24352a] hover:bg-[#f5f9f0]" @click="openEditForm(item)">Sửa</button>
                    <button type="button" :aria-label="`Xoá ${item.name}`" class="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50" @click="confirmDeleteId = item.id">Xoá</button>
                  </div>
                </div>
              </article>
            </div>
          </section>
        </div>
      </section>

      <div
        v-if="isFormOpen"
        class="absolute inset-0 z-20 bg-black/25 lg:static lg:inset-auto lg:z-auto lg:bg-transparent"
        @click.self="closeForm"
      >
        <SpeciesManagementForm :species="selectedSpecies" @close="closeForm" @saved="closeForm" />
      </div>
    </main>

    <div v-if="confirmDeleteId" class="fixed inset-0 z-40 grid place-items-center bg-black/45 p-4">
      <div class="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <div class="m-0 text-base font-extrabold text-gray-800">Xác nhận xoá loài cá?</div>
        <div class="my-3 text-sm text-gray-600">
          Thao tác này không thể hoàn tác. Các dữ liệu liên quan có thể bị ràng buộc bởi cơ sở dữ liệu.
        </div>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-700"
            @click="confirmDeleteId = null"
          >
            Huỷ
          </button>
          <button
            type="button"
            :disabled="deletingId === confirmDeleteId"
            class="rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
            @click="handleDelete"
          >
            {{ deletingId ? "Đang xoá..." : "Xoá loài" }}
          </button>
        </div>
      </div>
    </div>
    <Pagination :page="speciesStore.page" :page-size="speciesStore.pageSize" :total="speciesStore.total" :loading="speciesStore.isLoading" @change="speciesStore.fetchAll($event)" />
  </AdminModal>
</template>
