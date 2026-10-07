<script lang="ts" setup>
import { computed, reactive, ref, watch } from "vue";
import { useFishingAreaStore } from "../../stores/fishingArea";
import { mapData } from "../../data/map";
import type { FishingAreaPayload, FishingAreaRow } from "../../data/supabaseFishingAreaRepository";
import InteractWorldWrapper from "../../components/world-map/InteractWorldMap.vue";
import { useWorldStore } from "../../stores/world.ts";

const emit = defineEmits(["close"]);
const fishingAreaStore = useFishingAreaStore();
const worldStore = useWorldStore();

const search = ref("");
const countryFilter = ref("ALL");
const availabilityFilter = ref<"ALL" | "AVAILABLE" | "UNAVAILABLE">("ALL");

const isFormOpen = ref(false);
const isSaving = ref(false);
const formError = ref("");
const deletingId = ref<string | null>(null);
const confirmDeleteId = ref<string | null>(null);

const emptyForm = () => ({
  id: null as string | null,
  countryId: "VN",
  isAvailable: false,
  x: 0,
  y: 0,
  title: "",
  scenePath: "",
  locationJson: "",
  boundaryJson: "[]",
});

const form = reactive(emptyForm());

const countryOptions = computed(() =>
  Object.entries(mapData)
    .map(([code, info]) => ({ code, name: (info as any).name }))
    .sort((a, b) => a.name.localeCompare(b.name)),
);

const countryFilterOptions = computed(() => {
  const codes = new Set(fishingAreaStore.adminAreas.map((area) => area.countryId));
  return countryOptions.value.filter((option) => codes.has(option.code));
});

function countryName(code: string) {
  return (mapData as any)[code]?.name ?? code;
}

const filteredAreas = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  return fishingAreaStore.adminAreas.filter((area) => {
    const keywordMatch =
      !keyword ||
      area.title?.toLowerCase().includes(keyword) ||
      area.scenePath?.toLowerCase().includes(keyword) ||
      countryName(area.countryId).toLowerCase().includes(keyword);

    const countryMatch = countryFilter.value === "ALL" || area.countryId === countryFilter.value;

    const availabilityMatch =
      availabilityFilter.value === "ALL" ||
      (availabilityFilter.value === "AVAILABLE" && area.isAvailable) ||
      (availabilityFilter.value === "UNAVAILABLE" && !area.isAvailable);

    return keywordMatch && countryMatch && availabilityMatch;
  });
});

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("vi-VN");
}

function openCreateForm() {
  Object.assign(form, emptyForm());
  formError.value = "";
  isFormOpen.value = true;
}

function openEditForm(area: FishingAreaRow) {
  form.id = area.id;
  form.countryId = area.countryId;
  form.isAvailable = area.isAvailable;
  form.x = area.x;
  form.y = area.y;
  form.title = area.title ?? "";
  form.scenePath = area.scenePath ?? "";
  form.locationJson = area.location ? JSON.stringify(area.location, null, 2) : "";
  form.boundaryJson = JSON.stringify(area.fishingBoundary ?? [], null, 2);
  formError.value = "";
  isFormOpen.value = true;
}

function closeForm() {
  isFormOpen.value = false;
  formError.value = "";
}

function buildPayload(): FishingAreaPayload | null {
  if (!form.countryId) {
    formError.value = "Vui lòng chọn quốc gia";
    return null;
  }

  let location: any = null;
  if (form.locationJson.trim()) {
    try {
      location = JSON.parse(form.locationJson);
    } catch {
      formError.value = "Location không đúng định dạng JSON";
      return null;
    }
  }

  let fishingBoundary: any[];
  try {
    fishingBoundary = JSON.parse(form.boundaryJson.trim() || "[]");
  } catch {
    formError.value = "Vùng câu (fishing_boundary) không đúng định dạng JSON";
    return null;
  }

  if (
    !Array.isArray(fishingBoundary) ||
    !fishingBoundary.every((point) => point && typeof point.x === "number" && typeof point.y === "number")
  ) {
    formError.value = 'Vùng câu (fishing_boundary) phải là mảng các object dạng {"x": number, "y": number}';
    return null;
  }

  return {
    countryId: form.countryId,
    isAvailable: form.isAvailable,
    x: Number(form.x),
    y: Number(form.y),
    title: form.title.trim() || null,
    location,
    scenePath: form.scenePath.trim() || null,
    fishingBoundary,
  };
}

