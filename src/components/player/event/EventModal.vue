<script lang="ts" setup>
import type { EventScheduleRow } from "../../../types/table/eventSchedule";
import { getFormattingLocale } from '../../../i18n';
import { t as tr } from "../../../i18n";

import { computed, onMounted, ref } from "vue";
import { supabaseEventScheduleRepository } from "../../../data/supabaseEventScheduleRepository.ts";
import EventThumbnail from "./EventThumbnail.vue";
import Modal from "../../shared/Modal.vue";

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
  return value ? new Date(value).toLocaleString(getFormattingLocale()) : "—";
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
    loadError.value = error instanceof Error ? error.message : tr('EventModal.khong_the_tai_danh_sach_su_kien');
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
  <Modal :title="tr('EventModal.bang_su_kien')" :sub-title="tr('EventModal.su_kien_dang_dien_ra')" :on-refresh="loadSchedules">
    <section
      class="relative flex max-w-none h-full flex-col overflow-hidden border-0 bg-[#f4f5e9] text-[#20372a]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-title"
    >
      <div v-if="isLoading" class="grid flex-1 place-items-center text-sm text-emerald-900/70">{{ tr('EventModal.dang_tai_su_kien') }}</div>
      <div v-else-if="loadError" class="grid flex-1 place-items-center text-center text-sm text-red-700">
        <div>
          <div>{{ loadError }}</div>
          <button type="button" class="mt-2 font-bold underline" @click="loadSchedules">{{ tr('Maintenance.thu_lai') }}</button>
        </div>
      </div>
      <div
        v-else
        class="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] md:grid-cols-[26rem_minmax(0,1fr)] md:grid-rows-1"
      >
        <!-- Danh sách sự kiện -->
        <section class="flex min-h-0 flex-col border-b border-emerald-950/10 md:border-b-0 md:border-r">
          <div class="flex items-center justify-between border-b border-emerald-950/10 px-5 py-3 sm:px-6">
            <div class="m-0 text-sm font-bold">{{ tr('EventModal.danh_sach_su_kien') }}</div>
            <span class="text-xs text-emerald-900/60">{{ activeSchedules.length }} {{ tr('EventModal.su_kien') }}</span>
          </div>
          <div class="grow h-0 space-y-2 overflow-y-scroll p-3 sm:p-4">
            <div v-if="!activeSchedules.length" class="py-8 text-center text-sm text-emerald-900/55">
              {{ tr('EventModal.hien_khong_co_su_kien_nao') }}
            </div>
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
                    <span class="truncate text-sm font-bold">{{ item.eventName || tr('EventModal.su_kien_2') }}</span>
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
                          ? tr('EventModal.dang_dien_ra')
                          : scheduleStatus(item) === "upcoming"
                            ? tr('EventModal.sap_dien_ra')
                            : tr('EventModal.da_ket_thuc')
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
        <section class="min-h-0">
          <article v-if="selectedSchedule" class="mx-auto p-5 sm:p-8 overflow-y-scroll h-full">
            <img
              v-if="selectedSchedule.eventImage"
              :src="selectedSchedule.eventImage"
              :alt="selectedSchedule.eventName || ''"
              class="mb-5 h-56 w-full rounded-xl border border-emerald-950/10 object-cover sm:h-72"
              draggable="false"
            />
            <div class="m-0 text-[10px] font-extrabold uppercase tracking-[0.14em] text-emerald-800">
              {{
                scheduleStatus(selectedSchedule) === "ongoing"
                  ? tr('EventModal.dang_dien_ra')
                  : scheduleStatus(selectedSchedule) === "upcoming"
                    ? tr('EventModal.sap_dien_ra')
                    : tr('EventModal.da_ket_thuc')
              }}
            </div>
            <div class="m-0 mt-2 flex items-center gap-2 text-2xl font-bold sm:text-3xl">
              <span>{{ "🎉" }}</span>
              <span>{{ selectedSchedule.eventName || tr('EventModal.su_kien_2') }}</span>
            </div>
            <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-emerald-900/60">
              <span>🗓️ {{ formatDate(selectedSchedule.start) }} — {{ formatDate(selectedSchedule.end) }}</span>
              <span>👁️ {{ selectedSchedule.viewCount }} {{ tr('EventModal.luot_xem') }}</span>
            </div>
            <hr class="my-5 border-emerald-950/10" />
            <div class="prose prose-sm max-w-none whitespace-pre-line text-[15px] leading-relaxed text-[#20372a]">
              {{ selectedSchedule.eventDescription || tr('EventModal.su_kien_chua_co_mo_ta_chi_tiet') }}
            </div>
          </article>
          <div v-else class="grid h-full place-items-center p-8 text-center text-sm text-emerald-900/55">
            {{ tr('EventModal.chon_mot_su_kien_o_danh_sach_ben_trai_de_xem_chi_tiet') }}
          </div>
        </section>
      </div>
    </section>
  </Modal>
</template>
