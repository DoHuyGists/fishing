<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from "vue";
import {
  supabaseEventScheduleRepository,
  type EventSchedulePayload,
  type EventScheduleRow,
} from "../../data/supabaseEventScheduleRepository";
import { supabaseEventRepository, type EventRow } from "../../data/supabaseEventRepository";
import EventThumbnail from "../event/EventThumbnail.vue";

const emit = defineEmits(["close"]);

const schedules = ref<EventScheduleRow[]>([]);
const events = ref<EventRow[]>([]);

const search = ref("");
const eventFilter = ref("ALL");
const statusFilter = ref("ALL");
const isLoading = ref(false);
const loadError = ref("");
const isFormOpen = ref(false);
const isSaving = ref(false);
const formError = ref("");
const deletingId = ref<string | null>(null);
const confirmDeleteId = ref<string | null>(null);

const emptyForm = () => ({
  id: null as string | null,
  eventId: "",
  start: "",
  end: "",
  isDisabled: true,
  viewCount: 0,
});

const form = reactive(emptyForm());

function toInputDateTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromInputDateTime(value: string) {
  return value ? new Date(value).toISOString() : "";
}

const eventOptions = computed(() => [...events.value].sort((a, b) => a.name.localeCompare(b.name)));

const filteredSchedules = computed(() => {
  const keyword = search.value.trim().toLocaleLowerCase();
  return schedules.value.filter((item) => {
    const matchesSearch = !keyword || [item.eventName].some((value) => value?.toLocaleLowerCase().includes(keyword));
    const matchesEvent = eventFilter.value === "ALL" || item.eventId === eventFilter.value;
    const matchesStatus =
      statusFilter.value === "ALL" ||
      (statusFilter.value === "ACTIVE" && !item.isDisabled) ||
      (statusFilter.value === "DISABLED" && item.isDisabled);
    return matchesSearch && matchesEvent && matchesStatus;
  });
});

async function loadAll() {
  isLoading.value = true;
  loadError.value = "";
  try {
    const [schedulesData, eventsData] = await Promise.all([
      supabaseEventScheduleRepository.fetchAll(),
      supabaseEventRepository.fetchAll(),
    ]);
    schedules.value = schedulesData;
    events.value = eventsData;
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : "Không thể tải danh sách lịch sự kiện";
  } finally {
    isLoading.value = false;
  }
}

function openCreateForm() {
  Object.assign(form, emptyForm());
  formError.value = "";
  isFormOpen.value = true;
}

function openEditForm(item: EventScheduleRow) {
  Object.assign(form, {
    id: item.id,
    eventId: item.eventId,
    start: toInputDateTime(item.start),
    end: toInputDateTime(item.end),
    isDisabled: item.isDisabled,
    viewCount: item.viewCount,
  });
  formError.value = "";
  isFormOpen.value = true;
}

function closeForm() {
  isFormOpen.value = false;
  formError.value = "";
}

function buildPayload(): EventSchedulePayload | null {
  if (!form.eventId) {
    formError.value = "Vui lòng chọn sự kiện";
    return null;
  }
  if (!form.start || !form.end) {
    formError.value = "Vui lòng nhập đầy đủ thời gian bắt đầu và kết thúc";
    return null;
  }
  const start = fromInputDateTime(form.start);
  const end = fromInputDateTime(form.end);
  if (new Date(start) >= new Date(end)) {
    formError.value = "Thời gian kết thúc phải sau thời gian bắt đầu";
    return null;
  }
  const viewCount = Number(form.viewCount);
  if (!Number.isFinite(viewCount) || viewCount < 0) {
    formError.value = "Lượt xem phải là số không âm";
    return null;
  }

  return {
    eventId: form.eventId,
    start,
    end,
    isDisabled: form.isDisabled,
    viewCount,
  };
}

async function handleSave() {
  formError.value = "";
  const payload = buildPayload();
  if (!payload) return;

  isSaving.value = true;
  try {
    if (form.id) await supabaseEventScheduleRepository.update(form.id, payload);
    else await supabaseEventScheduleRepository.create(payload);
    closeForm();
    await loadAll();
  } catch (error) {
    formError.value = error instanceof Error ? error.message : "Không thể lưu lịch sự kiện";
  } finally {
    isSaving.value = false;
  }
}

