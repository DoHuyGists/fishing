<script setup lang="ts">
import { useAdminNotificationStore } from "./admin-notification-store";

const store = useAdminNotificationStore();
</script>

<template>
  <div
    v-if="store.isFormOpen"
    class="fixed inset-0 z-30 grid place-items-center bg-black/45 p-4"
    @click.self="store.closeForm()"
  >
    <form
      class="flex max-h-full w-full max-w-xl flex-col rounded-xl bg-white shadow-xl"
      @submit.prevent="store.save()"
    >
      <header class="border-b border-gray-200 px-5 py-4">
        <h3 class="m-0 text-base font-extrabold text-[#153221]">
          {{
            store.editing
              ? "Sửa thông báo"
              : "Tạo thông báo " + (store.tab === "system" ? "hệ thống" : "cá nhân")
          }}
        </h3>
      </header>
      <div class="space-y-4 overflow-y-auto p-5">
        <p
          v-if="store.formError"
          role="alert"
          class="m-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {{ store.formError }}
        </p>
        <label v-if="store.tab === 'personal'" class="flex flex-col gap-1.5 text-xs font-bold text-gray-600"
          >UUID người dùng *<input
            v-model="store.form.userId"
            required
            class="rounded-md border border-gray-300 px-3 py-2 text-sm font-mono font-normal text-gray-800"
            placeholder="UUID" /></label
        ><label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600"
          >Tiêu đề *<input
            v-model="store.form.title"
            required
            maxlength="200"
            class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800" /></label
        ><label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600"
          >Nội dung *<textarea
            v-model="store.form.body"
            required
            rows="7"
            class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800"
          ></textarea></label
        ><label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600"
          >Loại<input
            v-model="store.form.type"
            class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800"
            placeholder="general" /></label
        ><label v-if="store.tab === 'system'" class="flex flex-col gap-1.5 text-xs font-bold text-gray-600"
          >Thời gian hết hạn<input
            v-model="store.form.expiresAt"
            type="datetime-local"
            class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800"
          /><span class="font-normal text-gray-500">Để trống nếu không hết hạn.</span></label
        >
      </div>
      <footer class="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700"
          @click="store.closeForm()"
        >
          Hủy</button
        ><button
          type="submit"
          :disabled="store.saving"
          class="rounded-lg bg-[#153221] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {{ store.saving ? "Đang lưu..." : "Lưu thông báo" }}
        </button>
      </footer>
    </form>
  </div>
</template>
