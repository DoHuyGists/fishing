<script setup lang="ts">
import { ref } from "vue";
import supabase from "../../../database/connection.ts";
import { useToast } from "../../../composables/useToast.ts";

const toast = useToast();
const code = ref("");
const isSubmitting = ref(false);

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
</template>
