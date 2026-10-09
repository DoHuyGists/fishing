<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { supabaseEventScheduleRepository, type EventScheduleRow } from "../../data/supabaseEventScheduleRepository";
import EventThumbnail from "./EventThumbnail.vue";
import Modal from "../Modal.vue";

const emit = defineEmits(["close"]);

const schedules = ref<EventScheduleRow[]>([]);
const selectedId = ref<string | null>(null);
const isLoading = ref(true);
const loadError = ref("");

const activeSchedules = computed(() => schedules.value.filter((item) => !item.isDisabled));

const selectedSchedule = computed(() => activeSchedules.value.find((item) => item.id === selectedId.value) ?? null);

function scheduleStatus(item: EventScheduleRow): "upcoming" | "ongoing" | "ended" {
  const now = Date.now();
  const start = new Date(item.start).getTime();
  const end = new Date(item.end).getTime();
  if (now < start) return "upcoming";
  if (now > end) return "ended";
  return "ongoing";
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleString("vi-VN") : "—";
}

async function loadSchedules() {
  isLoading.value = true;
  loadError.value = "";
  try {
    schedules.value = await supabaseEventScheduleRepository.fetchAll();
    if (!selectedId.value && activeSchedules.value.length) {
      await selectSchedule(activeSchedules.value[0]);
    }
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : "Không thể tải danh sách sự kiện";
  } finally {
    isLoading.value = false;
  }
}

async function selectSchedule(item: EventScheduleRow) {
  selectedId.value = item.id;
  try {
    await supabaseEventScheduleRepository.incrementViewCount(item.id, item.viewCount);
    item.viewCount += 1;
  } catch {
    // Không chặn người dùng xem nội dung nếu cập nhật lượt xem thất bại
  }
}

onMounted(loadSchedules);
</script>
<template>
  <Modal title="Bảng sự kiện" sub-title="Sự kiện đang diễn ra" :on-refresh="loadSchedules">
    <section
      class="relative flex h-dvh w-screen max-w-none flex-col overflow-hidden border-0 bg-[#f4f5e9] text-[#20372a] shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-title"
    >
      <div v-if="isLoading" class="grid flex-1 place-items-center text-sm text-emerald-900/70">Đang tải sự kiện...</div>
      <div v-else-if="loadError" class="grid flex-1 place-items-center text-center text-sm text-red-700">
        <div>
          <p>{{ loadError }}</p>
          <button type="button" class="mt-2 font-bold underline" @click="loadSchedules">Thử lại</button>
        </div>
      </div>
      <div
        v-else
        class="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] md:grid-cols-[26rem_minmax(0,1fr)] md:grid-rows-1"
      >
        <!-- Danh sách sự kiện -->
        <section class="flex min-h-0 flex-col border-b border-emerald-950/10 md:border-b-0 md:border-r">
          <div class="flex items-center justify-between border-b border-emerald-950/10 px-5 py-3 sm:px-6">
            <h3 class="m-0 text-sm font-bold">Danh sách sự kiện</h3>
            <span class="text-xs text-emerald-900/60">{{ activeSchedules.length }} sự kiện</span>
          </div>
          <div class="flex-1 space-y-2 overflow-y-auto p-3 sm:p-4">
            <p v-if="!activeSchedules.length" class="py-8 text-center text-sm text-emerald-900/55">
              Hiện không có sự kiện nào.
            </p>
            <button
              v-for="item in activeSchedules"
              :key="item.id"
              type="button"
              class="w-full cursor-pointer rounded-lg p-3 text-left transition-colors"
              :class="selectedId === item.id ? 'bg-gray-50' : ''"
              @click="selectSchedule(item)"
            >
              <span class="flex items-start gap-3">
                <div>
                  <EventThumbnail :src="item.eventThumbnail" :rotate="-8" :width="160" :height="190" />
                </div>
                <span class="min-w-0 flex-1">
                  <span class="flex flex-col gap-2">
                    <span class="truncate text-sm font-bold">{{ item.eventName || "Sự kiện" }}</span>
                    <span
                      class="shrink-0 rounded-full w-fit px-2 py-0.5 text-[10px] font-bold"
                      :class="{
                        'bg-emerald-200 text-emerald-900': scheduleStatus(item) === 'ongoing',
                        'bg-amber-200 text-amber-900': scheduleStatus(item) === 'upcoming',
                        'bg-gray-200 text-gray-700': scheduleStatus(item) === 'ended',
                      }"
                    >
                      {{
                        scheduleStatus(item) === "ongoing"
                          ? "Đang diễn ra"
                          : scheduleStatus(item) === "upcoming"
                            ? "Sắp diễn ra"
                            : "Đã kết thúc"
                      }}
                    </span>
                  </span>
                  <span class="mt-1 block text-xs text-emerald-900/60"
                    >{{ formatDate(item.start) }} - {{ formatDate(item.end) }}</span
                  >
                </span>
              </span>
            </button>
          </div>
        </section>

        <!-- Chi tiết sự kiện -->
        <section class="min-h-0 overflow-y-auto">
          <article v-if="selectedSchedule" class="mx-auto min-w-3xl p-5 sm:p-8">
            <img
              v-if="selectedSchedule.eventImage"
              :src="selectedSchedule.eventImage"
              :alt="selectedSchedule.eventName || ''"
              class="mb-5 h-56 w-full rounded-xl border border-emerald-950/10 object-cover sm:h-72"
              draggable="false"
            />
            <p class="m-0 text-[10px] font-extrabold uppercase tracking-[0.14em] text-emerald-800">
              {{
                scheduleStatus(selectedSchedule) === "ongoing"
                  ? "Đang diễn ra"
                  : scheduleStatus(selectedSchedule) === "upcoming"
                    ? "Sắp diễn ra"
                    : "Đã kết thúc"
              }}
            </p>
            <h1 class="m-0 mt-2 flex items-center gap-2 text-2xl font-bold sm:text-3xl">
              <span>{{ "🎉" }}</span>
              <span>{{ selectedSchedule.eventName || "Sự kiện" }}</span>
            </h1>
            <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-emerald-900/60">
              <span>🗓️ {{ formatDate(selectedSchedule.start) }} — {{ formatDate(selectedSchedule.end) }}</span>
              <span>👁️ {{ selectedSchedule.viewCount }} lượt xem</span>
            </div>
            <hr class="my-5 border-emerald-950/10" />
            <div class="prose prose-sm max-w-none whitespace-pre-line text-[15px] leading-relaxed text-[#20372a]">
              {{ selectedSchedule.eventDescription || "Sự kiện chưa có mô tả chi tiết." }}
            </div>
          </article>
          <div v-else class="grid h-full place-items-center p-8 text-center text-sm text-emerald-900/55">
            Chọn một sự kiện ở danh sách bên trái để xem chi tiết.
          </div>
        </section>
      </div>
    </section>
  </Modal>
</template>
