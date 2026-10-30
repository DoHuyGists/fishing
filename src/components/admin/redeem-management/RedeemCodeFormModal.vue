<script setup lang="ts">
import { useAdminRedeemCodeStore } from "./admin-redeem-code-store";

const store = useAdminRedeemCodeStore();
</script>

<template>
  <div v-if="store.isFormOpen" class="fixed inset-0 z-30 bg-black/25" @click.self="store.closeForm()">
    <aside class="ml-auto flex h-full w-full max-w-xl flex-col border-l border-gray-200 bg-white shadow-xl">
      <div class="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-4">
        <div>
          <h3 class="m-0 text-base font-extrabold text-[#153221]">
            {{ store.form.id ? "Chỉnh sửa mã" : "Thêm mã đổi thưởng" }}
          </h3>
          <p class="m-0 mt-1 text-xs text-gray-500">Mã đổi xu cho người chơi</p>
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
        <label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600"
          >Mã đổi thưởng *<input
            v-model="store.form.code"
            required
            maxlength="100"
            autocomplete="off"
            class="rounded-md border border-gray-300 px-3 py-2 font-mono text-sm font-normal text-gray-800 focus:border-emerald-600 focus:outline-none"
        /></label>
        <label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600"
          >Số xu thưởng *<input
            v-model="store.form.cash"
            type="number"
            required
            min="1"
            step="1"
            class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800 focus:border-emerald-600 focus:outline-none"
        /></label>
        <label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600"
          >Hạn sử dụng<input
            v-model="store.form.expiresAt"
            type="datetime-local"
            class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800 focus:border-emerald-600 focus:outline-none"
          /><span class="font-normal text-gray-500">Để trống nếu mã không hết hạn.</span></label
        >
        <label
          class="flex items-center gap-3 rounded-md border border-gray-200 px-3 py-3 text-sm font-semibold text-gray-700"
          ><input v-model="store.form.isDisabled" type="checkbox" class="size-4 accent-emerald-800" /><span
            >Tắt mã đổi thưởng</span
          ></label
        >
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
          {{ store.isSaving ? "Đang lưu..." : "Lưu mã" }}
        </button>
      </div>
    </aside>
  </div>
</template>