async function handleDelete() {
  if (!confirmDeleteId.value) return;
  deletingId.value = confirmDeleteId.value;
  try {
    await supabaseEventScheduleRepository.delete(confirmDeleteId.value);
    if (form.id === confirmDeleteId.value) closeForm();
    confirmDeleteId.value = null;
    await loadAll();
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : "Không thể xoá lịch sự kiện";
  } finally {
    deletingId.value = null;
  }
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleString("vi-VN") : "—";
}

onMounted(loadAll);
</script>

<template>
  <div class="fixed inset-0 z-50 flex flex-col bg-gray-50">
    <header
      class="flex shrink-0 items-center justify-between gap-4 border-b border-emerald-900 bg-[#153221] px-5 py-4 text-white md:px-7"
    >
      <div class="flex min-w-0 items-center gap-3">
        <div
          class="grid size-10 shrink-0 place-items-center rounded-lg border border-emerald-400/30 bg-emerald-800 text-xl"
        >
          🗓️
        </div>
        <div class="min-w-0">
          <h2 class="m-0 text-lg font-extrabold">Quản lý lịch sự kiện</h2>
          <p class="m-0 text-xs text-emerald-200">{{ schedules.length }} lịch trong bảng event_schedule</p>
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
          placeholder="Tìm theo tên sự kiện..."
          class="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
        />
      </div>
      <label class="flex items-center gap-2 text-xs font-semibold text-gray-600">
        Sự kiện
        <select
          v-model="eventFilter"
          class="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-700"
        >
          <option value="ALL">Tất cả</option>
          <option v-for="event in eventOptions" :key="event.id" :value="event.id">{{ event.name }}</option>
        </select>
      </label>
      <label class="flex items-center gap-2 text-xs font-semibold text-gray-600">
        Trạng thái
        <select
          v-model="statusFilter"
          class="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-700"
        >
          <option value="ALL">Tất cả</option>
          <option value="ACTIVE">Đang bật</option>
          <option value="DISABLED">Đã tắt</option>
        </select>
      </label>
      <div class="ml-auto flex items-center gap-2">
        <span class="hidden text-xs text-gray-500 sm:inline">{{ filteredSchedules.length }} kết quả</span>
        <button
          type="button"
          title="Làm mới danh sách"
          class="grid size-9 place-items-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          :disabled="isLoading"
          @click="loadAll"
        >
          <svg
            class="size-4"
            :class="{ 'animate-spin': isLoading }"
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
          :disabled="!eventOptions.length"
          class="rounded-lg bg-[#153221] px-3.5 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
          @click="openCreateForm"
        >
          + Thêm lịch
        </button>
      </div>
    </div>

    <main class="relative flex min-h-0 flex-1">
      <section class="min-w-0 flex-1 overflow-auto p-4 md:p-6">
        <div
          v-if="loadError"
          class="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{{ loadError }}</span>
          <button type="button" class="font-bold underline" @click="loadAll">Thử lại</button>
        </div>
        <div
          v-if="!isLoading && !events.length"
          class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700"
        >
          Chưa có sự kiện nào. Vui lòng tạo sự kiện trước khi thêm lịch.
        </div>
        <div v-if="isLoading" class="grid min-h-64 place-items-center text-sm text-gray-500">
          Đang tải danh sách lịch sự kiện...
        </div>
        <div
          v-else-if="!filteredSchedules.length"
          class="grid min-h-64 place-items-center text-center text-sm text-gray-500"
        >
          <div>
            <span class="mb-2 block text-3xl">🗓️</span
            >{{ schedules.length ? "Không tìm thấy lịch phù hợp." : "Chưa có lịch sự kiện nào." }}
          </div>
        </div>
        <div v-else class="rounded-lg border border-gray-200 bg-white shadow-sm">
          <table class="w-full min-w-[1000px] border-collapse text-left text-sm">
            <thead class="text-[11px] uppercase text-gray-600">
              <tr>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Sự kiện</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Bắt đầu</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Kết thúc</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Lượt xem</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Trạng thái</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in filteredSchedules"
                :key="item.id"
                class="border-t border-gray-100 hover:bg-emerald-50/40"
              >
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <EventThumbnail :src="item.eventThumbnail" :rotate="-8" :width="80" :height="80" />
                    <span class="font-bold text-gray-800">{{ item.eventName || "—" }}</span>
                  </div>
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-gray-700">{{ formatDate(item.start) }}</td>
                <td class="whitespace-nowrap px-4 py-3 text-gray-700">{{ formatDate(item.end) }}</td>
                <td class="px-4 py-3 text-gray-700">{{ item.viewCount }}</td>
                <td class="px-4 py-3">
                  <span
                    v-if="!item.isDisabled"
                    class="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800"
                    >Đang bật</span
                  >
                  <span
                    v-else
                    class="rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600"
                    >Đã tắt</span
                  >
                </td>
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
        <aside class="ml-auto flex h-full w-full max-w-xl flex-col border-l border-gray-200 bg-white shadow-xl">
          <div class="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-4">
            <div>
              <h3 class="m-0 text-base font-extrabold text-[#153221]">
                {{ form.id ? "Chỉnh sửa lịch sự kiện" : "Thêm lịch sự kiện" }}
              </h3>
              <p class="m-0 mt-1 text-xs text-gray-500">Thông tin trong bảng event_schedule</p>
            </div>
            <button
              type="button"
              aria-label="Đóng biểu mẫu"
              class="grid size-8 place-items-center rounded-md text-xl text-gray-500 hover:bg-gray-100"
              @click="closeForm"
            >
              &times;
            </button>
          </div>
          <form class="flex-1 space-y-4 overflow-y-auto p-5" @submit.prevent="handleSave">
            <div v-if="formError" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {{ formError }}
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600 sm:col-span-2"
                >Sự kiện *
                <select
                  v-model="form.eventId"
                  required
                  class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800 focus:border-emerald-600 focus:outline-none"
                >
                  <option value="" disabled>Chọn sự kiện</option>
                  <option v-for="event in eventOptions" :key="event.id" :value="event.id">{{ event.name }}</option>
                </select>
              </label>
              <label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600"
                >Bắt đầu *
                <input
                  v-model="form.start"
                  type="datetime-local"
                  required
                  class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800 focus:border-emerald-600 focus:outline-none"
                />
              </label>
              <label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600"
                >Kết thúc *
                <input
                  v-model="form.end"
                  type="datetime-local"
                  required
                  class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800 focus:border-emerald-600 focus:outline-none"
                />
              </label>
              <label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600"
                >Lượt xem
                <input
                  v-model.number="form.viewCount"
                  type="number"
                  min="0"
                  step="1"
                  class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800 focus:border-emerald-600 focus:outline-none"
                />
              </label>
              <label class="flex items-center gap-2 text-xs font-bold text-gray-600">
                <input v-model="form.isDisabled" type="checkbox" class="size-4 rounded border-gray-300" />
                Tắt lịch
              </label>
            </div>
          </form>
          <div class="flex shrink-0 items-center justify-end gap-2 border-t border-gray-200 px-5 py-4">
            <button
              type="button"
              class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100"
              @click="closeForm"
            >
              Huỷ
            </button>
            <button
              type="button"
              :disabled="isSaving"
              class="rounded-lg bg-[#153221] px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
              @click="handleSave"
            >
              {{ isSaving ? "Đang lưu..." : "Lưu lịch sự kiện" }}
            </button>
          </div>
        </aside>
      </div>
    </main>

    <div v-if="confirmDeleteId" class="fixed inset-0 z-40 grid place-items-center bg-black/45 p-4">
      <div class="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h3 class="m-0 text-base font-extrabold text-gray-800">Xác nhận xoá lịch sự kiện?</h3>
        <p class="my-3 text-sm text-gray-600">Thao tác này không thể hoàn tác.</p>
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
            {{ deletingId ? "Đang xoá..." : "Xoá lịch" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
