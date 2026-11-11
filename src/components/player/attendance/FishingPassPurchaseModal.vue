<script setup lang="ts">
import { computed } from "vue";
import Shells from "../currency/Shells.vue";
import { useCurrencyStore } from "../../../stores/currency";
import { useFishingPassStore } from "../../../stores/fishingPass";
import { useToast } from "../../../composables/useToast";

const emit = defineEmits<{ close: [] }>();
const currencyStore = useCurrencyStore();
const passStore = useFishingPassStore();
const toast = useToast();
const remainingShells = computed(() => Math.max(0, currencyStore.shells - passStore.price));

async function buyFishingPass() {
  try {
    const purchased = await passStore.buyFishingPass();
    if (!purchased) return;
    emit("close");
    toast.success("Mua Fishing Pass thành công!", { title: "Giao dịch thành công", position: "bottom" });
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Không thể mua Fishing Pass. Vui lòng thử lại.", { title: "Mua thất bại", position: "bottom" });
  }
}
</script>

<template>
  <div class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30 p-4" @click.self="emit('close')">
    <section class="w-full max-w-sm rounded-2xl border border-[#cbd9c6] bg-white p-4 text-[#24352a] shadow-xl" role="dialog" aria-modal="true" aria-labelledby="fishing-pass-confirm-title">
      <div id="fishing-pass-confirm-title" class="m-0 text-base font-extrabold">Xác nhận mua Fishing Pass</div>
      <div class="mb-0 mt-1 text-sm text-emerald-900/70">Mở khóa phần thưởng Fishing Pass</div>
      <div class="mt-4 space-y-3 rounded-xl bg-[#f5f9f0] p-3 text-sm">
        <div class="flex items-center justify-between gap-2"><span>Số vỏ sò hiện tại</span><Shells :amount="currencyStore.shells" :size="24" /></div>
        <div class="flex items-center justify-between gap-2"><span>Số vỏ sò cần thanh toán</span><Shells :amount="passStore.price" :size="24" /></div>
        <div class="flex items-center justify-between gap-2 border-t border-[#cbd9c6] pt-3 font-bold"><span>Số vỏ sò còn lại</span><Shells :amount="remainingShells" :size="24" /></div>
      </div>
      <div v-if="currencyStore.shells < passStore.price" class="mb-0 mt-3 text-sm font-semibold text-red-700" role="alert">Bạn không đủ vỏ sò để mua Fishing Pass.</div>
      <div class="mt-4 flex justify-end gap-2">
        <button type="button" class="rounded-lg border border-[#cbd9c6] px-3 py-2 text-sm font-bold text-[#24352a]" :disabled="passStore.isBuying" @click="emit('close')">Hủy</button>
        <button type="button" class="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50" :disabled="currencyStore.shells < passStore.price || passStore.isBuying" @click="buyFishingPass">{{ passStore.isBuying ? "Đang xử lý..." : "Xác nhận mua" }}</button>
      </div>
    </section>
  </div>
</template>
