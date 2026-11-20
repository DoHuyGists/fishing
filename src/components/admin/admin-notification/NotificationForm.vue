<script setup lang="ts">
import { useAdminNotificationStore } from "./admin-notification-store";

const store = useAdminNotificationStore();
</script>

<template>
  <div
    v-if="store.isFormOpen"
    class="fixed inset-0 z-30 grid place-items-center bg-content/45 p-4"
    @click.self="store.closeForm()"
  >
    <form
      class="flex max-h-full w-full max-w-xl flex-col rounded-xl bg-white shadow-xl"
      @submit.prevent="store.save()"
    >
      <header class="border-b border-border px-5 py-4">
        <div class="m-0 text-base font-extrabold text-content-strong">
          {{
            store.editing
              ? "Sửa thông báo"
              : "Tạo thông báo " + (store.tab === "system" ? "hệ thống" : "cá nhân")
          }}
        </div>
      </header>
      <div class="space-y-4 overflow-y-auto p-5">
        <div
          v-if="store.formError"
          role="alert"
          class="m-0 rounded-lg border border-danger bg-surface px-3 py-2 text-sm text-danger"
        >
          {{ store.formError }}
        </div>
        <label v-if="store.tab === 'personal'" class="flex flex-col gap-1.5 text-xs font-bold text-content"
          >UUID người dùng *<input
            v-model="store.form.userId"
            required
            class="rounded-md border border-content px-3 py-2 text-sm font-mono font-normal text-content"
            placeholder="UUID" /></label
        ><label class="flex flex-col gap-1.5 text-xs font-bold text-content"
          >Tiêu đề *<input
            v-model="store.form.title"
            required
            maxlength="200"
            class="rounded-md border border-content px-3 py-2 text-sm font-normal text-content" /></label
        ><label class="flex flex-col gap-1.5 text-xs font-bold text-content"
          >Nội dung *<textarea
            v-model="store.form.body"
            required
            rows="7"
            class="rounded-md border border-content px-3 py-2 text-sm font-normal text-content"
          ></textarea></label
        ><label class="flex flex-col gap-1.5 text-xs font-bold text-content"
          >Loại<input
            v-model="store.form.type"
            class="rounded-md border border-content px-3 py-2 text-sm font-normal text-content"
            placeholder="general" /></label
        ><label v-if="store.tab === 'system'" class="flex flex-col gap-1.5 text-xs font-bold text-content"
          >Thời gian hết hạn<input
            v-model="store.form.expiresAt"
            type="datetime-local"
            class="rounded-md border border-content px-3 py-2 text-sm font-normal text-content"
          /><span class="font-normal text-content">Để trống nếu không hết hạn.</span></label
        >
      </div>
      <footer class="flex justify-end gap-2 border-t border-border px-5 py-4">
        <button
          type="button"
          class="rounded-lg border border-content px-4 py-2 text-sm font-bold text-content"
          @click="store.closeForm()"
        >
          Hủy</button
        ><button
          type="submit"
          :disabled="store.saving"
          class="rounded-lg bg-content-strong px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {{ store.saving ? "Đang lưu..." : "Lưu thông báo" }}
        </button>
      </footer>
    </form>
  </div>
</template>
