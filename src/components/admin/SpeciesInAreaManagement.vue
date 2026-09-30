<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { supabaseSpeciesInAreaRepository, type SpeciesInAreaPayload, type SpeciesInAreaRow } from '../../data/supabaseSpeciesInAreaRepository';
import { supabaseFishingAreaRepository, type FishingAreaRow } from '../../data/supabaseFishingAreaRepository';
import { supabaseSpeciesRepository, type SpeciesRow } from '../../data/supabaseSpeciesRepository';
import { mapData } from '../../data/map';

const emit = defineEmits(['close']);

const rows = ref<SpeciesInAreaRow[]>([]);
const areas = ref<FishingAreaRow[]>([]);
const species = ref<SpeciesRow[]>([]);

const search = ref('');
const areaFilter = ref('ALL');
const speciesFilter = ref('ALL');
const isLoading = ref(false);
const loadError = ref('');
const viewMode = ref<'table' | 'grouped'>('table');
const collapsedAreas = ref<Set<string>>(new Set());

const isFormOpen = ref(false);
const isSaving = ref(false);
const formError = ref('');
const deletingKey = ref<string | null>(null);
const confirmDeleteKey = ref<string | null>(null);

const emptyForm = () => ({
  originalAreaId: null as string | null,
  originalSpeciesId: null as string | null,
  areaId: '',
  speciesId: '',
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
  isLoading.value = true;
  loadError.value = '';
  try {
    const [rowsData, areasData, speciesData] = await Promise.all([
      supabaseSpeciesInAreaRepository.fetchAll(),
      supabaseFishingAreaRepository.fetchAllAreasAdmin(),
      supabaseSpeciesRepository.fetchAll(),
    ]);
    rows.value = rowsData;
    areas.value = areasData;
    species.value = speciesData;
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Không thể tải dữ liệu';
  } finally {
    isLoading.value = false;
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

  return { areaId: form.areaId, speciesId: form.speciesId, weightRate };
}

async function handleSave() {
  formError.value = '';
  const payload = buildPayload();
  if (!payload) return;

  isSaving.value = true;
  try {
    if (form.originalAreaId && form.originalSpeciesId) {
      await supabaseSpeciesInAreaRepository.update(form.originalAreaId, form.originalSpeciesId, payload);
    } else {
      await supabaseSpeciesInAreaRepository.create(payload);
    }
    closeForm();
    await loadAll();
  } catch (error) {
    formError.value = error instanceof Error ? error.message : 'Không thể lưu dữ liệu';
  } finally {
    isSaving.value = false;
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
  deletingKey.value = rowKey(row);
  try {
    await supabaseSpeciesInAreaRepository.delete(row.areaId, row.speciesId);
    if (form.originalAreaId === row.areaId && form.originalSpeciesId === row.speciesId) closeForm();
    confirmDeleteKey.value = null;
    await loadAll();
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Không thể xoá dữ liệu';
  } finally {
    deletingKey.value = null;
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
      <section class="min-w-0 flex-1 overflow-auto p-4 md:p-6">
        <div v-if="loadError" class="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{{ loadError }}</span>
          <button type="button" class="font-bold underline" @click="loadAll">Thử lại</button>
        </div>
        <div v-if="isLoading" class="grid min-h-64 place-items-center text-sm text-gray-500">Đang tải dữ liệu...</div>
        <div v-else-if="!filteredRows.length" class="grid min-h-64 place-items-center text-center text-sm text-gray-500">
          <div><span class="mb-2 block text-3xl">🎯</span>{{ rows.length ? 'Không tìm thấy cấu hình phù hợp.' : 'Chưa có cấu hình nào.' }}</div>
        </div>
        <div v-else-if="viewMode === 'grouped'" class="flex flex-col gap-4">
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
        <div v-else class="rounded-lg border border-gray-200 bg-white shadow-sm">
          <table class="w-full min-w-225 border-collapse text-left text-sm">
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

      <div v-if="isFormOpen" class="absolute inset-0 z-20 bg-black/25 lg:static lg:inset-auto lg:z-auto lg:bg-transparent" @click.self="closeForm">
        <aside class="ml-auto flex h-full w-full max-w-lg flex-col border-l border-gray-200 bg-white shadow-xl">
          <div class="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-4">
            <div>
              <h3 class="m-0 text-base font-extrabold text-[#153221]">{{ form.originalAreaId ? 'Chỉnh sửa cấu hình' : 'Thêm cấu hình' }}</h3>
              <p class="m-0 mt-1 text-xs text-gray-500">Thông tin trong bảng species_in_area</p>
            </div>
            <button type="button" aria-label="Đóng biểu mẫu" class="grid size-8 place-items-center rounded-md text-xl text-gray-500 hover:bg-gray-100" @click="closeForm">&times;</button>
          </div>
          <form class="flex-1 space-y-4 overflow-y-auto p-5" @submit.prevent="handleSave">
            <div v-if="formError" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{{ formError }}</div>

            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-bold text-gray-600">Bãi câu *</label>
              <input v-model="areaSearch" type="search" placeholder="Tìm bãi câu..." class="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none" />
              <select v-model="form.areaId" size="6" class="rounded-md border border-gray-300 text-sm focus:border-emerald-600 focus:outline-none">
                <option v-for="area in filteredAreaOptions" :key="area.id" :value="area.id">{{ area.title || '(Chưa đặt tên)' }} — {{ countryName(area.countryId) }}</option>
              </select>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-bold text-gray-600">Loài cá *</label>
              <input v-model="speciesSearch" type="search" placeholder="Tìm loài cá..." class="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none" />
              <select v-model="form.speciesId" size="6" class="rounded-md border border-gray-300 text-sm focus:border-emerald-600 focus:outline-none">
                <option v-for="item in filteredSpeciesOptions" :key="item.id" :value="item.id">{{ item.name }}<template v-if="item.rarity"> — {{ item.rarity }}</template></option>
              </select>
            </div>

            <label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600">Tỉ trọng xuất hiện (weight_rate)
              <input v-model.number="form.weightRate" type="number" min="0" step="1" class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800 focus:border-emerald-600 focus:outline-none" />
              <span class="text-[11px] font-normal text-gray-400">Giá trị càng cao thì loài cá càng dễ xuất hiện tại bãi câu này.</span>
            </label>
          </form>
          <div class="flex shrink-0 items-center justify-end gap-2 border-t border-gray-200 px-5 py-4">
            <button type="button" class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100" @click="closeForm">Huỷ</button>
            <button type="button" :disabled="isSaving" class="rounded-lg bg-[#153221] px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50" @click="handleSave">{{ isSaving ? 'Đang lưu...' : 'Lưu cấu hình' }}</button>
          </div>
        </aside>
      </div>
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
