<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import type { SpeciesRow } from "../../../data/supabaseSpeciesRepository";
import SpeciesPickModal from "./SpeciesPickModal.vue";
import { useAdminHourMissionStore } from "./admin-hour-mission-store";

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
  "rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800 focus:border-emerald-600 focus:outline-none";
</script>

<template>
  <div v-if="store.isFormOpen" class="fixed inset-0 z-30 bg-black/25" @click.self="store.closeForm()">
    <aside class="ml-auto flex h-full w-full max-w-xl flex-col border-l border-gray-200 bg-white shadow-xl">
      <div class="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-4">
        <div>
          <h3 class="m-0 text-base font-extrabold text-[#153221]">
            {{ store.form.id ? "Chỉnh sửa nhiệm vụ giờ" : "Thêm nhiệm vụ giờ" }}
          </h3>
          <p class="m-0 mt-1 text-xs text-gray-500">Giờ lưu theo múi giờ UTC</p>
        </div>
        <button
          type="button"
          aria-label="Đóng biểu mẫu"
          class="grid size-8 place-items-center rounded-md text-xl text-gray-500 hover:bg-gray-100"
          @click="store.closeForm()"
        >
          &times;
        </button>
      </div>

      <form class="flex-1 space-y-4 overflow-y-auto p-5" @submit.prevent="store.save()">
        <div v-if="store.formError" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ store.formError }}
        </div>

        <div class="grid grid-cols-2 gap-4">
          <label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600"
            >Bắt đầu<input v-model="store.form.start" type="time" step="1" :class="inputClass"
          /></label>
          <label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600"
            >Kết thúc<input v-model="store.form.end" type="time" step="1" :class="inputClass"
          /></label>
        </div>
        <p class="m-0 -mt-2 text-xs leading-relaxed text-gray-500">
          Giờ hiện tại trên thiết bị của bạn là {{ localCurrentTime() }} (giờ địa phương), tương ứng
          {{ utcCurrentTime() }} UTC. Nếu muốn chọn giờ hiện tại, hãy nhập {{ utcCurrentTime() }} vào trường thời gian.
        </p>
        <br>

        <label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600"
          >Tiền thưởng (xu)<input
            v-model="store.form.cash"
            type="number"
            min="0"
            step="1"
            :class="inputClass"
        /></label>

        <label
          class="flex items-center gap-3 rounded-md border border-gray-200 px-3 py-3 text-sm font-semibold text-gray-700"
          ><input v-model="store.form.isDisabled" type="checkbox" class="size-4 accent-emerald-800" /><span
            >Tắt nhiệm vụ</span
          ></label
        >

        <section class="space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="m-0 text-xs font-bold text-gray-600">Cá cần câu ({{ store.form.content.length }})</h4>
            <button
              type="button"
              class="rounded-md border border-emerald-200 px-2.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50"
              @click="isPickerOpen = true"
            >
              + Thêm cá
            </button>
          </div>

          <p v-if="!store.form.content.length" class="m-0 text-xs text-gray-500">Chưa chọn cá nào</p>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div
              v-for="(fish, index) in store.form.content"
              :key="fish.id"
              class="relative flex flex-col items-center gap-1 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] p-3 text-center"
            >
              <button
                type="button"
                aria-label="Bỏ cá này"
                class="absolute right-1 top-1 grid size-6 place-items-center rounded-full text-base text-red-700 hover:bg-red-50"
                @click="store.removeFish(index)"
              >
                &times;
              </button>
              <img v-if="fish.image" :src="fish.image" :alt="fish.name" class="h-16 w-full object-contain" />
              <div v-else class="h-16" />
              <span class="text-sm font-bold text-[#24352a]">{{ fish.name }}</span>
              <span class="text-xs text-gray-500">{{ fish.rarity }}</span>
              <span v-if="fish.length" class="text-xs text-gray-500">{{ fish.length }}</span>
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

      <div class="flex shrink-0 items-center justify-end gap-2 border-t border-gray-200 px-5 py-4">
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100"
          @click="store.closeForm()"
        >
          Huỷ
        </button>
        <button
          type="button"
          :disabled="store.isSaving"
          class="rounded-lg bg-[#153221] px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
          @click="store.save()"
        >
          {{ store.isSaving ? "Đang lưu..." : "Lưu nhiệm vụ" }}
        </button>
      </div>
    </aside>
  </div>
</template>
