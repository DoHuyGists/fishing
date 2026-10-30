<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import type { SpeciesRow } from "../../../data/supabaseSpeciesRepository";
import { useAdminSpeciesStore } from "./species-store";
import SpeciesManagementForm from "./SpeciesManagementForm.vue";

const emit = defineEmits(["close"]);
const speciesStore = useAdminSpeciesStore();

const search = ref("");
const statusFilter = ref("ALL");
const rarityFilter = ref("ALL");
const isFormOpen = ref(false);
const selectedSpecies = ref<SpeciesRow | null>(null);
const deletingId = ref<string | null>(null);
const confirmDeleteId = ref<string | null>(null);

const statusOptions = computed(() =>
  [...new Set(speciesStore.species.map((item) => item.status).filter((value): value is string => Boolean(value)))].sort(),
);
const rarityOptions = computed(() =>
  [...new Set(speciesStore.species.map((item) => item.rarity).filter((value): value is string => Boolean(value)))].sort(),
);

const filteredSpecies = computed(() => {
  const keyword = search.value.trim().toLocaleLowerCase();
  return speciesStore.species.filter((item) => {
    const matchesSearch =
      !keyword ||
      [item.name, item.location, item.status, item.rarity, item.information, item.image].some((value) =>
        value?.toLocaleLowerCase().includes(keyword),
      );
    const matchesStatus = statusFilter.value === "ALL" || item.status === statusFilter.value;
    const matchesRarity = rarityFilter.value === "ALL" || item.rarity === rarityFilter.value;
    return matchesSearch && matchesStatus && matchesRarity;
  });
});

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
  <div class="fixed inset-0 z-50 flex flex-col bg-gray-50">
    <header
      class="flex shrink-0 items-center justify-between gap-4 border-b border-emerald-900 bg-[#153221] px-5 py-4 text-white md:px-7"
    >
      <div class="flex min-w-0 items-center gap-3">
        <div class="grid size-10 shrink-0 place-items-center rounded-lg border border-emerald-400/30 bg-emerald-800 text-xl">
          🐟
        </div>
        <div class="min-w-0">
          <h2 class="m-0 text-lg font-extrabold">Quản lý loài cá</h2>
          <p class="m-0 text-xs text-emerald-200">{{ speciesStore.species.length }} loài trong danh mục</p>
        </div>
      </div>
      <button
        type="button"
        title="Đóng"
        aria-label="Đóng"
        class="grid size-9 shrink-0 place-items-center rounded-lg border border-emerald-600 bg-emerald-900/50 text-xl hover:bg-emerald-800"
        @click="emit('close')"
      >
        &times;
      </button>
    </header>

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
        <select v-model="statusFilter" class="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-700">
          <option value="ALL">Tất cả</option>
          <option v-for="status in statusOptions" :key="status" :value="status">{{ status }}</option>
        </select>
      </label>
      <label class="flex items-center gap-2 text-xs font-semibold text-gray-600">
        Độ hiếm
        <select v-model="rarityFilter" class="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-700">
          <option value="ALL">Tất cả</option>
          <option v-for="rarity in rarityOptions" :key="rarity" :value="rarity">{{ rarity }}</option>
        </select>
      </label>
      <div class="ml-auto flex items-center gap-2">
        <span class="hidden text-xs text-gray-500 sm:inline">{{ filteredSpecies.length }} kết quả</span>
        <button
          type="button"
          title="Làm mới danh sách"
          class="grid size-9 place-items-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          :disabled="speciesStore.isLoading"
          @click="speciesStore.fetchAll"
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
      <section class="min-w-0 flex-1 overflow-auto p-4 md:p-6">
        <div
          v-if="speciesStore.error"
          class="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{{ speciesStore.error }}</span>
          <button type="button" class="font-bold underline" @click="speciesStore.fetchAll">Thử lại</button>
        </div>
        <div v-if="speciesStore.isLoading" class="grid min-h-64 place-items-center text-sm text-gray-500">
          Đang tải danh sách loài cá...
        </div>
        <div v-else-if="!filteredSpecies.length" class="grid min-h-64 place-items-center text-center text-sm text-gray-500">
          <div>
            <span class="mb-2 block text-3xl">🎣</span>
            {{ speciesStore.species.length ? "Không tìm thấy loài cá phù hợp." : "Chưa có loài cá nào." }}
          </div>
        </div>
        <div v-else class="rounded-lg border border-gray-200 bg-white shadow-sm">
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
              <tr v-for="item in filteredSpecies" :key="item.id" class="border-t border-gray-100 hover:bg-emerald-50/40">
                <td class="max-w-[25rem] px-4 py-3">
                  <div class="flex items-center gap-3">
                    <img
                      v-if="item.image"
                      :src="item.image"
                      :alt="item.name"
                      class="size-12 shrink-0 rounded-md border border-gray-200 bg-gray-50 object-cover"
                      loading="lazy"
                    />
                    <div v-else class="grid size-12 shrink-0 place-items-center rounded-md border border-gray-200 bg-gray-50 text-xl">
                      🐟
                    </div>
                    <div class="min-w-0">
                      <div class="truncate font-bold text-gray-800" :title="item.name">{{ item.name }}</div>
                      <div
                        class="mt-1 max-w-[22rem] truncate text-xs text-gray-500"
                        :title="item.information || ''"
                      >
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
                  <span class="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
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
      </section>

      <div
        v-if="isFormOpen"
        class="absolute inset-0 z-20 bg-black/25 lg:static lg:inset-auto lg:z-auto lg:bg-transparent"
        @click.self="closeForm"
      >
        <SpeciesManagementForm
          :species="selectedSpecies"
          @close="closeForm"
          @saved="closeForm"
        />
      </div>
    </main>

    <div v-if="confirmDeleteId" class="fixed inset-0 z-40 grid place-items-center bg-black/45 p-4">
      <div class="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h3 class="m-0 text-base font-extrabold text-gray-800">Xác nhận xoá loài cá?</h3>
        <p class="my-3 text-sm text-gray-600">
          Thao tác này không thể hoàn tác. Các dữ liệu liên quan có thể bị ràng buộc bởi cơ sở dữ liệu.
        </p>
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
  </div>
</template>
