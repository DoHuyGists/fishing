<script setup lang="ts">
import { t as tr } from "../../i18n";
import { useLocaleStore } from "../../stores/player-locale-store";

const localeStore = useLocaleStore();
</script>

<template>
  <div class="slide-fade-in player-content-in from-top grid gap-2">
    <label
      class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-default bg-surface px-3.5 py-2.5 text-xs text-content"
    >
      <span class="font-medium">{{ tr("language.label") }}</span>
      <select
        v-model="localeStore.locale"
        :disabled="localeStore.saving"
        :aria-busy="localeStore.saving"
        class="shared-language-select cursor-pointer rounded bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60"
      >
        <option value="vi" lang="vi">Tiếng Việt</option>
        <option value="en" lang="en">English</option>
      </select>
    </label>
    <div v-if="localeStore.error" role="alert" class="text-xs text-danger">{{ localeStore.error }}</div>
  </div>
</template>

<style scoped>
.ocean-theme .shared-language-select {
  color: var(--color-ocean-pearl);
  color-scheme: dark;
}

.ocean-theme .shared-language-select:focus-visible {
  outline-color: var(--color-ocean-cyan);
}

.ocean-theme .shared-language-select option {
  color: var(--color-ocean-pearl);
  background: var(--color-ocean-deep);
}
</style>
