<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import Modal from "../Modal.vue";
import supabase from "../../database/connection";
import { useCurrencyStore } from "../../stores/currency";
import { useModalStore } from "../../stores/modal";

const currencyStore = useCurrencyStore();
const modalStore = useModalStore();
const code = ref("");
const isSubmitting = ref(false);
const notice = ref<{ type: "success" | "error"; text: string } | null>(null);
let noticeTimer: ReturnType<typeof setTimeout> | undefined;

function showNotice(type: "success" | "error", text: string) {
  notice.value = { type, text };
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => (notice.value = null), 4000);
}

async function redeemCode() {
  const submittedCode = code.value.trim();
  if (!submittedCode || isSubmitting.value) return;

  isSubmitting.value = true;
  notice.value = null;
  try {
    const { data, error } = await supabase.rpc("redeem_code", {
      p_code: submittedCode,
    });

    if (error) throw error;

    await currencyStore.fetchCurrency();
    code.value = "";
    showNotice("success", "Đổi mã thành công!");
    // Keep the returned value available for RPCs that provide a reward message.
    void data;
  } catch (error) {
    showNotice("error", error instanceof Error ? error.message : "Không thể đổi mã. Vui lòng thử lại.");
  } finally {
    isSubmitting.value = false;
  }
}

onUnmounted(() => {
  if (noticeTimer) clearTimeout(noticeTimer);
});
</script>

<template>
  <Modal title="Đổi mã quà tặng" sub-title="Nhập mã để nhận phần thưởng">
    <form class="mx-auto mt-8 w-full max-w-md rounded-2xl border border-emerald-950/10 bg-white p-6 shadow-sm" @submit.prevent="redeemCode">
      <label for="redeem-code" class="mb-2 block text-sm font-bold text-emerald-950">Mã đổi thưởng</label>
      <input
        id="redeem-code"
        v-model="code"
        type="text"
        name="code"
        autocomplete="off"
        required
        :disabled="isSubmitting"
        placeholder="Nhập mã của bạn"
        class="w-full rounded-lg border border-emerald-900/20 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 disabled:bg-gray-100"
      />

      <p v-if="notice" class="mt-4 rounded-lg px-3 py-2 text-sm font-medium" :class="notice.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'" :role="notice.type === 'error' ? 'alert' : 'status'">
        {{ notice.text }}
      </p>

      <div class="mt-5 flex justify-center gap-2">
        <button type="submit" class="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50" :disabled="isSubmitting || !code.trim()">
          {{ isSubmitting ? "Đang đổi mã..." : "Đổi mã" }}
        </button>
      </div>
    </form>
  </Modal>
</template>
