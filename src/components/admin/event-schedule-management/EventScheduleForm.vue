<script setup lang="ts">
import { useAdminEventScheduleStore } from "./admin-event-schedule-store";

const store = useAdminEventScheduleStore();
</script>

<template>
  <div v-if="store.isFormOpen" class="fixed inset-0 z-40 flex bg-black/25" @click.self="store.closeForm()">
    <aside class="ml-auto flex h-full w-full max-w-xl flex-col border-l border-gray-200 bg-white shadow-xl">
      <div class="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-4">
        <div>
          <h3 class="m-0 text-base font-extrabold text-[#153221]">
            {{ store.form.id ? "Chỉnh sửa lịch sự kiện" : "Thêm lịch sự kiện" }}
          </h3>
          <p class="m-0 mt-1 text-xs text-gray-500">Thông tin trong bảng event_schedule</p>
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
        <div
          v-if="store.formError"
          class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {{ store.formError }}
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600 sm:col-span-2"
            >Sự kiện *
            <select
              v-model="store.form.eventId"
              required
              class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800 focus:border-emerald-600 focus:outline-none"
            >
              <option value="" disabled>Chọn sự kiện</option>
              <option v-for="event in store.eventOptions" :key="event.id" :value="event.id">{{ event.name }}</option>
            </select>
          </label>
          <label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600"
            >Bắt đầu *
            <input
              v-model="store.form.start"
              type="datetime-local"
              required
              class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800 focus:border-emerald-600 focus:outline-none"
            />
          </label>
          <label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600"
            >Kết thúc *
            <input
              v-model="store.form.end"
              type="datetime-local"
              required
              class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800 focus:border-emerald-600 focus:outline-none"
            />
          </label>
          <label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600"
            >Lượt xem
            <input
              v-model.number="store.form.viewCount"
              type="number"
              min="0"
              step="1"
              class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800 focus:border-emerald-600 focus:outline-none"
            />
          </label>
          <label class="flex items-center gap-2 text-xs font-bold text-gray-600">
            <input v-model="store.form.isDisabled" type="checkbox" class="size-4 rounded border-gray-300" />
            Tắt lịch
          </label>
        </div>
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
          {{ store.isSaving ? "Đang lưu..." : "Lưu lịch sự kiện" }}
        </button>
      </div>
    </aside>
  </div>
</template>
