<script lang="ts" setup>
import type { HourMissionRow } from "../../../types/table/hourMission.ts";
import AdminModal from "../AdminModal.vue";
import Pagination from "../../shared/Pagination.vue";
import { usePagedListFilters } from "../../../composables/usePagedListFilters.ts";
import { computed, onMounted, onUnmounted, ref, type ComponentPublicInstance } from "vue";
import HourMissionForm from "./HourMissionForm.vue";
import { toTimeInput, useAdminHourMissionStore } from "./admin-hour-mission-store.ts";

const emit = defineEmits(["close"]);
const store = useAdminHourMissionStore();
usePagedListFilters(
  [() => store.search, () => store.statusFilter],
  () => {
    void store.loadMissions(1);
  },
  () => {
    ++store.requestId;
  },
);
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
const utcTimeNow = computed(
  () =>
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
  <AdminModal title="Quản lý nhiệm vụ theo giờ" icon="⏰" @close="emit('close')">
    <div class="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-white px-5 py-3 md:px-7">
      <div class="min-w-55 flex-1">
        <input
          v-model="store.search"
          type="search"
          placeholder="Tìm theo tên cá..."
          class="w-full rounded-lg border border-content bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </div>
      <label class="flex items-center gap-2 text-xs font-semibold text-content"
        >Trạng thái
        <select
          v-model="store.statusFilter"
          class="rounded-lg border border-content bg-white px-2.5 py-2 text-sm text-content"
        >
          <option value="ALL">Tất cả</option>
          <option value="ACTIVE">Đang bật</option>
          <option value="DISABLED">Đang tắt</option>
        </select>
      </label>
      <div class="ml-auto flex items-center gap-2">
        <span class="hidden text-xs text-content sm:inline">{{ store.filteredMissions.length }} kết quả</span>
        <div class="flex rounded-lg border border-content bg-white p-0.5">
          <button
            type="button"
            class="rounded-md px-2.5 py-1.5 text-xs font-bold"
            :class="viewMode === 'list' ? 'bg-white text-content shadow-sm' : 'text-content hover:text-content'"
            :aria-pressed="viewMode === 'list'"
            @click="viewMode = 'list'"
          >
            Danh sách
          </button>
          <button
            type="button"
            class="rounded-md px-2.5 py-1.5 text-xs font-bold"
            :class="
              viewMode === 'timeline' ? 'bg-white text-content shadow-sm' : 'text-content hover:text-content'
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
          class="grid size-9 place-items-center rounded-lg border border-content bg-white text-content hover:bg-surface disabled:opacity-50"
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
          class="rounded-lg bg-content-strong px-3.5 py-2 text-sm font-bold text-white hover:bg-accent"
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
          class="mb-4 flex items-center justify-between gap-3 rounded-lg border border-danger bg-surface px-4 py-3 text-sm text-danger"
        >
          <span>{{ store.loadError }}</span
          ><button type="button" class="font-bold underline" @click="store.loadMissions()">Thử lại</button>
        </div>
        <div v-if="store.isLoading" class="grid min-h-64 place-items-center text-sm text-content">
          Đang tải danh sách nhiệm vụ...
        </div>
        <div
          v-else-if="!store.filteredMissions.length"
          class="grid min-h-64 place-items-center text-center text-sm text-content"
        >
          <div>
            <span class="mb-2 block text-3xl">⏰</span
            >{{ store.missions.length ? "Không tìm thấy nhiệm vụ phù hợp." : "Chưa có nhiệm vụ nào." }}
          </div>
        </div>
        <div
          v-else-if="viewMode === 'list'"
          class="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-white shadow-sm"
        >
          <table class="w-full min-w-220 border-separate border-spacing-0 text-left text-sm">
            <thead class="text-[11px] uppercase text-content">
              <tr>
                <th class="sticky top-0 z-10 bg-surface px-4 py-3">Khung giờ (UTC)</th>
                <th class="sticky top-0 z-10 bg-surface px-4 py-3">Cá cần câu</th>
                <th class="sticky top-0 z-10 bg-surface px-4 py-3">Phần thưởng</th>
                <th class="sticky top-0 z-10 bg-surface px-4 py-3">Trạng thái</th>
                <th class="sticky top-0 z-10 bg-surface px-4 py-3">Ngày tạo</th>
                <th class="sticky top-0 z-10 bg-surface px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in store.filteredMissions"
                :key="item.id"
                class="border-t border-border hover:bg-surface/40"
              >
                <td class="whitespace-nowrap px-4 py-3 font-mono text-xs font-bold text-content">
                  {{ formatRange(item.start, item.end) }}
                </td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-1.5">
                    <span
                      v-for="fish in item.content"
                      :key="fish.id"
                      class="rounded bg-surface px-2 py-1 text-xs font-semibold text-content"
                      >{{ fish.name }}</span
                    >
                  </div>
                </td>
                <td class="whitespace-nowrap px-4 py-3 font-semibold text-content">
                  {{ item.cash === null ? "—" : `${item.cash.toLocaleString("vi-VN")} xu` }}
                </td>
                <td class="px-4 py-3">
                  <span
                    class="rounded-full border px-2.5 py-1 text-xs font-semibold"
                    :class="
                      item.isDisabled
                        ? 'border-border bg-surface text-content'
                        : 'border-accent bg-surface text-content'
                    "
                    >{{ item.isDisabled ? "Đang tắt" : "Đang bật" }}</span
                  >
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-xs text-content">
                  {{ new Date(item.createdAt).toLocaleString("vi-VN") }}
                </td>
                <td class="px-4 py-3">
                  <div class="flex justify-end gap-2">
                    <button
                      type="button"
                      class="rounded-md border border-accent px-2.5 py-1.5 text-xs font-bold text-content hover:bg-surface disabled:opacity-50"
                      :disabled="store.updatingId === item.id"
                      @click="store.toggleEnabled(item)"
                    >
                      {{ store.updatingId === item.id ? "..." : item.isDisabled ? "Bật" : "Tắt" }}</button
                    ><button
                      type="button"
                      class="rounded-md border border-content px-2.5 py-1.5 text-xs font-bold text-content hover:bg-surface"
                      @click="store.openEditForm(item)"
                    >
                      Sửa</button
                    ><button
                      type="button"
                      class="rounded-md border border-danger px-2.5 py-1.5 text-xs font-bold text-danger hover:bg-surface"
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
          class="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-white p-4 shadow-sm md:p-6"
        >
          <div class="mb-5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div class="m-0 text-sm font-extrabold text-content">Lịch nhiệm vụ trong ngày</div>
              <div class="m-0 mt-1 text-xs text-content">Các khung giờ được sắp xếp theo giờ UTC.</div>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="inline-flex items-center gap-2 rounded-full border border-accent bg-surface px-3 py-1.5 text-xs font-bold text-content"
              >
                <span class="size-2 animate-pulse rounded-full bg-accent"></span>
                Hiện tại {{ utcTimeNow }} UTC
              </span>
              <button
                type="button"
                class="rounded-lg border border-accent bg-white px-3 py-1.5 text-xs font-bold text-content hover:bg-surface"
                @click="scrollToCurrent"
              >
                Cuộn đến hiện tại
              </button>
            </div>
          </div>
          <div class="relative mx-auto max-w-3xl">
            <div class="absolute bottom-4 left-3 top-4 w-px bg-surface md:left-4"></div>
            <template v-for="(item, index) in timelineMissions" :key="item.id">
              <div
                v-if="currentMarkerIndex === index"
                :ref="setCurrentMarker"
                class="relative z-10 flex items-center gap-3 py-3"
              >
                <span
                  class="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-[10px] text-white ring-4 ring-white md:size-8"
                >
                  ●
                </span>
                <div class="h-px flex-1 bg-accent"></div>
                <span class="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-extrabold text-white">
                  BÂY GIỜ · {{ utcTimeNow }} UTC
                </span>
                <div class="h-px flex-1 bg-accent"></div>
              </div>
              <article
                class="relative z-10 flex gap-3 py-2 md:gap-4"
                :class="index === timelineMissions.length - 1 ? 'pb-3' : ''"
              >
                <span
                  class="mt-4 size-6 shrink-0 rounded-full border-4 border-white ring-2 md:mt-5 md:size-8"
                  :class="isMissionActive(item) ? 'bg-accent ring-accent' : 'bg-content ring-border'"
                ></span>
                <div
                  class="min-w-0 flex-1 rounded-xl border p-3 md:p-4"
                  :class="
                    isMissionActive(item) ? 'border-accent bg-surface shadow-sm' : 'border-border bg-white'
                  "
                >
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <span class="font-mono text-sm font-extrabold text-content">
                      {{ formatRange(item.start, item.end) }} UTC
                    </span>
                    <span
                      v-if="isMissionActive(item)"
                      class="rounded-full bg-accent px-2.5 py-1 text-[10px] font-extrabold text-white"
                    >
                      ĐANG DIỄN RA
                    </span>
                    <span
                      class="rounded-full border px-2.5 py-1 text-[10px] font-bold"
                      :class="
                        item.isDisabled
                          ? 'border-border bg-surface text-content'
                          : 'border-accent bg-white text-content'
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
                          class="rounded-md bg-white/80 px-2 py-1 text-xs font-semibold text-content"
                        >
                          {{ fish.name }}
                        </span>
                      </div>
                      <div class="mb-0 mt-2 text-xs font-semibold text-content">
                        Thưởng: {{ item.cash === null ? "—" : `${item.cash.toLocaleString("vi-VN")} xu` }}
                      </div>
                    </div>
                    <div class="flex shrink-0 gap-2">
                      <button
                        type="button"
                        class="rounded-md border border-accent px-2.5 py-1.5 text-xs font-bold text-content hover:bg-surface disabled:opacity-50"
                        :disabled="store.updatingId === item.id"
                        @click="store.toggleEnabled(item)"
                      >
                        {{ store.updatingId === item.id ? "..." : item.isDisabled ? "Bật" : "Tắt" }}
                      </button>
                      <button
                        type="button"
                        class="rounded-md border border-content px-2.5 py-1.5 text-xs font-bold text-content hover:bg-surface"
                        @click="store.openEditForm(item)"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        class="rounded-md border border-danger px-2.5 py-1.5 text-xs font-bold text-danger hover:bg-surface"
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
              <span
                class="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-[10px] text-white ring-4 ring-white md:size-8"
              >
                ●
              </span>
              <div class="h-px flex-1 bg-accent"></div>
              <span class="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-extrabold text-white">
                BÂY GIỜ · {{ utcTimeNow }} UTC
              </span>
              <div class="h-px flex-1 bg-accent"></div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <HourMissionForm />

    <div v-if="store.confirmDeleteId" class="fixed inset-0 z-40 grid place-items-center bg-content/45 p-4">
      <div class="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <div class="m-0 text-base font-extrabold text-content">Xác nhận xoá nhiệm vụ?</div>
        <div class="my-3 text-sm text-content">Thao tác này không thể hoàn tác.</div>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg border border-content px-3 py-2 text-sm font-bold text-content"
            @click="store.confirmDeleteId = null"
          >
            Huỷ
          </button>
          <button
            type="button"
            :disabled="!!store.deletingId"
            class="rounded-lg bg-danger px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
            @click="store.remove()"
          >
            {{ store.deletingId ? "Đang xoá..." : "Xoá nhiệm vụ" }}
          </button>
        </div>
      </div>
    </div>
    <Pagination
      :page="store.page"
      :page-size="store.pageSize"
      :total="store.total"
      :loading="store.isLoading"
      @change="store.loadMissions($event)"
    />
  </AdminModal>
</template>
