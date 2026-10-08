<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { mapData } from "../../../data/map.ts";
import InteractWorldMap from "../../world-map/InteractWorldMap.vue";
import { useAdminFishingAreaStore } from "./admin-fishing-area-store.ts";
import FishingAreaManagementForm from "./FishingAreaManagementForm.vue";
import { useWorldStore } from "../../../stores/world.ts";

const emit = defineEmits(["close"]);
const adminFishingAreaStore = useAdminFishingAreaStore();
const worldStore = useWorldStore();
const search = ref("");
const countryFilter = ref("ALL");
const availabilityFilter = ref<"ALL" | "AVAILABLE" | "UNAVAILABLE">("ALL");

const deletingId = ref<string | null>(null);
const confirmDeleteId = ref<string | null>(null);

const countryOptions = computed(() =>
  Object.entries(mapData)
    .map(([code, info]) => ({ code, name: (info as any).name }))
    .sort((a, b) => a.name.localeCompare(b.name)),
);

const countryFilterOptions = computed(() => {
  const codes = new Set(adminFishingAreaStore.adminAreas.map((area) => area.countryId));
  return countryOptions.value.filter((option) => codes.has(option.code));
});

function countryName(code: string) {
  return (mapData as any)[code]?.name ?? code;
}

const filteredAreas = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  return adminFishingAreaStore.adminAreas.filter((area) => {
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
    await adminFishingAreaStore.deleteAreaAdmin(confirmDeleteId.value);
    // if (form.id === confirmDeleteId.value) closeForm();
  } catch (err) {
    adminFishingAreaStore.adminError = err instanceof Error ? err.message : "Không thể xoá bãi câu";
  } finally {
    deletingId.value = null;
    confirmDeleteId.value = null;
  }
}

adminFishingAreaStore.fetchAllAreasAdmin();

watch(
  () => adminFishingAreaStore.isFormOpen,
  (isFormOpen) => {
    if (isFormOpen === false) {
      adminFishingAreaStore.resetDefault();
      worldStore.resetDefault();
    }
  },
  { immediate: true, deep: true },
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
        @click="adminFishingAreaStore.fetchAllAreasAdmin"
        title="Làm mới danh sách"
        class="px-3 py-1.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-100 text-gray-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
      >
        <svg
          class="w-3.5 h-3.5"
          :class="{ 'animate-spin': adminFishingAreaStore.adminLoading }"
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
        @click="adminFishingAreaStore.openForm()"
        class="px-3 py-1.5 rounded-lg bg-[#153221] hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
      >
        <span>+ Thêm bãi câu</span>
      </button>
    </div>

    <!-- Body -->
    <div class="flex-1 flex min-h-0">
      <!-- List -->
      <div v-if="!adminFishingAreaStore.isFormOpen" class="flex-1 min-w-0 overflow-y-auto p-6 bg-gray-50/50">
        <div
          v-if="adminFishingAreaStore.adminLoading"
          class="py-16 text-center text-gray-500 text-xs flex flex-col items-center gap-2"
        >
          <div class="w-8 h-8 border border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Đang tải danh sách bãi câu...</span>
        </div>

        <div v-else-if="adminFishingAreaStore.adminError" class="py-16 text-center text-red-500 text-xs">
          {{ adminFishingAreaStore.adminError }}
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
                      @click="adminFishingAreaStore.openForm(area)"
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
      <div v-else class="flex gap-2 p-2">
        <InteractWorldMap />

        <!-- Form panel -->
        <FishingAreaManagementForm />
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
