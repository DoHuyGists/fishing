<script setup lang="ts">
import { ref } from 'vue';
import { t } from '../../i18n';
import { useStoryDialogFocus } from '../../composables/useStoryDialogFocus';
defineProps<{ title: string; wide?: boolean; restoredEntrance?: boolean }>();
const emit = defineEmits<{ close: [] }>();
const panel = ref<HTMLElement>();
useStoryDialogFocus(panel, () => emit('close'));
</script>

<template>
  <Teleport to="body">
    <div class="story-dialog-backdrop" @click.self="emit('close')">
      <section ref="panel" class="story-dialog" :class="{ 'story-dialog--wide': wide, 'slide-fade-in from-bottom player-modal-restored': restoredEntrance }" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1">
        <header class="story-dialog-header"><div class="story-dialog-title">{{ title }}</div><button class="story-button" type="button" :aria-label="t('Story.close')" @click="emit('close')">✕</button></header>
        <div class="story-dialog-content"><slot /></div>
      </section>
    </div>
  </Teleport>
</template>
