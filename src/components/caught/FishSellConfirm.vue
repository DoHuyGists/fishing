<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Cash from '../currency/Cash.vue';
import { useCurrencyStore } from '../../stores/currency';

const props = defineProps<{ fish: any; isLoading?: boolean; error?: string }>();
const emit = defineEmits<{ cancel: []; confirm: [price: number] }>();
const currencyStore = useCurrencyStore();
const price = ref<number | ''>('');
const listedPrice = 500;
const balanceFee = computed(() => {
  const amount = Number(price.value);
  return amount >= 1000 ? Math.floor(amount * Math.floor(amount / 1000) * 0.01) : 0;
});
watch(() => props.fish, () => { price.value = ''; });
function confirm() {
  if (Number(price.value) > 0) emit('confirm', Number(price.value));
}
</script>

<template>
  <div v-if="fish" class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs" @click.self="emit('cancel')">
    <div class="relative w-full max-w-sm rounded-xl border border-gray-300 bg-white p-5 text-center shadow-xl">
      <h3 class="m-0 text-base font-bold text-[#263238]">Đăng bán cá</h3>
      <p class="my-3 text-xs leading-relaxed text-gray-600">Đăng bán <strong class="text-[#153221]">{{ fish.species?.name }}</strong> lên thị trường.</p>
      <div class="my-4 text-left">
        <input v-model.number="price" type="number" min="1" placeholder="Nhập giá bán..." class="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none" @keydown="(e: KeyboardEvent) => { if (['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault(); }" @keyup.enter="confirm" />
        <p v-if="error" class="mt-1 text-[11px] font-medium text-red-500">{{ error }}</p>
        <p v-else-if="price !== '' && Number(price) <= 0" class="mt-1 text-[11px] font-medium text-red-500">Giá bán phải lớn hơn 0.</p>
      </div>
      <div class="space-y-2 text-left text-xs">
        <div class="flex items-center gap-2"><span>Số dư hiện tại:</span><Cash :amount="currencyStore.cash" /></div>
        <hr />
        <div class="flex items-center gap-2"><span>Phí niêm yết thị trường:</span><Cash :amount="listedPrice" /></div>
        <div class="flex items-center gap-2"><span>Phí cân bằng thị trường:</span><Cash :amount="balanceFee" /></div>
        <hr />
        <div class="flex items-center gap-2"><span>Tổng phí:</span><Cash :amount="listedPrice + balanceFee" /></div>
      </div>
      <div class="mt-5 flex justify-center gap-3">
        <button type="button" class="rounded-lg border border-gray-300 px-4 py-1.5 text-xs font-bold hover:bg-gray-100" @click="emit('cancel')">Hủy</button>
        <button type="button" class="rounded-lg bg-[#153221] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#1a3e29] disabled:opacity-50" :disabled="isLoading || Number(price) <= 0" @click="confirm">{{ isLoading ? 'Đang xử lý...' : 'Đăng bán' }}</button>
      </div>
    </div>
  </div>
</template>
