<script lang="ts" setup>
import { useAuthStore } from '../../stores/auth';
import { useCurrencyStore } from '../../stores/currency';

const emit = defineEmits(["close"]);
const authStore = useAuthStore();
const currencyStore = useCurrencyStore();
</script>
<template>
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        class="w-full max-w-md bg-white border border-gray-300 rounded-xl p-5 shadow-[0_12px_32px_rgba(38,50,56,0.25)] relative">
        <div class="flex items-center justify-between border-b border-gray-300 pb-3 mb-4">
          <h3 class="m-0 text-base font-bold text-[#263238]">Thông tin tài khoản</h3>
          <button type="button"
            class="border-0 bg-transparent text-[#263238] hover:text-[#d84315] font-bold text-xl cursor-pointer leading-none px-1"
            @click="emit('close')">
            &times;
          </button>
        </div>

        <div class="flex flex-col gap-3 text-xs text-[#263238]">
          <div class="flex justify-between items-center py-1.5 border-b border-gray-100">
            <span class="text-gray-500 font-medium">Email</span>
            <span class="font-bold">{{ authStore.user?.email || "Chưa cập nhật" }}</span>
          </div>
          <div class="flex justify-between items-center py-1.5 border-b border-gray-100">
            <span class="text-gray-500 font-medium">User ID</span>
            <span class="font-mono text-[11px] bg-gray-100 px-2 py-0.5 rounded">{{ authStore.userId || "N/A" }}</span>
          </div>
          <div class="flex justify-between items-center py-1.5 border-b border-gray-100">
            <span class="text-gray-500 font-medium">Số tiền hiện tại</span>
            <span class="font-bold text-amber-600 text-sm">{{ currencyStore.formattedCash }} đ</span>
          </div>
        </div>

        <div class="mt-5 flex justify-end">
          <button type="button"
            class="py-1.5 px-4 rounded-lg border border-gray-300 bg-transparent text-[#263238] text-xs font-bold cursor-pointer hover:bg-[#eef3f1]"
            @click="emit('close')">
            Đóng
          </button>
        </div>
      </div>
    </div>
</template>