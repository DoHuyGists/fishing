<script setup lang="ts">
import { t as tr } from "../../i18n";
import { useLocaleStore } from "../../stores/locale";

const localeStore = useLocaleStore();
</script>

<template>
  <div class="slide-fade-in player-content-in from-top grid gap-2">
    <label class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-3.5 py-2.5 text-xs text-[#24352a]">
      <span class="font-medium">{{ tr('language.label') }}</span>
      <select v-model="localeStore.locale" :disabled="localeStore.saving" :aria-busy="localeStore.saving" class="cursor-pointer rounded bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-wait disabled:opacity-60">
        <option value="vi" lang="vi">Tiếng Việt</option>
        <option value="en" lang="en">English</option>
      </select>
    </label>
    <div v-if="localeStore.error" role="alert" class="text-xs text-red-700">{{ localeStore.error }}</div>
  </div>
</template>
