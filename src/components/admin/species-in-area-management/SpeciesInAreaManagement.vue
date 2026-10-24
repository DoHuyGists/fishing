<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { storeToRefs } from 'pinia';
import type { SpeciesInAreaPayload, SpeciesInAreaRow } from '../../../data/supabaseSpeciesInAreaRepository';
import { useSpeciesInAreaStore } from './speciesInArea';
import { mapData } from '../../../data/map';
import { useDepthScopeStore } from '../depth-scope-management/depthScope';
import SpeciesInAreaForm from './SpeciesInAreaForm.vue';

const emit = defineEmits(['close']);

const store = useSpeciesInAreaStore();
const { rows, areas, species, loading: isLoading, deletingKey } = storeToRefs(store);
const depthScopeStore = useDepthScopeStore();

const search = ref('');
const areaFilter = ref('ALL');
const speciesFilter = ref('ALL');
const loadError = ref('');
const viewMode = ref<'table' | 'grouped'>('table');
const collapsedAreas = ref<Set<string>>(new Set());

const isFormOpen = ref(false);
const isSaving = computed(() => store.saving);
const formError = ref('');
const confirmDeleteKey = ref<string | null>(null);

const emptyForm = () => ({
  originalAreaId: null as string | null,
  originalSpeciesId: null as string | null,
  areaId: '',
  speciesId: '',
  depthScopeId: '',
  weightRate: 100,
});

const form = reactive(emptyForm());
const areaSearch = ref('');
const speciesSearch = ref('');

function countryName(code: string | null) {
  if (!code) return '';
  return (mapData as any)[code]?.name ?? code;
}

const rowKey = (row: SpeciesInAreaRow) => `${row.areaId}:${row.speciesId}`;

async function loadAll() {
  loadError.value = '';
  try {
    await Promise.all([store.fetchAll(), depthScopeStore.fetchAll()]);
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Unable to load data';
  }
}
const areaFilterOptions = computed(() => {
  const ids = new Set(rows.value.map((row) => row.areaId));
  return areas.value.filter((area) => ids.has(area.id)).sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
});

const speciesFilterOptions = computed(() => {
  const ids = new Set(rows.value.map((row) => row.speciesId));
  return species.value.filter((item) => ids.has(item.id)).sort((a, b) => a.name.localeCompare(b.name));
});

const filteredRows = computed(() => {
  const keyword = search.value.trim().toLocaleLowerCase();
  return rows.value.filter((row) => {
    const matchesSearch =
      !keyword ||
      [row.areaTitle, row.speciesName, countryName(row.areaCountryId), row.speciesRarity].some((value) => value?.toLocaleLowerCase().includes(keyword));
    const matchesArea = areaFilter.value === 'ALL' || row.areaId === areaFilter.value;
    const matchesSpecies = speciesFilter.value === 'ALL' || row.speciesId === speciesFilter.value;
    return matchesSearch && matchesArea && matchesSpecies;
  });
});

interface AreaGroup {
  areaId: string;
  areaTitle: string;
  areaCountryId: string | null;
  items: SpeciesInAreaRow[];
}

const groupedByArea = computed<AreaGroup[]>(() => {
  const groups = new Map<string, AreaGroup>();
  for (const row of filteredRows.value) {
    let group = groups.get(row.areaId);
    if (!group) {
      group = { areaId: row.areaId, areaTitle: row.areaTitle || '(Chưa đặt tên)', areaCountryId: row.areaCountryId, items: [] };
      groups.set(row.areaId, group);
    }
    group.items.push(row);
  }
  for (const group of groups.values()) {
    group.items.sort((a, b) => b.weightRate - a.weightRate);
  }
  return [...groups.values()].sort((a, b) => a.areaTitle.localeCompare(b.areaTitle));
});

function isAreaCollapsed(areaId: string) {
  return collapsedAreas.value.has(areaId);
}