async function handleSave() {
  formError.value = "";
  const payload = buildPayload();
  if (!payload) return;

  isSaving.value = true;
  try {
    if (form.id) {
      await fishingAreaStore.updateAreaAdmin(form.id, payload);
    } else {
      await fishingAreaStore.createAreaAdmin(payload);
    }
    closeForm();
  } catch (err) {
    formError.value = err instanceof Error ? err.message : "Không thể lưu bãi câu";
  } finally {
    isSaving.value = false;
  }
}

function askDelete(id: string) {
  confirmDeleteId.value = id;
}

function cancelDelete() {
  confirmDeleteId.value = null;
}

async function handleDelete() {
  if (!confirmDeleteId.value) return;
  deletingId.value = confirmDeleteId.value;
  try {
    await fishingAreaStore.deleteAreaAdmin(confirmDeleteId.value);
    if (form.id === confirmDeleteId.value) closeForm();
  } catch (err) {
    fishingAreaStore.adminError = err instanceof Error ? err.message : "Không thể xoá bãi câu";
  } finally {
    deletingId.value = null;
    confirmDeleteId.value = null;
  }
}

fishingAreaStore.fetchAllAreasAdmin();

watch(
  () => [worldStore.selectedLocation],
  ([newSelectedLocation]) => {
    if(worldStore.isAnchorMode && newSelectedLocation){
      form.x = newSelectedLocation.x;
      form.y = newSelectedLocation.y;
      // form.locationJson = JSON.stringify(getCurrentArea);
    }
  }
);
</script>

