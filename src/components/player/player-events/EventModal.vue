<script lang="ts" setup>
import { getFormattingLocale, t as tr } from "../../../i18n/index.ts";
import { onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useEventStore } from "../../../stores/player-event-store.ts";
import { useEventScheduleClock } from "../../../composables/useEventScheduleClock.ts";
import EventThumbnail from "./EventThumbnail.vue";
import Modal from "../../shared/Modal.vue";

const store = useEventStore();
const { activeSchedules, selectedId, selectedSchedule, isLoading, loadError } = storeToRefs(store);
const loadSchedules = () => store.loadSchedules();
const selectSchedule = store.selectSchedule;
const { scheduleStatus } = useEventScheduleClock();
function formatDate(value: string) {
  return value ? new Date(value).toLocaleString(getFormattingLocale()) : "—";
}
onMounted(loadSchedules);
</script>
<template>
  <Modal :title="tr('EventModal.bang_su_kien')" :on-refresh="loadSchedules">
    <section
      class="relative flex max-w-none h-full flex-col overflow-hidden border-0 bg-surface text-content"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-title"
    >
      <div v-if="isLoading" class="grid flex-1 place-items-center text-sm text-content/70">
        {{ tr("EventModal.dang_tai_su_kien") }}
      </div>
      <div v-else-if="loadError" class="grid flex-1 place-items-center text-center text-sm text-danger">
        <div>
          <div>{{ loadError }}</div>
          <button type="button" class="mt-2 font-bold underline" @click="loadSchedules">
            {{ tr("Maintenance.thu_lai") }}
          </button>
        </div>
      </div>
      <div
        v-else
        class="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] md:grid-cols-[26rem_minmax(0,1fr)] md:grid-rows-1"
      >
        <!-- Danh sách sự kiện -->
        <section class="flex min-h-0 flex-col border-b border-accent/10 md:border-b-0 md:border-r">
          <div class="flex items-center justify-between border-b border-accent/10 px-5 py-3 sm:px-6">
            <div class="m-0 text-sm font-bold">{{ tr("EventModal.danh_sach_su_kien") }}</div>
            <span class="text-xs text-content/60">{{ activeSchedules.length }} {{ tr("EventModal.su_kien") }}</span>
          </div>
          <div class="grow h-0 space-y-2 overflow-y-scroll p-3 sm:p-4">
            <div v-if="!activeSchedules.length" class="py-8 text-center text-sm text-content/55">
              {{ tr("EventModal.hien_khong_co_su_kien_nao") }}
            </div>
            <button
              v-for="item in activeSchedules"
              :key="item.id"
              type="button"
              class="slide-fade-in from-bottom player-content-in w-full cursor-pointer rounded-lg p-3 text-left transition-colors"
              :class="selectedId === item.id ? 'bg-white' : ''"
              @click="selectSchedule(item)"
            >
              <span class="flex items-start gap-3">
                <div>
                  <EventThumbnail :src="item.eventThumbnail" :rotate="-8" :width="160" :height="190" />
                </div>
                <span class="min-w-0 flex-1">
                  <span class="flex flex-col gap-2">
                    <span class="truncate text-sm font-bold">{{ item.eventName || tr("EventModal.su_kien_2") }}</span>
                    <span
                      class="shrink-0 rounded-full w-fit px-2 py-0.5 text-[10px] font-bold"
                      :class="{
                        'bg-accent text-content': scheduleStatus(item) === 'ongoing',
                        'bg-gold text-gold': scheduleStatus(item) === 'upcoming',
                        'bg-surface text-content': scheduleStatus(item) === 'ended',
                      }"
                    >
                      {{
                        scheduleStatus(item) === "ongoing"
                          ? tr("EventModal.dang_dien_ra")
                          : scheduleStatus(item) === "upcoming"
                            ? tr("EventModal.sap_dien_ra")
                            : tr("EventModal.da_ket_thuc")
                      }}
                    </span>
                  </span>
                  <span class="mt-1 block text-xs text-content/60"
                    >{{ formatDate(item.start) }} - {{ formatDate(item.end) }}</span
                  >
                </span>
              </span>
            </button>
          </div>
        </section>

        <!-- Chi tiết sự kiện -->
        <section class="min-h-0">
          <article
            v-if="selectedSchedule"
            class="slide-fade-in from-right player-content-in mx-auto p-5 sm:p-8 overflow-y-scroll h-full"
          >
            <img
              v-if="selectedSchedule.eventImage"
              :src="selectedSchedule.eventImage"
              :alt="selectedSchedule.eventName || ''"
              class="mb-5 h-56 w-full rounded-xl border border-accent/10 object-cover sm:h-72"
              draggable="false"
            />
            <div class="m-0 text-[10px] font-extrabold uppercase tracking-[0.14em] text-content">
              {{
                scheduleStatus(selectedSchedule) === "ongoing"
                  ? tr("EventModal.dang_dien_ra")
                  : scheduleStatus(selectedSchedule) === "upcoming"
                    ? tr("EventModal.sap_dien_ra")
                    : tr("EventModal.da_ket_thuc")
              }}
            </div>
            <div class="m-0 mt-2 flex items-center gap-2 text-2xl font-bold sm:text-3xl">
              <span>{{ "🎉" }}</span>
              <span>{{ selectedSchedule.eventName || tr("EventModal.su_kien_2") }}</span>
            </div>
            <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-content/60">
              <span>🗓️ {{ formatDate(selectedSchedule.start) }} — {{ formatDate(selectedSchedule.end) }}</span>
              <span>👁️ {{ selectedSchedule.viewCount }} {{ tr("EventModal.luot_xem") }}</span>
            </div>
            <hr class="my-5 border-accent/10" />
            <div class="prose prose-sm max-w-none whitespace-pre-line text-[15px] leading-relaxed text-content">
              {{ selectedSchedule.eventDescription || tr("EventModal.su_kien_chua_co_mo_ta_chi_tiet") }}
            </div>
          </article>
          <div v-else class="grid h-full place-items-center p-8 text-center text-sm text-content/55">
            {{ tr("EventModal.chon_mot_su_kien_o_danh_sach_ben_trai_de_xem_chi_tiet") }}
          </div>
        </section>
      </div>
    </section>
  </Modal>
</template>