function toggleAreaCollapsed(areaId: string) {
  const next = new Set(collapsedAreas.value);
  if (next.has(areaId)) next.delete(areaId);
  else next.add(areaId);
  collapsedAreas.value = next;
}

const filteredAreaOptions = computed(() => {
  const keyword = areaSearch.value.trim().toLocaleLowerCase();
  const sorted = [...areas.value].sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
  if (!keyword) return sorted;
  return sorted.filter((area) => [area.title, countryName(area.countryId)].some((value) => value?.toLocaleLowerCase().includes(keyword)));
});

const filteredSpeciesOptions = computed(() => {
  const keyword = speciesSearch.value.trim().toLocaleLowerCase();
  const sorted = [...species.value].sort((a, b) => a.name.localeCompare(b.name));
  if (!keyword) return sorted;
  return sorted.filter((item) => [item.name, item.rarity].some((value) => value?.toLocaleLowerCase().includes(keyword)));
});

function openCreateForm() {
  Object.assign(form, emptyForm());
  areaSearch.value = '';
  speciesSearch.value = '';
  formError.value = '';
  isFormOpen.value = true;
}

function openEditForm(row: SpeciesInAreaRow) {
  Object.assign(form, {
    originalAreaId: row.areaId,
    originalSpeciesId: row.speciesId,
    areaId: row.areaId,
    speciesId: row.speciesId,
    depthScopeId: row.depthScopeId ?? '',
    weightRate: row.weightRate,
  });
  areaSearch.value = '';
  speciesSearch.value = '';
  formError.value = '';
  isFormOpen.value = true;
}

function closeForm() {
  isFormOpen.value = false;
  formError.value = '';
}

function buildPayload(): SpeciesInAreaPayload | null {
  if (!form.areaId) {
    formError.value = 'Vui lòng chọn bãi câu';
    return null;
  }
  if (!form.speciesId) {
    formError.value = 'Vui lòng chọn loài cá';
    return null;
  }
  const weightRate = Number(form.weightRate);
  if (!Number.isFinite(weightRate) || weightRate < 0) {
    formError.value = 'Tỉ trọng xuất hiện phải là số không âm';
    return null;
  }
  const isDuplicate = rows.value.some(
    (row) =>
      row.areaId === form.areaId &&
      row.speciesId === form.speciesId &&
      !(row.areaId === form.originalAreaId && row.speciesId === form.originalSpeciesId),
  );
  if (isDuplicate) {
    formError.value = 'Cặp bãi câu / loài cá này đã tồn tại';
    return null;
  }

  return { areaId: form.areaId, speciesId: form.speciesId, weightRate, depthScopeId: form.depthScopeId || null };
}

async function handleSave() {
  formError.value = '';
  const payload = buildPayload();
  if (!payload) return;
  try {
    await store.save(payload, form.originalAreaId, form.originalSpeciesId);
    closeForm();
  } catch (error) {
    formError.value = error instanceof Error ? error.message : 'Unable to save data';
  }
}
function askDelete(row: SpeciesInAreaRow) {
  confirmDeleteKey.value = rowKey(row);
}

function cancelDelete() {
  confirmDeleteKey.value = null;
}

async function handleDelete() {
  const row = rows.value.find((item) => rowKey(item) === confirmDeleteKey.value);
  if (!row) return;
  try {
    await store.remove(row.areaId, row.speciesId);
    if (form.originalAreaId === row.areaId && form.originalSpeciesId === row.speciesId) closeForm();
    confirmDeleteKey.value = null;
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Unable to delete data';
  }
}
onMounted(loadAll);
</script>

