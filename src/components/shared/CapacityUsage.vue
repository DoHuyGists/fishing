<script setup lang="ts">
import { t as tr } from "../../i18n";

defineProps<{ label: string; used: number | null; capacity: number | null }>();
</script>

<template>
  <span class="inline-flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
    <span>{{ label }}</span>
    <b :class="used !== null && capacity !== null && used >= capacity ? 'text-gold' : 'text-content'">
      {{ tr('Capacity.usage', { used: used ?? '…', capacity: capacity ?? '…' }) }}
    </b>
  </span>
</template>
