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
  <nav v-if="total > pageSize || page > 1" :aria-label="tr('pagination.label')" class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#cbd9c6] bg-[#f5f9f0] px-3 py-2 text-xs text-[#24352a]">
    <span aria-live="polite">{{ tr('pagination.page', { page, pages, total }) }}</span>
    <div class="flex gap-2">
      <button type="button" class="rounded-lg border border-[#cbd9c6] px-3 py-2 disabled:opacity-40" :disabled="loading || page <= 1" @click="emit('change', page - 1)">{{ tr('pagination.previous') }}</button>
      <button type="button" class="rounded-lg border border-[#cbd9c6] px-3 py-2 disabled:opacity-40" :disabled="loading || page >= pages" @click="emit('change', page + 1)">{{ tr('pagination.next') }}</button>
    </div>
  </nav>
</template>
