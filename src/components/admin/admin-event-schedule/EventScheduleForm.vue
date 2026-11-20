<script setup lang="ts">
import { useAdminEventScheduleStore } from "./admin-event-schedule-store";

const store = useAdminEventScheduleStore();
</script>

<template>
  <div v-if="store.isFormOpen" class="fixed inset-0 z-40 flex bg-content/25" @click.self="store.closeForm()">
    <aside class="ml-auto flex h-full w-full max-w-xl flex-col border-l border-border bg-white shadow-xl">
      <div class="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
        <div>
          <div class="m-0 text-base font-extrabold text-content-strong">
            {{ store.form.id ? "Chỉnh sửa lịch sự kiện" : "Thêm lịch sự kiện" }}
          </div>
          <div class="m-0 mt-1 text-xs text-content">Thông tin trong bảng event_schedule</div>
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
        <div
          v-if="store.formError"
          class="rounded-lg border border-danger bg-surface px-3 py-2 text-sm text-danger"
        >
          {{ store.formError }}
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="flex flex-col gap-1.5 text-xs font-bold text-content sm:col-span-2"
            >Sự kiện *
            <select
              v-model="store.form.eventId"
              required
              class="rounded-md border border-content px-3 py-2 text-sm font-normal text-content focus:border-accent focus:outline-none"
            >
              <option value="" disabled>Chọn sự kiện</option>
              <option v-for="event in store.eventOptions" :key="event.id" :value="event.id">{{ event.name }}</option>
            </select>
          </label>
          <label class="flex flex-col gap-1.5 text-xs font-bold text-content"
            >Bắt đầu *
            <input
              v-model="store.form.start"
              type="datetime-local"
              required
              class="rounded-md border border-content px-3 py-2 text-sm font-normal text-content focus:border-accent focus:outline-none"
            />
          </label>
          <label class="flex flex-col gap-1.5 text-xs font-bold text-content"
            >Kết thúc *
            <input
              v-model="store.form.end"
              type="datetime-local"
              required
              class="rounded-md border border-content px-3 py-2 text-sm font-normal text-content focus:border-accent focus:outline-none"
            />
          </label>
          <label class="flex flex-col gap-1.5 text-xs font-bold text-content"
            >Lượt xem
            <input
              v-model.number="store.form.viewCount"
              type="number"
              min="0"
              step="1"
              class="rounded-md border border-content px-3 py-2 text-sm font-normal text-content focus:border-accent focus:outline-none"
            />
          </label>
          <label class="flex items-center gap-2 text-xs font-bold text-content">
            <input v-model="store.form.isDisabled" type="checkbox" class="size-4 rounded border-content" />
            Tắt lịch
          </label>
        </div>
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
          {{ store.isSaving ? "Đang lưu..." : "Lưu lịch sự kiện" }}
        </button>
      </div>
    </aside>
  </div>
</template>
