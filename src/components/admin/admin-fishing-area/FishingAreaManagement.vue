<script lang="ts" setup>
import AdminModal from "../AdminModal.vue";
import Pagination from "../../shared/Pagination.vue";
import { usePagedListFilters } from "../../../composables/usePagedListFilters";
import { computed, nextTick, ref, watch } from "vue";
import type { FishingAreaRow } from "../../../types/table/fishingArea";
import { mapData } from "../../../data/map.ts";
import InteractWorldMap2 from "../../player/player-world-map/InteractWorldMap.vue";
import { useAdminFishingAreaStore } from "./admin-fishing-area-store.ts";
import FishingAreaManagementForm from "./FishingAreaManagementForm.vue";
import FishingAreaCard from "./FishingAreaCard.vue";
import { useWorldStore } from "../../../stores/player-world-map-store.ts";

const emit = defineEmits(["close"]);
const adminFishingAreaStore = useAdminFishingAreaStore();
const worldStore = useWorldStore();
const search = computed({
  get: () => adminFishingAreaStore.search,
  set: (value) => {
    adminFishingAreaStore.search = value;
  },
});
const countryFilter = computed({
  get: () => adminFishingAreaStore.countryFilter,
  set: (value) => {
    adminFishingAreaStore.countryFilter = value;
  },
});
const availabilityFilter = computed({
  get: () => adminFishingAreaStore.availabilityFilter,
  set: (value) => {
    adminFishingAreaStore.availabilityFilter = value;
  },
});
usePagedListFilters(
  [search, countryFilter, availabilityFilter],
  () => {
    void adminFishingAreaStore.fetchAllAreasAdmin(1);
  },
  () => {
    ++adminFishingAreaStore.requestId;
  },
);

const deletingId = ref<string | null>(null);
const viewMode = computed({
  get: () => adminFishingAreaStore.viewMode,
  set: (value) => { adminFishingAreaStore.viewMode = value; },
});
watch(viewMode, (mode, previous) => {
  if (mode === 'group' || previous === 'group') {
    void adminFishingAreaStore.fetchAllAreasAdmin(1);
  }
});
const viewModes = [
  { value: "list", label: "Danh sách" },
  { value: "grid", label: "Lưới" },
  { value: "group", label: "Theo quốc gia" },
] as const;
const areaGroups = computed(() => {
  if (viewMode.value !== "group") return [{ code: "all", name: "", areas: filteredAreas.value }];
  const groups = new Map<string, FishingAreaRow[]>();
  for (const area of filteredAreas.value) {
    const code = area.countryId?.trim() || "";
    const areas = groups.get(code) ?? [];
    areas.push(area);
    groups.set(code, areas);
  }
  return Array.from(groups, ([code, areas]) => ({ code, name: countryName(code), areas }))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
});
const confirmDeleteId = ref<string | null>(null);
const imagePreview = ref<{ src: string; title: string } | null>(null);
const failedImageUrls = ref(new Set<string>());
const previewCloseButton = ref<HTMLButtonElement | null>(null);
let previewTrigger: HTMLButtonElement | null = null;

function sceneImageUrl(area: FishingAreaRow) {
  const path = area.scenePath?.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  return path ? `${path}/day.png` : "";
}

async function openImagePreview(area: FishingAreaRow, event: MouseEvent) {
  const src = sceneImageUrl(area);
  if (!src) return;
  previewTrigger = event.currentTarget as HTMLButtonElement;
  imagePreview.value = { src, title: area.title || "(Chưa đặt tên)" };
  await nextTick();
  previewCloseButton.value?.focus();
}

function closeImagePreview() {
  imagePreview.value = null;
  previewTrigger?.focus();
  previewTrigger = null;
}

