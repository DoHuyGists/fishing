<script setup lang="ts">
import { t as tr } from "../../../i18n";

import { ref } from "vue";
import { storeToRefs } from "pinia";
import { useRedeemCodeStore } from "../../../stores/player-redeem-code-store";

const redeemStore = useRedeemCodeStore();
const { isSubmitting } = storeToRefs(redeemStore);
const code = ref("");

async function redeemCode() {
  if (await redeemStore.redeem(code.value)) code.value = "";
}
</script>

<template>
  <form
    class="slide-fade-in from-right player-content-in min-w-0 w-full rounded-2xl border border-border-default bg-white p-5 shadow-sm sm:p-6"
    @submit.prevent="redeemCode"
  >
    <label for="redeem-code" class="mb-2 block text-sm font-bold">{{ tr('RedeemCodeForm.ma_doi_thuong') }}</label>
    <input
      id="redeem-code"
      v-model="code"
      type="text"
      name="code"
      autocomplete="off"
      required
      :disabled="isSubmitting"
      :placeholder="tr('RedeemCodeForm.nhap_ma_cua_ban')"
      class="w-full rounded-lg border border-border-default px-3 py-3 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 disabled:bg-gray-100"
    />

    <div class="mt-5 flex justify-center">
      <button
        type="submit"
        class="min-h-11 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="isSubmitting || !code.trim()"
      >
        {{ isSubmitting ? tr('RedeemCodeForm.dang_doi_ma') : tr('RedeemCodeForm.doi_ma') }}
      </button>
    </div>
  </form>
</template>
