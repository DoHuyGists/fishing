<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{ src: string; fallback: string }>();
const failed = ref(false);
watch(() => props.src, () => { failed.value = false; });
</script>

<template>
  <div class="flex size-14 shrink-0 items-center justify-center rounded-xl border border-border-default bg-surface">
    <img v-if="src && !failed" :src="src" alt="" class="size-12 object-contain" loading="lazy" @error="failed = true" />
    <span v-else aria-hidden="true" class="text-3xl">{{ fallback }}</span>
  </div>
</template>
