<script setup lang="ts">
defineProps<{ fish: any; isLoading?: boolean }>();
const emit = defineEmits<{ cancel: []; confirm: [] }>();
</script>

<template>
  <div v-if="fish" class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs" @click.self="emit('cancel')">
    <div class="w-full max-w-sm rounded-xl border border-gray-300 bg-white p-5 text-center shadow-xl">
      <h3 class="m-0 text-base font-bold text-[#263238]">Xác nhận thả cá</h3>
      <p class="my-4 text-xs leading-relaxed text-gray-600">
        Bạn có chắc chắn muốn thả <strong class="text-[#153221]">{{ fish.species?.name }}</strong> về lại tự nhiên không?
      </p>
      <div class="mt-5 flex justify-center gap-3">
        <button type="button" class="rounded-lg border border-gray-300 px-4 py-1.5 text-xs font-bold hover:bg-gray-100" @click="emit('cancel')">Hủy</button>
        <button type="button" class="rounded-lg border border-red-600 bg-red-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50" :disabled="isLoading" @click="emit('confirm')">
          {{ isLoading ? 'Đang thả...' : 'Xác nhận thả' }}
        </button>
      </div>
    </div>
  </div>
</template>
