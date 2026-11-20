<script setup lang="ts">
import type { SpeciesRow } from "../../../types/table/species.ts";
import { onMounted, onUnmounted, ref } from "vue";

import SpeciesPickModal from "./SpeciesPickModal.vue";
import { useAdminHourMissionStore } from "./admin-hour-mission-store.ts";

const store = useAdminHourMissionStore();
const isPickerOpen = ref(false);
const currentTime = ref(new Date());
let clockInterval: ReturnType<typeof setInterval>;

const formatTime = (hours: number, minutes: number) =>
  `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
const localCurrentTime = () => formatTime(currentTime.value.getHours(), currentTime.value.getMinutes());
const utcCurrentTime = () => formatTime(currentTime.value.getUTCHours(), currentTime.value.getUTCMinutes());

onMounted(() => {
  clockInterval = setInterval(() => {
    currentTime.value = new Date();
  }, 60_000);
});

onUnmounted(() => clearInterval(clockInterval));

function onPick(selected: SpeciesRow[]) {
  store.setFishFromSpecies(selected);
  isPickerOpen.value = false;
}
const inputClass =
  "rounded-md border border-content px-3 py-2 text-sm font-normal text-content focus:border-accent focus:outline-none";
</script>

<template>
  <div v-if="store.isFormOpen" class="fixed inset-0 z-30 bg-content/25" @click.self="store.closeForm()">
    <aside class="ml-auto flex h-full w-full max-w-xl flex-col border-l border-border bg-white shadow-xl">
      <div class="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
        <div>
          <div class="m-0 text-base font-extrabold text-content-strong">
            {{ store.form.id ? "Chỉnh sửa nhiệm vụ giờ" : "Thêm nhiệm vụ giờ" }}
          </div>
          <div class="m-0 mt-1 text-xs text-content">Giờ lưu theo múi giờ UTC</div>
        </div>
        <button
          type="button"
          aria-label="Đóng biểu mẫu"
          class="grid size-8 place-items-center rounded-md text-xl text-content hover:bg-surface"
          @click="store.closeForm()"
        >
          &times;
        </button>
      </div>

      <form class="flex-1 space-y-4 overflow-y-auto p-5" @submit.prevent="store.save()">
        <div v-if="store.formError" class="rounded-lg border border-danger bg-surface px-3 py-2 text-sm text-danger">
          {{ store.formError }}
        </div>

        <div class="grid grid-cols-2 gap-4">
          <label class="flex flex-col gap-1.5 text-xs font-bold text-content"
            >Bắt đầu<input v-model="store.form.start" type="time" step="1" :class="inputClass"
          /></label>
          <label class="flex flex-col gap-1.5 text-xs font-bold text-content"
            >Kết thúc<input v-model="store.form.end" type="time" step="1" :class="inputClass"
          /></label>
        </div>
        <div class="m-0 -mt-2 text-xs leading-relaxed text-content">
          Giờ hiện tại trên thiết bị của bạn là {{ localCurrentTime() }} (giờ địa phương), tương ứng
          {{ utcCurrentTime() }} UTC. Nếu muốn chọn giờ hiện tại, hãy nhập {{ utcCurrentTime() }} vào trường thời gian.
        </div>
        <br />

        <label class="flex flex-col gap-1.5 text-xs font-bold text-content"
          >Tiền thưởng (xu)<input v-model="store.form.cash" type="number" min="0" step="1" :class="inputClass"
        /></label>

        <label
          class="flex items-center gap-3 rounded-md border border-border px-3 py-3 text-sm font-semibold text-content"
          ><input v-model="store.form.isDisabled" type="checkbox" class="size-4 accent-accent" /><span
            >Tắt nhiệm vụ</span
          ></label
        >

        <section class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="m-0 text-xs font-bold text-content">Cá cần câu ({{ store.form.content.length }})</div>
            <button
              type="button"
              class="rounded-md border border-accent px-2.5 py-1.5 text-xs font-bold text-content hover:bg-surface"
              @click="isPickerOpen = true"
            >
              + Thêm cá
            </button>
          </div>

          <div v-if="!store.form.content.length" class="m-0 text-xs text-content">Chưa chọn cá nào</div>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div
              v-for="(fish, index) in store.form.content"
              :key="fish.id"
              class="relative flex flex-col items-center gap-1 rounded-lg border border-border-default bg-surface p-3 text-center"
            >
              <button
                type="button"
                aria-label="Bỏ cá này"
                class="absolute right-1 top-1 grid size-6 place-items-center rounded-full text-base text-danger hover:bg-surface"
                @click="store.removeFish(index)"
              >
                &times;
              </button>
              <img v-if="fish.image" :src="fish.image" :alt="fish.name" class="h-16 w-full object-contain" />
              <div v-else class="h-16" />
              <span class="text-sm font-bold text-content">{{ fish.name }}</span>
              <span class="text-xs text-content">{{ fish.rarity }}</span>
              <span v-if="fish.length" class="text-xs text-content">{{ fish.length }}</span>
            </div>
          </div>
        </section>

        <SpeciesPickModal
          v-if="isPickerOpen"
          :selected-ids="store.form.content.map((fish) => fish.id)"
          @close="isPickerOpen = false"
          @confirm="onPick"
        />
      </form>

      <div class="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-4">
        <button
          type="button"
          class="rounded-lg border border-content px-4 py-2 text-sm font-bold text-content hover:bg-surface"
          @click="store.closeForm()"
        >
          Huỷ
        </button>
        <button
          type="button"
          :disabled="store.isSaving"
          class="rounded-lg bg-content-strong px-4 py-2 text-sm font-bold text-white hover:bg-accent disabled:opacity-50"
          @click="store.save()"
        >
          {{ store.isSaving ? "Đang lưu..." : "Lưu nhiệm vụ" }}
        </button>
      </div>
    </aside>
  </div>
</template>