const countryOptions = computed(() =>
  Object.entries(mapData)
    .map(([code]) => ({ code, name: countryName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name)),
);

const countryFilterOptions = computed(() => {
  const codes = new Set(adminFishingAreaStore.countryIds);
  return countryOptions.value.filter((option) => codes.has(option.code));
});

function countryName(code: string | null | undefined): string {
  const normalizedCode = code?.trim();
  if (!normalizedCode) return "Chưa có quốc gia";
  const name = mapData[normalizedCode as keyof typeof mapData]?.name;
  return typeof name === "string" && name.trim() ? name : normalizedCode;
}

const filteredAreas = computed(() => {
  return adminFishingAreaStore.adminAreas;
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
  <AdminModal title="Quản lý bãi câu" icon="🗺️" @close="emit('close')">
    <!-- Toolbar -->
    <div
      v-if="!adminFishingAreaStore.isFormOpen"
      class="px-6 py-3 bg-white border-b border-border flex flex-wrap items-center gap-3 shrink-0"
    >
      <div class="relative flex-1 min-w-55">
        <input
          v-model="search"
          type="text"
          placeholder="Tìm theo tên, quốc gia, đường dẫn cảnh..."
          class="w-full pl-8 pr-3 py-1.5 text-xs border border-content rounded-lg focus:outline-none focus:border-content bg-white"
        />
        <svg
          class="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-content"
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
        <span class="text-content font-medium text-[11px]">Quốc gia:</span>
        <select
          v-model="countryFilter"
          class="px-2 py-1 border border-content rounded-lg text-xs bg-white text-content focus:outline-none"
        >
          <option value="ALL">Tất cả</option>
          <option v-for="option in countryFilterOptions" :key="option.code" :value="option.code">
            {{ option.name }}
          </option>
        </select>
      </div>

      <div class="flex items-center gap-1 text-xs">
        <span class="text-content font-medium text-[11px]">Trạng thái:</span>
        <select
          v-model="availabilityFilter"
          class="px-2 py-1 border border-content rounded-lg text-xs bg-white text-content focus:outline-none"
        >
          <option value="ALL">Tất cả</option>
          <option value="AVAILABLE">Đang hoạt động</option>
          <option value="UNAVAILABLE">Chưa kích hoạt</option>
        </select>
      </div>

      <div class="flex-1"></div>

      <div role="group" aria-label="Chế độ hiển thị" class="flex rounded-lg border border-content p-0.5 gap-0.5">
        <button
          v-for="mode in viewModes"
          :key="mode.value"
          type="button"
          :aria-pressed="viewMode === mode.value"
          :class="viewMode === mode.value ? 'bg-content text-white' : 'text-content hover:bg-surface'"
          class="rounded-md px-2.5 py-1 text-xs font-bold cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-accent"
          @click="viewMode = mode.value"
        >
          {{ mode.label }}
        </button>
      </div>

      <button
        type="button"
        @click="adminFishingAreaStore.fetchAllAreasAdmin()"
        title="Làm mới danh sách"
        class="px-3 py-1.5 border border-content rounded-lg bg-white hover:bg-surface text-content text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
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
        class="px-3 py-1.5 rounded-lg bg-content-strong hover:bg-accent text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
      >
        <span>+ Thêm bãi câu</span>
      </button>
    </div>

    <!-- Body -->
    <div class="flex-1 flex min-h-0">
      <!-- List -->
      <div v-if="!adminFishingAreaStore.isFormOpen" class="flex-1 min-w-0 overflow-y-auto p-6 bg-white/50">
        <div
          v-if="adminFishingAreaStore.adminLoading"
          class="py-16 text-center text-content text-xs flex flex-col items-center gap-2"
        >
          <div class="w-8 h-8 border border-accent border-t-transparent rounded-full animate-spin"></div>
          <span>Đang tải danh sách bãi câu...</span>
        </div>

        <div v-else-if="adminFishingAreaStore.adminError" class="py-16 text-center text-danger text-xs">
          {{ adminFishingAreaStore.adminError }}
        </div>

        <div v-else-if="!filteredAreas.length" class="py-16 text-center text-content text-xs">
          <span class="text-3xl block mb-2">🎣</span>
          <div class="m-0 font-medium">Không tìm thấy bãi câu nào phù hợp.</div>
        </div>

        <div v-else-if="viewMode === 'list'" class="bg-white border border-border rounded-xl overflow-x-auto shadow-2xs">
          <table class="w-full text-xs text-left border-collapse">
            <thead class="bg-surface text-content uppercase text-[10px] tracking-wide">
              <tr>
                <th class="px-4 py-2.5">Ảnh</th>
                <th class="px-4 py-2.5">Tên</th>
                <th class="px-4 py-2.5">Quốc gia</th>
                <th class="px-4 py-2.5">Đường dẫn cảnh</th>
                <th class="px-4 py-2.5">Vùng câu</th>
                <th class="px-4 py-2.5">Múi giờ</th>
                <th class="px-4 py-2.5">Công cụ đo độ sâu</th>
                <th class="px-4 py-2.5">Sinh tồn</th>
                <th class="px-4 py-2.5">Trạng thái</th>
                <th class="px-4 py-2.5">Tạo lúc</th>
                <th class="px-4 py-2.5 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="area in filteredAreas" :key="area.id" class="border-t border-border hover:bg-surface/40">
                <td class="px-4 py-2.5">
                  <button
                    v-if="sceneImageUrl(area) && !failedImageUrls.has(sceneImageUrl(area))"
                    type="button"
                    :aria-label="`Xem ảnh ${area.title || '(Chưa đặt tên)'}`"
                    title="Xem ảnh"
                    class="block w-24 overflow-hidden rounded-lg border border-border-default bg-surface cursor-pointer hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
                    @click="openImagePreview(area, $event)"
                  >
                    <img
                      :src="sceneImageUrl(area)"
                      :alt="area.title || 'Ảnh bãi câu'"
                      loading="lazy"
                      class="aspect-video w-full object-cover"
                      @error="failedImageUrls.add(sceneImageUrl(area))"
                    />
                  </button>
                  <span v-else class="text-content-muted whitespace-nowrap">
                    {{ sceneImageUrl(area) ? "Không tải được ảnh" : "Chưa có ảnh" }}
                  </span>
                </td>
                <td class="px-4 py-2.5 font-semibold text-content">{{ area.title || "(Chưa đặt tên)" }}</td>
                <td class="px-4 py-2.5 text-content">{{ countryName(area.countryId) }}</td>
                <td class="px-4 py-2.5 text-content truncate max-w-45" :title="area.scenePath || ''">
                  {{ area.scenePath || "—" }}
                </td>
                <td class="px-4 py-2.5 text-content">{{ area.fishingBoundary?.length || 0 }} điểm</td>
                <td class="px-4 py-2.5 text-content whitespace-nowrap">{{ area.timezone || "Theo quốc gia" }}</td>
                <td class="px-4 py-2.5">
                  <input
                    type="checkbox"
                    :checked="area.allowDepthTool"
                    disabled
                    :aria-label="`Cho phép công cụ đo độ sâu: ${area.title || area.id}`"
                    class="w-4 h-4 accent-accent"
                  />
                </td>
                <td class="px-4 py-2.5">
                  <span :class="area.survivalMode ? 'font-bold text-danger' : 'text-content-muted'">{{ area.survivalMode ? 'Bật' : 'Tắt' }}</span>
                </td>
                <td class="px-4 py-2.5">
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                    :class="
                      area.isAvailable
                        ? 'bg-surface text-content border-accent'
                        : 'bg-surface text-content border-content'
                    "
                  >
                    {{ area.isAvailable ? "Hoạt động" : "Chưa bật" }}
                  </span>
                </td>
                <td class="px-4 py-2.5 text-content whitespace-nowrap">{{ formatDate(area.createdAt) }}</td>
                <td class="px-4 py-2.5">
                  <div class="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      @click="adminFishingAreaStore.openForm(area)"
                      class="px-2.5 py-1 rounded-lg border border-content hover:bg-surface text-content font-bold cursor-pointer transition-colors"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      @click="askDelete(area.id)"
                      :disabled="deletingId === area.id"
                      class="px-2.5 py-1 rounded-lg border border-danger hover:bg-surface text-danger font-bold cursor-pointer transition-colors disabled:opacity-50"
                    >
                      Xoá
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="space-y-6">
          <section v-for="group in areaGroups" :key="group.code" :aria-label="group.name || 'Bãi câu'">
            <div v-if="viewMode === 'group'" class="mb-3 flex items-center gap-2 text-sm font-bold text-content">
              <span>{{ group.name || 'Chưa có quốc gia' }}</span>
              <span class="rounded-full bg-surface border border-border px-2 py-0.5 text-[10px]">{{ group.areas.length }} bãi câu</span>
            </div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              <FishingAreaCard
                v-for="area in group.areas"
                :key="area.id"
                :area="area"
                :country-name="countryName(area.countryId)"
                :image-url="sceneImageUrl(area)"
                :image-failed="failedImageUrls.has(sceneImageUrl(area))"
                :deleting="deletingId === area.id"
                @preview="openImagePreview(area, $event)"
                @image-error="failedImageUrls.add(sceneImageUrl(area))"
                @edit="adminFishingAreaStore.openForm(area)"
                @delete="askDelete(area.id)"
              />
            </div>
          </section>
        </div>
      </div>
      <div v-else class="grid grid-cols-2 gap-2 p-2 w-full">
        <InteractWorldMap2 :fog-enabled="false" tile-mode="admin" />
        <!-- Form panel -->
        <FishingAreaManagementForm />
      </div>
    </div>

    <!-- Delete confirmation -->
    <div v-if="confirmDeleteId" class="fixed inset-0 z-60 bg-content/40 flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-lg p-5 w-full max-w-sm">
        <div class="m-0 text-sm font-extrabold text-content mb-2">Xác nhận xoá</div>
        <div class="text-xs text-content mb-4">
          Bạn có chắc muốn xoá bãi câu này? Hành động này không thể hoàn tác.
        </div>
        <div class="flex items-center justify-end gap-2">
          <button
            type="button"
            @click="cancelDelete"
            class="px-3 py-1.5 rounded-lg border border-content hover:bg-surface text-content text-xs font-bold cursor-pointer transition-colors"
          >
            Huỷ
          </button>
          <button
            type="button"
            @click="handleDelete"
            :disabled="deletingId === confirmDeleteId"
            class="px-3 py-1.5 rounded-lg bg-danger hover:bg-danger text-white text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
          >
            Xoá
          </button>
        </div>
      </div>
    </div>
    <Pagination
      v-if="!adminFishingAreaStore.isFormOpen && viewMode !== 'group'"
      :page="adminFishingAreaStore.page"
      :page-size="adminFishingAreaStore.pageSize"
      :total="adminFishingAreaStore.total"
      :loading="adminFishingAreaStore.adminLoading"
      @change="adminFishingAreaStore.fetchAllAreasAdmin($event)"
    />
  </AdminModal>

  <AdminModal
    v-if="imagePreview"
    :title="`Ảnh bãi câu: ${imagePreview.title}`"
    :z-index="60"
    @close="closeImagePreview"
    @keydown.esc.stop="closeImagePreview"
  >
    <div class="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-4">
      <div v-if="failedImageUrls.has(imagePreview.src)" role="alert" class="text-sm text-danger">
        Không tải được ảnh bãi câu.
      </div>
      <img
        v-else
        :src="imagePreview.src"
        :alt="imagePreview.title"
        class="min-h-0 max-h-full max-w-full flex-1 object-contain"
        @error="failedImageUrls.add(imagePreview.src)"
      />
      <button
        ref="previewCloseButton"
        type="button"
        class="shrink-0 rounded-lg border border-border-default bg-surface px-4 py-2 text-xs font-bold text-content hover:bg-surface-muted cursor-pointer focus-visible:outline-2 focus-visible:outline-accent"
        @click="closeImagePreview"
      >
        Đóng ảnh
      </button>
    </div>
  </AdminModal>
</template>
