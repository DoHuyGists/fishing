<script setup lang="ts">
import { computed } from 'vue';
import { t as tr } from '../../i18n';

const props = defineProps<{
  page: number;
  total: number;
  pageSize: number;
  loading?: boolean;
}>();
const emit = defineEmits<{ change: [page: number] }>();
const pages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));
</script>

<template>
  <nav v-if="total > pageSize || page > 1" :aria-label="tr('pagination.label')" class="shared-pagination flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border-default bg-surface px-3 py-2 text-xs text-content">
    <span aria-live="polite">{{ tr('pagination.page', { page, pages, total }) }}</span>
    <div class="flex gap-2">
      <button type="button" class="rounded-lg border border-border-default px-3 py-2 disabled:opacity-40" :disabled="loading || page <= 1" @click="emit('change', page - 1)">{{ tr('pagination.previous') }}</button>
      <button type="button" class="rounded-lg border border-border-default px-3 py-2 disabled:opacity-40" :disabled="loading || page >= pages" @click="emit('change', page + 1)">{{ tr('pagination.next') }}</button>
    </div>
  </nav>
</template>

<style scoped>
.ocean-theme .shared-pagination {
  background: var(--color-ocean-deep);
  border-color: color-mix(in srgb, var(--color-gold) 25.098%, transparent);
}

.ocean-theme .shared-pagination button {
  color: var(--color-ocean-pearl);
  border-color: color-mix(in srgb, var(--color-sky) 34.902%, transparent);
  background: var(--color-ocean-panel);
  transition: border-color 150ms ease, background-color 150ms ease;
}

.ocean-theme .shared-pagination button:hover:not(:disabled) {
  border-color: var(--color-ocean-cyan);
  background: color-mix(in srgb, var(--color-ocean-panel) 75%, var(--color-ocean-cyan));
}

.ocean-theme .shared-pagination button:focus-visible {
  outline: 2px solid var(--color-ocean-cyan);
  outline-offset: 2px;
}
</style>
