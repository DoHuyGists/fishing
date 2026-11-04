<script lang="ts" setup>
import AdminModal from "../AdminModal.vue";
import { computed, onMounted, onUnmounted, ref, type ComponentPublicInstance } from "vue";
import HourMissionForm from "./HourMissionForm.vue";
import { toTimeInput, useAdminHourMissionStore } from "./admin-hour-mission-store";
import type { HourMissionRow } from "../../../data/supabaseHourMissionRepository";

const emit = defineEmits(["close"]);
const store = useAdminHourMissionStore();
const viewMode = ref<"list" | "timeline">("list");
const currentTime = ref(new Date());
const currentMarker = ref<HTMLElement | null>(null);
let clockInterval: ReturnType<typeof setInterval>;

function setCurrentMarker(element: Element | ComponentPublicInstance | null) {
  currentMarker.value = element instanceof HTMLElement ? element : null;
}

const formatRange = (start: string | null, end: string | null) =>
  `${toTimeInput(start) || "--:--:--"} - ${toTimeInput(end) || "--:--:--"}`;

const timeInMinutes = (value: string | null) => {
  const time = toTimeInput(value);
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const utcMinutesNow = computed(() => currentTime.value.getUTCHours() * 60 + currentTime.value.getUTCMinutes());
const utcTimeNow = computed(() =>
  `${String(currentTime.value.getUTCHours()).padStart(2, "0")}:${String(currentTime.value.getUTCMinutes()).padStart(2, "0")}`,
);
const timelineMissions = computed(() =>
  [...store.filteredMissions].sort((a, b) => {
    const aStart = timeInMinutes(a.start);
    const bStart = timeInMinutes(b.start);
    return (aStart ?? Number.MAX_SAFE_INTEGER) - (bStart ?? Number.MAX_SAFE_INTEGER);
  }),
);
const currentMarkerIndex = computed(() => {
  const index = timelineMissions.value.findIndex((item) => {
    const start = timeInMinutes(item.start);
    return start === null || start > utcMinutesNow.value;
  });
  return index < 0 ? timelineMissions.value.length : index;
});

function isMissionActive(item: HourMissionRow) {
  const start = timeInMinutes(item.start);
  const end = timeInMinutes(item.end);
  if (item.isDisabled || start === null || end === null || start === end) return false;
  return start < end
    ? utcMinutesNow.value >= start && utcMinutesNow.value < end
    : utcMinutesNow.value >= start || utcMinutesNow.value < end;
}

function scrollToCurrent() {
  currentMarker.value?.scrollIntoView({ behavior: "smooth", block: "center" });
}

onMounted(() => {
  store.loadMissions();
  clockInterval = setInterval(() => {
    currentTime.value = new Date();
  }, 10_000);
});

onUnmounted(() => clearInterval(clockInterval));
</script>

<template>
  <AdminModal
    title="Quản lý nhiệm vụ theo giờ"
    icon="⏰"
    @close="emit('close')"
  >
    <template #subtitle>{{ store.missions.length }} nhiệm vụ trong danh sách</template>

    <div class="flex shrink-0 flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-5 py-3 md:px-7">
      <div class="min-w-55 flex-1">
        <input
          v-model="store.search"
          type="search"
          placeholder="Tìm theo tên cá..."
          class="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
        />
      </div>
      <label class="flex items-center gap-2 text-xs font-semibold text-gray-600"
        >Trạng thái
        <select
          v-model="store.statusFilter"
          class="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-700"
        >
          <option value="ALL">Tất cả</option>
          <option value="ACTIVE">Đang bật</option>
          <option value="DISABLED">Đang tắt</option>
        </select>
      </label>
      <div class="ml-auto flex items-center gap-2">
        <span class="hidden text-xs text-gray-500 sm:inline">{{ store.filteredMissions.length }} kết quả</span>
        <div class="flex rounded-lg border border-gray-300 bg-gray-50 p-0.5">
          <button
            type="button"
            class="rounded-md px-2.5 py-1.5 text-xs font-bold"
            :class="viewMode === 'list' ? 'bg-white text-emerald-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'"
            :aria-pressed="viewMode === 'list'"
            @click="viewMode = 'list'"
          >
            Danh sách
          </button>
          <button
            type="button"
            class="rounded-md px-2.5 py-1.5 text-xs font-bold"
            :class="
              viewMode === 'timeline' ? 'bg-white text-emerald-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            "
            :aria-pressed="viewMode === 'timeline'"
            @click="viewMode = 'timeline'"
          >
            Dòng thời gian
          </button>
        </div>
        <button
          type="button"
          title="Làm mới danh sách"
          class="grid size-9 place-items-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          :disabled="store.isLoading"
          @click="store.loadMissions()"
        >
          <svg
            class="size-4"
            :class="{ 'animate-spin': store.isLoading }"
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
          @click="store.openCreateForm()"
        >
          + Thêm nhiệm vụ
        </button>
      </div>
    </div>

    <main class="relative flex min-h-0 flex-1">
      <section class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4 md:p-6">
        <div
          v-if="store.loadError"
          class="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{{ store.loadError }}</span
          ><button type="button" class="font-bold underline" @click="store.loadMissions()">Thử lại</button>
        </div>
        <div v-if="store.isLoading" class="grid min-h-64 place-items-center text-sm text-gray-500">
          Đang tải danh sách nhiệm vụ...
        </div>
        <div
          v-else-if="!store.filteredMissions.length"
          class="grid min-h-64 place-items-center text-center text-sm text-gray-500"
        >
          <div>
            <span class="mb-2 block text-3xl">⏰</span
            >{{ store.missions.length ? "Không tìm thấy nhiệm vụ phù hợp." : "Chưa có nhiệm vụ nào." }}
          </div>
        </div>
        <div
          v-else-if="viewMode === 'list'"
          class="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-200 bg-white shadow-sm"
        >
          <table class="w-full min-w-220 border-separate border-spacing-0 text-left text-sm">
            <thead class="text-[11px] uppercase text-gray-600">
              <tr>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Khung giờ (UTC)</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Cá cần câu</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Phần thưởng</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Trạng thái</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Ngày tạo</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in store.filteredMissions"
                :key="item.id"
                class="border-t border-gray-100 hover:bg-emerald-50/40"
              >
                <td class="whitespace-nowrap px-4 py-3 font-mono text-xs font-bold text-gray-800">
                  {{ formatRange(item.start, item.end) }}
                </td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-1.5">
                    <span
                      v-for="fish in item.content"
                      :key="fish.id"
                      class="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700"
                      >{{ fish.name }}</span
                    >
                  </div>
                </td>
                <td class="whitespace-nowrap px-4 py-3 font-semibold text-emerald-800">
                  {{ item.cash === null ? "—" : `${item.cash.toLocaleString("vi-VN")} xu` }}
                </td>
                <td class="px-4 py-3">
                  <span
                    class="rounded-full border px-2.5 py-1 text-xs font-semibold"
                    :class="
                      item.isDisabled
                        ? 'border-gray-200 bg-gray-100 text-gray-600'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    "
                    >{{ item.isDisabled ? "Đang tắt" : "Đang bật" }}</span
                  >
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                  {{ new Date(item.createdAt).toLocaleString("vi-VN") }}
                </td>
                <td class="px-4 py-3">
                  <div class="flex justify-end gap-2">
                    <button
                      type="button"
                      class="rounded-md border border-emerald-200 px-2.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                      :disabled="store.updatingId === item.id"
                      @click="store.toggleEnabled(item)"
                    >
                      {{ store.updatingId === item.id ? "..." : item.isDisabled ? "Bật" : "Tắt" }}</button
                    ><button
                      type="button"
                      class="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100"
                      @click="store.openEditForm(item)"
                    >
                      Sửa</button
                    ><button
                      type="button"
                      class="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50"
                      @click="store.confirmDeleteId = item.id"
                    >
                      Xoá
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div
          v-else
          class="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:p-6"
        >
          <div class="mb-5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 class="m-0 text-sm font-extrabold text-gray-800">Lịch nhiệm vụ trong ngày</h3>
              <p class="m-0 mt-1 text-xs text-gray-500">Các khung giờ được sắp xếp theo giờ UTC.</p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-900">
                <span class="size-2 animate-pulse rounded-full bg-emerald-600"></span>
                Hiện tại {{ utcTimeNow }} UTC
              </span>
              <button
                type="button"
                class="rounded-lg border border-emerald-700 bg-white px-3 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-50"
                @click="scrollToCurrent"
              >
                Cuộn đến hiện tại
              </button>
            </div>
          </div>
          <div class="relative mx-auto max-w-3xl">
            <div class="absolute bottom-4 left-3 top-4 w-px bg-gray-200 md:left-4"></div>
            <template v-for="(item, index) in timelineMissions" :key="item.id">
              <div
                v-if="currentMarkerIndex === index"
                :ref="setCurrentMarker"
                class="relative z-10 flex items-center gap-3 py-3"
              >
                <span class="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-700 text-[10px] text-white ring-4 ring-white md:size-8">
                  ●
                </span>
                <div class="h-px flex-1 bg-emerald-500"></div>
                <span class="shrink-0 rounded-full bg-emerald-700 px-3 py-1 text-xs font-extrabold text-white">
                  BÂY GIỜ · {{ utcTimeNow }} UTC
                </span>
                <div class="h-px flex-1 bg-emerald-500"></div>
              </div>
              <article
                class="relative z-10 flex gap-3 py-2 md:gap-4"
                :class="index === timelineMissions.length - 1 ? 'pb-3' : ''"
              >
                <span
                  class="mt-4 size-6 shrink-0 rounded-full border-4 border-white ring-2 md:mt-5 md:size-8"
                  :class="isMissionActive(item) ? 'bg-emerald-600 ring-emerald-400' : 'bg-gray-300 ring-gray-200'"
                ></span>
                <div
                  class="min-w-0 flex-1 rounded-xl border p-3 md:p-4"
                  :class="
                    isMissionActive(item)
                      ? 'border-emerald-300 bg-emerald-50 shadow-sm'
                      : 'border-gray-200 bg-white'
                  "
                >
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <span class="font-mono text-sm font-extrabold text-gray-900">
                      {{ formatRange(item.start, item.end) }} UTC
                    </span>
                    <span
                      v-if="isMissionActive(item)"
                      class="rounded-full bg-emerald-700 px-2.5 py-1 text-[10px] font-extrabold text-white"
                    >
                      ĐANG DIỄN RA
                    </span>
                    <span
                      class="rounded-full border px-2.5 py-1 text-[10px] font-bold"
                      :class="
                        item.isDisabled
                          ? 'border-gray-200 bg-gray-100 text-gray-600'
                          : 'border-emerald-200 bg-white text-emerald-800'
                      "
                    >
                      {{ item.isDisabled ? "Đang tắt" : "Đang bật" }}
                    </span>
                  </div>
                  <div class="mt-3 flex flex-wrap items-end justify-between gap-3">
                    <div class="min-w-0">
                      <div class="flex flex-wrap gap-1.5">
                        <span
                          v-for="fish in item.content"
                          :key="fish.id"
                          class="rounded-md bg-white/80 px-2 py-1 text-xs font-semibold text-gray-700"
                        >
                          {{ fish.name }}
                        </span>
                      </div>
                      <p class="mb-0 mt-2 text-xs font-semibold text-emerald-800">
                        Thưởng: {{ item.cash === null ? "—" : `${item.cash.toLocaleString("vi-VN")} xu` }}
                      </p>
                    </div>
                    <div class="flex shrink-0 gap-2">
                      <button
                        type="button"
                        class="rounded-md border border-emerald-200 px-2.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                        :disabled="store.updatingId === item.id"
                        @click="store.toggleEnabled(item)"
                      >
                        {{ store.updatingId === item.id ? "..." : item.isDisabled ? "Bật" : "Tắt" }}
                      </button>
                      <button
                        type="button"
                        class="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100"
                        @click="store.openEditForm(item)"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        class="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50"
                        @click="store.confirmDeleteId = item.id"
                      >
                        Xoá
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            </template>
            <div
              v-if="currentMarkerIndex === timelineMissions.length"
              :ref="setCurrentMarker"
              class="relative z-10 flex items-center gap-3 py-3"
            >
              <span class="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-700 text-[10px] text-white ring-4 ring-white md:size-8">
                ●
              </span>
              <div class="h-px flex-1 bg-emerald-500"></div>
              <span class="shrink-0 rounded-full bg-emerald-700 px-3 py-1 text-xs font-extrabold text-white">
                BÂY GIỜ · {{ utcTimeNow }} UTC
              </span>
              <div class="h-px flex-1 bg-emerald-500"></div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <HourMissionForm />

    <div v-if="store.confirmDeleteId" class="fixed inset-0 z-40 grid place-items-center bg-black/45 p-4">
      <div class="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h3 class="m-0 text-base font-extrabold text-gray-800">Xác nhận xoá nhiệm vụ?</h3>
        <p class="my-3 text-sm text-gray-600">Thao tác này không thể hoàn tác.</p>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-700"
            @click="store.confirmDeleteId = null"
          >
            Huỷ
          </button>
          <button
            type="button"
            :disabled="!!store.deletingId"
            class="rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
            @click="store.remove()"
          >
            {{ store.deletingId ? "Đang xoá..." : "Xoá nhiệm vụ" }}
          </button>
        </div>
      </div>
    </div>
  </AdminModal>
</template>