<template>
  <div class="fixed inset-0 z-50 flex flex-col bg-white">
    <!-- Header -->
    <div
      class="px-6 py-4 bg-[#153221] text-white flex items-center justify-between border-b border-emerald-800 shrink-0"
    >
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-xl bg-emerald-700/60 border border-emerald-500/40 grid place-items-center text-xl shadow-inner"
        >
          🗺️
        </div>
        <div>
          <h2 class="m-0 text-lg font-extrabold tracking-wide">Quản lý bãi câu</h2>
          <p class="m-0 text-xs text-emerald-200">Thêm, sửa, xoá và tìm kiếm bãi câu (fishing_areas)</p>
        </div>
      </div>

      <button
        type="button"
        class="w-8 h-8 rounded-full border border-emerald-600/50 bg-emerald-900/50 text-white hover:bg-emerald-800 font-bold text-lg flex items-center justify-center cursor-pointer transition-colors"
        @click="emit('close')"
      >
        &times;
      </button>
    </div>

    <!-- Toolbar -->
    <div class="px-6 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center gap-3 shrink-0">
      <div class="relative flex-1 min-w-55">
        <input
          v-model="search"
          type="text"
          placeholder="Tìm theo tên, quốc gia, đường dẫn cảnh..."
          class="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400 bg-white"
        />
        <svg
          class="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      <div class="flex items-center gap-1 text-xs">
        <span class="text-gray-500 font-medium text-[11px]">Quốc gia:</span>
        <select
          v-model="countryFilter"
          class="px-2 py-1 border border-gray-300 rounded-lg text-xs bg-white text-gray-700 focus:outline-none"
        >
          <option value="ALL">Tất cả</option>
          <option v-for="option in countryFilterOptions" :key="option.code" :value="option.code">
            {{ option.name }}
          </option>
        </select>
      </div>

      <div class="flex items-center gap-1 text-xs">
        <span class="text-gray-500 font-medium text-[11px]">Trạng thái:</span>
        <select
          v-model="availabilityFilter"
          class="px-2 py-1 border border-gray-300 rounded-lg text-xs bg-white text-gray-700 focus:outline-none"
        >
          <option value="ALL">Tất cả</option>
          <option value="AVAILABLE">Đang hoạt động</option>
          <option value="UNAVAILABLE">Chưa kích hoạt</option>
        </select>
      </div>

      <div class="flex-1"></div>

      <button
        type="button"
        @click="fishingAreaStore.fetchAllAreasAdmin"
        title="Làm mới danh sách"
        class="px-3 py-1.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-100 text-gray-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
      >
        <svg
          class="w-3.5 h-3.5"
          :class="{ 'animate-spin': fishingAreaStore.adminLoading }"
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
        <span>Làm mới</span>
      </button>

      <button
        type="button"
        @click="openCreateForm"
        class="px-3 py-1.5 rounded-lg bg-[#153221] hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
      >
        <span>+ Thêm bãi câu</span>
      </button>
    </div>

    <!-- Body -->
    <div class="flex-1 flex min-h-0">
      <!-- List -->
      <div v-if="!isFormOpen" class="flex-1 min-w-0 overflow-y-auto p-6 bg-gray-50/50">
        <div
          v-if="fishingAreaStore.adminLoading"
          class="py-16 text-center text-gray-500 text-xs flex flex-col items-center gap-2"
        >
          <div class="w-8 h-8 border border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Đang tải danh sách bãi câu...</span>
        </div>

        <div v-else-if="fishingAreaStore.adminError" class="py-16 text-center text-red-500 text-xs">
          {{ fishingAreaStore.adminError }}
        </div>

        <div v-else-if="!filteredAreas.length" class="py-16 text-center text-gray-400 text-xs">
          <span class="text-3xl block mb-2">🎣</span>
          <p class="m-0 font-medium">Không tìm thấy bãi câu nào phù hợp.</p>
        </div>

        <div v-else class="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
          <table class="w-full text-xs text-left border-collapse">
            <thead class="bg-gray-100 text-gray-600 uppercase text-[10px] tracking-wide">
              <tr>
                <th class="px-4 py-2.5">Tên</th>
                <th class="px-4 py-2.5">Quốc gia</th>
                <th class="px-4 py-2.5">Toạ độ (x, y)</th>
                <th class="px-4 py-2.5">Đường dẫn cảnh</th>
                <th class="px-4 py-2.5">Vùng câu</th>
                <th class="px-4 py-2.5">Trạng thái</th>
                <th class="px-4 py-2.5">Tạo lúc</th>
                <th class="px-4 py-2.5 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="area in filteredAreas" :key="area.id" class="border-t border-gray-100 hover:bg-emerald-50/40">
                <td class="px-4 py-2.5 font-semibold text-gray-800">{{ area.title || "(Chưa đặt tên)" }}</td>
                <td class="px-4 py-2.5 text-gray-600">{{ countryName(area.countryId) }}</td>
                <td class="px-4 py-2.5 text-gray-600">{{ area.x }}, {{ area.y }}</td>
                <td class="px-4 py-2.5 text-gray-500 truncate max-w-45" :title="area.scenePath || ''">
                  {{ area.scenePath || "—" }}
                </td>
                <td class="px-4 py-2.5 text-gray-500">{{ area.fishingBoundary?.length || 0 }} điểm</td>
                <td class="px-4 py-2.5">
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                    :class="
                      area.isAvailable
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-gray-100 text-gray-600 border-gray-300'
                    "
                  >
                    {{ area.isAvailable ? "Hoạt động" : "Chưa bật" }}
                  </span>
                </td>
                <td class="px-4 py-2.5 text-gray-400 whitespace-nowrap">{{ formatDate(area.createdAt) }}</td>
                <td class="px-4 py-2.5">
                  <div class="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      @click="openEditForm(area)"
                      class="px-2.5 py-1 rounded-lg border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold cursor-pointer transition-colors"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      @click="askDelete(area.id)"
                      :disabled="deletingId === area.id"
                      class="px-2.5 py-1 rounded-lg border border-red-300 hover:bg-red-50 text-red-600 font-bold cursor-pointer transition-colors disabled:opacity-50"
                    >
                      Xoá
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <InteractWorldWrapper v-else />

      <!-- Form panel -->
      <div v-if="isFormOpen" class="w-full sm:w-105 shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
        <div class="p-5 flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <h3 class="m-0 text-sm font-extrabold text-[#153221]">
              {{ form.id ? "Chỉnh sửa bãi câu" : "Thêm bãi câu mới" }}
            </h3>
            <button
              type="button"
              @click="closeForm"
              class="text-gray-400 hover:text-gray-700 cursor-pointer text-lg leading-none"
            >
              &times;
            </button>
          </div>

          <div v-if="formError" class="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs">
            {{ formError }}
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold text-gray-500 uppercase">Tên bãi câu</label>
            <input
              v-model="form.title"
              type="text"
              placeholder="Ví dụ: Hồ Xanh"
              class="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold text-gray-500 uppercase">Quốc gia</label>
            <select
              v-model="form.countryId"
              class="px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:border-emerald-500"
            >
              <option v-for="option in countryOptions" :key="option.code" :value="option.code">
                {{ option.name }}
              </option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-[11px] font-bold text-gray-500 uppercase">Toạ độ X</label>
              <input
                v-model.number="form.x"
                type="number"
                step="any"
                class="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[11px] font-bold text-gray-500 uppercase">Toạ độ Y</label>
              <input
                v-model.number="form.y"
                type="number"
                step="any"
                class="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <label class="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer select-none">
            <input v-model="form.isAvailable" type="checkbox" class="w-4 h-4 accent-emerald-700" />
            Kích hoạt (hiển thị trên bản đồ)
          </label>

          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold text-gray-500 uppercase">Đường dẫn cảnh (scene_path)</label>
            <input
              v-model="form.scenePath"
              type="text"
              placeholder="area/VN/770.400"
              class="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold text-gray-500 uppercase">Location (JSON, không bắt buộc)</label>
            <textarea
              v-model="form.locationJson"
              rows="4"
              placeholder='{"x": 0, "y": 0, "zoom": 1}'
              class="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-mono focus:outline-none focus:border-emerald-500"
            ></textarea>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold text-gray-500 uppercase">Vùng câu (fishing_boundary, JSON)</label>
            <textarea
              v-model="form.boundaryJson"
              rows="10"
              placeholder='[{"x": 0, "y": 0}, {"x": 10, "y": 0}]'
              class="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-mono focus:outline-none focus:border-emerald-500"
            ></textarea>
            <p class="text-[11px] text-gray-400">
              Dán mảng các object dạng {{ '{ "x": number, "y": number }' }} tạo thành vòng cung giới hạn phạm vi quăng
              mồi.
            </p>
          </div>

          <div class="flex items-center gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              @click="handleSave"
              :disabled="isSaving"
              class="flex-1 px-3 py-2 rounded-lg bg-[#153221] hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
            >
              {{ isSaving ? "Đang lưu..." : "Lưu" }}
            </button>
            <button
              type="button"
              @click="closeForm"
              class="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-bold cursor-pointer transition-colors"
            >
              Huỷ
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete confirmation -->
    <div v-if="confirmDeleteId" class="fixed inset-0 z-60 bg-black/40 flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-lg p-5 w-full max-w-sm">
        <h4 class="m-0 text-sm font-extrabold text-gray-800 mb-2">Xác nhận xoá</h4>
        <p class="text-xs text-gray-500 mb-4">Bạn có chắc muốn xoá bãi câu này? Hành động này không thể hoàn tác.</p>
        <div class="flex items-center justify-end gap-2">
          <button
            type="button"
            @click="cancelDelete"
            class="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-bold cursor-pointer transition-colors"
          >
            Huỷ
          </button>
          <button
            type="button"
            @click="handleDelete"
            :disabled="deletingId === confirmDeleteId"
            class="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
          >
            Xoá
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
