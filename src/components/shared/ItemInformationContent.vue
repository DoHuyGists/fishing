<script setup lang="ts">
import { ref, watch } from "vue";
import type { InformationModalContent } from "../../types/model/informationModal";
import { t as tr } from "../../i18n";

const props = defineProps<{ content: InformationModalContent }>();
const imageFailed = ref(false);
watch(() => props.content.image, () => { imageFailed.value = false; });
</script>

<template>
  <div class="space-y-5 text-left">
    <div class="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div class="flex size-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border-default bg-surface p-3 shadow-inner sm:size-36">
        <img v-if="content.image && !imageFailed" :src="content.image" :alt="content.name" class="size-full object-contain" draggable="false" @error="imageFailed = true" />
        <span v-else role="img" :aria-label="content.name" class="text-6xl">{{ content.icon || '🎒' }}</span>
      </div>
      <div class="min-w-0 flex-1 px-3 text-center sm:pl-0 sm:pr-4 sm:text-left">
        <div id="information-modal-title" class="break-words text-xl font-bold leading-snug text-accent sm:text-2xl">{{ content.name }}</div>
        <div v-if="content.itemDetails?.badges.length" class="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
          <span v-for="badge in content.itemDetails.badges" :key="badge" class="rounded-lg border border-border-default bg-surface px-2.5 py-1 text-xs font-medium">{{ badge }}</span>
        </div>
      </div>
    </div>

    <section v-if="content.description" class="rounded-xl border border-border-default bg-surface p-4" :aria-label="tr('InformationModal.description')">
      <div class="mb-2 text-xs font-semibold uppercase tracking-wide opacity-70">{{ tr('InformationModal.description') }}</div>
      <div id="information-modal-description" class="whitespace-pre-line text-sm leading-relaxed">{{ content.description }}</div>
    </section>

    <section v-if="content.itemDetails?.stats.length" :aria-label="tr('InformationModal.stats')">
      <div class="mb-3 text-sm font-semibold">{{ tr('InformationModal.stats') }}</div>
      <dl class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div v-for="stat in content.itemDetails.stats" :key="stat.label" class="min-w-0 rounded-xl border border-border-default bg-surface p-3">
          <dt class="break-words text-xs leading-relaxed opacity-70">{{ stat.label }}</dt>
          <dd class="m-0 mt-1.5 break-words text-lg font-bold tabular-nums text-accent">{{ stat.value }}</dd>
        </div>
      </dl>
    </section>

    <dl v-if="content.itemDetails?.metadata.length" class="space-y-3 border-t border-border-default pt-4 text-xs">
      <div v-for="field in content.itemDetails.metadata" :key="field.label" class="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <dt class="shrink-0 opacity-70">{{ field.label }}</dt>
        <dd class="m-0 min-w-0 break-all font-medium sm:text-right">{{ field.value }}</dd>
      </div>
    </dl>
  </div>
</template>
