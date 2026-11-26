<script setup lang="ts">
import { onMounted, onUnmounted, useTemplateRef } from "vue";
import { t as tr } from "../../../i18n/index.ts";
import { useModalStore } from "../../../stores/player-modal-store.ts";
import Modal from "../../shared/Modal.vue";

const modalStore = useModalStore();
const content = useTemplateRef<HTMLDivElement>("content");
const previousFocus = document.activeElement;
const sections = [
  { key: "fairPlay", icon: "⚖️" },
  { key: "bugs", icon: "🛠️" },
  { key: "respect", icon: "🤝" },
  { key: "trading", icon: "🛒" },
  { key: "security", icon: "🔒" },
  { key: "balance", icon: "🌿" },
] as const;

onMounted(() => content.value?.focus({ preventScroll: true }));
onUnmounted(() => {
  if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
});
</script>

<template>
  <Modal
    :title="tr('RuleModal.title')"
    :show-count-data="false"
    role="dialog"
    aria-modal="true"
    :aria-label="tr('RuleModal.title')"
    @keydown.esc.stop="modalStore.close()"
  >
    <div ref="content" tabindex="-1" class="space-y-4 text-content outline-none">
      <div class="rounded-xl border border-border-default bg-surface p-4 text-sm leading-6">
        <div class="font-bold">{{ tr("RuleModal.introTitle") }}</div>
        <div class="mt-1">{{ tr("RuleModal.intro") }}</div>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <section
          v-for="(section, index) in sections"
          :key="section.key"
          :aria-labelledby="`rule-${section.key}`"
          class="slide-fade-in from-bottom rounded-xl border border-border-default bg-white p-4 [--slide-distance:12px]!"
        >
          <div class="mb-3 flex items-center gap-2">
            <span
              aria-hidden="true"
              class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface text-lg"
              >{{ section.icon }}</span
            >
            <div :id="`rule-${section.key}`" class="text-sm font-bold leading-5">
              <span class="mr-1 text-content">{{ String(index + 1).padStart(2, "0") }}.</span>
              {{ tr(`RuleModal.${section.key}Title`) }}
            </div>
          </div>
          <div class="space-y-2 text-sm leading-6">
            <div v-for="item in ['first', 'second']" :key="item" class="flex items-start gap-2">
              <span aria-hidden="true" class="mt-2.5 size-1.5 shrink-0 rounded-full bg-content"></span>
              <div>{{ tr(`RuleModal.${section.key}_${item}`) }}</div>
            </div>
          </div>
        </section>
      </div>

      <div class="rounded-xl border border-border-default bg-surface p-4">
        <div class="text-sm font-bold">{{ tr("RuleModal.reportTitle") }}</div>
        <div class="mt-1 text-sm leading-6">{{ tr("RuleModal.reportDescription") }}</div>
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-lg border border-accent bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            @click="modalStore.open('feedback')"
          >
            {{ tr("RuleModal.reportAction") }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-border-default bg-white px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            @click="modalStore.close()"
          >
            {{ tr("RuleModal.close") }}
          </button>
        </div>
      </div>
    </div>
  </Modal>
</template>
