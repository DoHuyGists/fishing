<script setup lang="ts">
import { useAdminRedeemCodeStore } from "./admin-redeem-code-store";

const store = useAdminRedeemCodeStore();
</script>

<template>
  <div v-if="store.confirmDeleteId" class="fixed inset-0 z-40 grid place-items-center bg-black/45 p-4">
    <div class="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
      <h3 class="m-0 text-base font-extrabold text-gray-800">Xác nhận xoá mã?</h3>
      <p class="my-3 text-sm text-gray-600">Thao tác này không thể hoàn tác.</p>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-700"
          @click="store.confirmDeleteId = null"
        >
          Huỷ
        </button>
        <button
          type="button"
          :disabled="!!store.deletingId"
          class="rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
          @click="store.remove()"
        >
          {{ store.deletingId ? "Đang xoá..." : "Xoá mã" }}
        </button>
      </div>
    </div>
  </div>
</template>