<template>
  <div class="fixed inset-0 z-50 flex flex-col bg-gray-50">
    <header class="flex shrink-0 items-center justify-between gap-4 border-b border-emerald-900 bg-[#153221] px-5 py-4 text-white md:px-7">
      <div class="flex min-w-0 items-center gap-3">
        <div class="grid size-10 shrink-0 place-items-center rounded-lg border border-emerald-400/30 bg-emerald-800 text-xl">🎯</div>
        <div class="min-w-0">
          <h2 class="m-0 text-lg font-extrabold">Quản lý cá theo bãi câu</h2>
          <p class="m-0 text-xs text-emerald-200">{{ rows.length }} cấu hình trong bảng species_in_area</p>
        </div>
      </div>
      <button type="button" title="Đóng" aria-label="Đóng" class="grid size-9 shrink-0 place-items-center rounded-lg border border-emerald-600 bg-emerald-900/50 text-xl hover:bg-emerald-800" @click="emit('close')">&times;</button>
    </header>

    <div class="flex shrink-0 flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-5 py-3 md:px-7">
      <div class="relative min-w-55 flex-1">
        <input v-model="search" type="search" placeholder="Tìm theo bãi câu, loài cá, quốc gia, độ hiếm..." class="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none" />
      </div>
      <label class="flex items-center gap-2 text-xs font-semibold text-gray-600">
        Bãi câu
        <select v-model="areaFilter" class="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-700">
          <option value="ALL">Tất cả</option>
          <option v-for="area in areaFilterOptions" :key="area.id" :value="area.id">{{ area.title || '(Chưa đặt tên)' }}</option>
        </select>
      </label>
      <label class="flex items-center gap-2 text-xs font-semibold text-gray-600">
        Loài cá
        <select v-model="speciesFilter" class="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-700">
          <option value="ALL">Tất cả</option>
          <option v-for="item in speciesFilterOptions" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </label>
      <div class="flex items-center gap-1 rounded-lg border border-gray-300 bg-gray-50 p-0.5">
        <button type="button" class="rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors" :class="viewMode === 'table' ? 'bg-white text-[#153221] shadow-sm' : 'text-gray-500 hover:text-gray-700'" @click="viewMode = 'table'">
          ☰ Bảng
        </button>
        <button type="button" class="rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors" :class="viewMode === 'grouped' ? 'bg-white text-[#153221] shadow-sm' : 'text-gray-500 hover:text-gray-700'" @click="viewMode = 'grouped'">
          🗂️ Gom nhóm bãi câu
        </button>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <span class="hidden text-xs text-gray-500 sm:inline">{{ filteredRows.length }} kết quả</span>
        <button type="button" title="Làm mới danh sách" class="grid size-9 place-items-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-50" :disabled="isLoading" @click="loadAll">
          <svg class="size-4" :class="{ 'animate-spin': isLoading }" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </button>
        <button type="button" class="rounded-lg bg-[#153221] px-3.5 py-2 text-sm font-bold text-white hover:bg-emerald-800" @click="openCreateForm">+ Thêm cấu hình</button>
      </div>
    </div>

    <main class="relative flex min-h-0 flex-1">
      <section class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4 md:p-6">
        <div v-if="loadError" class="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{{ loadError }}</span>
          <button type="button" class="font-bold underline" @click="loadAll">Thử lại</button>
        </div>
        <div v-if="isLoading" class="grid min-h-64 place-items-center text-sm text-gray-500">Đang tải dữ liệu...</div>
        <div v-else-if="!filteredRows.length" class="grid min-h-64 place-items-center text-center text-sm text-gray-500">
          <div><span class="mb-2 block text-3xl">🎯</span>{{ rows.length ? 'Không tìm thấy cấu hình phù hợp.' : 'Chưa có cấu hình nào.' }}</div>
        </div>
        <div v-else-if="viewMode === 'grouped'" class="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
          <div v-for="group in groupedByArea" :key="group.areaId" class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <button type="button" class="flex w-full items-center justify-between gap-3 bg-emerald-50/60 px-4 py-3 text-left hover:bg-emerald-50" @click="toggleAreaCollapsed(group.areaId)">
              <div class="flex min-w-0 items-center gap-2">
                <span class="text-sm text-gray-500 transition-transform" :class="{ '-rotate-90': isAreaCollapsed(group.areaId) }">▾</span>
                <span class="truncate text-sm font-extrabold text-[#153221]">📍 {{ group.areaTitle }}</span>
                <span v-if="group.areaCountryId" class="shrink-0 rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-emerald-700">{{ countryName(group.areaCountryId) }}</span>
              </div>
              <span class="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">{{ group.items.length }} loài</span>
            </button>
            <div v-if="!isAreaCollapsed(group.areaId)" class="flex flex-wrap gap-3 p-4">
              <div v-for="row in group.items" :key="rowKey(row)" class="flex min-w-52 flex-1 items-center gap-3 rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2.5">
                <div class="grid size-9 shrink-0 place-items-center rounded-md border border-gray-200 bg-white text-lg">🐟</div>
                <div class="min-w-0 flex-1">
                  <div class="truncate text-sm font-bold text-gray-800" :title="row.speciesName || ''">{{ row.speciesName || '—' }}</div>
                  <div class="flex items-center gap-1.5 text-[11px] text-gray-500">
                    <span v-if="row.speciesRarity">{{ row.speciesRarity }}</span>
                    <span class="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-800">Tỉ trọng {{ row.weightRate }}</span>
                  </div>
                </div>
                <div class="flex shrink-0 items-center gap-1.5">
                  <button type="button" title="Sửa" class="grid size-7 place-items-center rounded-md border border-gray-300 bg-white text-xs font-bold text-gray-700 hover:bg-gray-100" @click="openEditForm(row)">✎</button>
                  <button type="button" title="Xoá" class="grid size-7 place-items-center rounded-md border border-red-200 bg-white text-xs font-bold text-red-700 hover:bg-red-50" @click="askDelete(row)">🗑</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table class="w-full min-w-225 border-separate border-spacing-0 text-left text-sm">
            <thead class="text-[11px] uppercase text-gray-600">
              <tr>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Bãi câu</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Quốc gia</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Loài cá</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Độ hiếm</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Tỉ trọng xuất hiện</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filteredRows" :key="rowKey(row)" class="border-t border-gray-100 hover:bg-emerald-50/40">
                <td class="px-4 py-3 font-semibold text-gray-800">{{ row.areaTitle || '(Chưa đặt tên)' }}</td>
                <td class="px-4 py-3 text-gray-600">{{ countryName(row.areaCountryId) }}</td>
                <td class="px-4 py-3 text-gray-700">{{ row.speciesName || '—' }}</td>
                <td class="px-4 py-3 text-gray-700">{{ row.speciesRarity || '—' }}</td>
                <td class="px-4 py-3">
                  <span class="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">{{ row.weightRate }}</span>
                </td>
                <td class="px-4 py-3">
                  <div class="flex justify-end gap-2">
                    <button type="button" class="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100" @click="openEditForm(row)">Sửa</button>
                    <button type="button" class="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50" @click="askDelete(row)">Xoá</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <SpeciesInAreaForm v-if="isFormOpen" :form="form" :is-saving="isSaving" :error="formError" :areas="areas" :species="species" :depth-scopes="depthScopeStore.items" v-model:area-search="areaSearch" v-model:species-search="speciesSearch" :filtered-area-options="filteredAreaOptions" :filtered-species-options="filteredSpeciesOptions" :country-name="countryName" @close="closeForm" @save="handleSave" />
    </main>

    <div v-if="confirmDeleteKey" class="fixed inset-0 z-40 grid place-items-center bg-black/45 p-4">
      <div class="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h3 class="m-0 text-base font-extrabold text-gray-800">Xác nhận xoá cấu hình?</h3>
        <p class="my-3 text-sm text-gray-600">Thao tác này không thể hoàn tác.</p>
        <div class="flex justify-end gap-2">
          <button type="button" class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-700" @click="cancelDelete">Huỷ</button>
          <button type="button" :disabled="!!deletingKey" class="rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50" @click="handleDelete">{{ deletingKey ? 'Đang xoá...' : 'Xoá' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
