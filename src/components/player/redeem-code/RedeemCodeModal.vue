<script setup lang="ts">
import { ref } from "vue";
import Modal from "../../shared/Modal.vue";
import CurrencyConvertTable from "./CurrencyConvertTable.vue";
import supabase from "../../../database/connection.ts";
import { useToast } from "../../../composables/useToast.ts";
import { useCurrencyStore } from "../../../stores/currency.ts";

const toast = useToast();
const currencyStore = useCurrencyStore();
const code = ref("");
const isSubmitting = ref(false);

async function loadData() {
  await Promise.all([currencyStore.fetchConversionRates(), currencyStore.fetchCurrency()]);
}

async function redeemCode() {
  const submittedCode = code.value.trim();
  if (!submittedCode || isSubmitting.value) return;

  isSubmitting.value = true;
  try {
    const { data, error } = await supabase.rpc("redeem_code", {
      p_code: submittedCode,
    });

    if (error) throw error;

    code.value = "";
    toast.success("Đổi mã thành công!");
    // Keep the returned value available for RPCs that provide a reward message.
    void data;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Không thể đổi mã. Vui lòng thử lại.");
  } finally {
    isSubmitting.value = false;
  }
}

</script>

<template>
  <Modal title="Đổi mã quà tặng" sub-title="Nhập mã để nhận phần thưởng" :on-refresh="loadData">
    <div class="mx-auto grid w-full max-w-7xl grid-cols-1 items-start gap-6 px-2 py-6 text-[#24352a] sm:px-4 sm:py-8 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
    <CurrencyConvertTable />
    <form
      class="min-w-0 w-full rounded-2xl border border-[#cbd9c6] bg-white p-5 shadow-sm sm:p-6"
      @submit.prevent="redeemCode"
    >
      <label for="redeem-code" class="mb-2 block text-sm font-bold">Mã đổi thưởng</label>
      <input
        id="redeem-code"
        v-model="code"
        type="text"
        name="code"
        autocomplete="off"
        required
        :disabled="isSubmitting"
        placeholder="Nhập mã của bạn"
        class="w-full rounded-lg border border-[#cbd9c6] px-3 py-3 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 disabled:bg-gray-100"
      />

      <div class="mt-5 flex justify-center">
        <button
          type="submit"
          class="min-h-11 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="isSubmitting || !code.trim()"
        >
          {{ isSubmitting ? "Đang đổi mã..." : "Đổi mã" }}
        </button>
      </div>
    </form>
    </div>
  </Modal>
</template>
