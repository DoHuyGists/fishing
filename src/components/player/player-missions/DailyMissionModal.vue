<script setup lang="ts">
import { ref } from "vue";
import { t as tr } from "../../../i18n/index.ts";
import { useStoryDialogFocus } from "../../../composables/useStoryDialogFocus.ts";
import DailyMission from "./DailyMission.vue";

const emit = defineEmits<{ close: [] }>();
const panel = ref<HTMLElement>();

useStoryDialogFocus(panel, () => emit("close"));
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[45] grid place-items-center bg-content/60 p-2 backdrop-blur-[3px] sm:p-5"
      @click.self="emit('close')"
    >
      <section
        ref="panel"
        role="dialog"
        aria-modal="true"
        :aria-label="tr('DailyMission.nhiem_vu_hang_ngay')"
        tabindex="-1"
        class="player-popup-in flex h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border-default bg-surface text-content shadow-xl outline-none"
      >
        <header class="flex shrink-0 items-center justify-between gap-3 border-b border-border-default px-4 py-3">
          <div class="text-base font-bold">{{ tr("DailyMission.nhiem_vu_hang_ngay") }}</div>
          <button
            type="button"
            class="grid size-9 shrink-0 place-items-center rounded-full text-2xl leading-none hover:bg-content/5"
            :aria-label="tr('ChangePasswordModal.dong')"
            @click="emit('close')"
          >
            ×
          </button>
        </header>
        <div class="min-h-0 flex-1 overflow-hidden p-2 sm:p-4">
          <DailyMission />
        </div>
      </section>
    </div>
  </Teleport>
</template>
