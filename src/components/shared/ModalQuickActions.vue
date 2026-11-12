<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { t as tr } from "../../i18n";
import { useModalStore } from "../../stores/modal";

const modalStore = useModalStore();
const quickActionsBox = ref<HTMLDivElement | null>(null);
let hideTimer: ReturnType<typeof setTimeout> | undefined;

function trackPointer(event: MouseEvent) {
  modalStore.trackPointer(event.clientX, event.clientY);
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== "Escape" || !modalStore.isModalOpening) return;
  // Handle Escape before individual modals can close themselves.
  event.preventDefault();
  event.stopImmediatePropagation();
  if (event.repeat) return;
  modalStore.showQuickActions();
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => modalStore.hideQuickActions(), 2000);
}

function hide() {
  clearTimeout(hideTimer);
  modalStore.hideQuickActions();
}

function handleOutsidePointerDown(event: PointerEvent) {
  if (!modalStore.quickActions.visible || event.composedPath().includes(quickActionsBox.value as EventTarget)) return;
  hide();
}

watch(() => modalStore.modalOpening, hide, { flush: "sync" });

onMounted(() => {
  window.addEventListener("mousemove", trackPointer, { passive: true });
  window.addEventListener("keydown", handleKeydown, true);
  window.addEventListener("pointerdown", handleOutsidePointerDown, true);
  window.addEventListener("resize", hide);
  window.addEventListener("blur", hide);
});

onUnmounted(() => {
  window.removeEventListener("mousemove", trackPointer);
  window.removeEventListener("keydown", handleKeydown, true);
  window.removeEventListener("pointerdown", handleOutsidePointerDown, true);
  window.removeEventListener("resize", hide);
  window.removeEventListener("blur", hide);
  hide();
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modalStore.isModalOpening && modalStore.quickActions.visible"
      ref="quickActionsBox"
      class="fixed z-[10001] flex h-12 w-28 max-w-screen items-center rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] p-1 text-[#24352a] shadow-lg"
      :style="{ left: `${modalStore.quickActions.x}px`, top: `${modalStore.quickActions.y}px` }"
    >
      <button
        type="button"
        class="flex h-full w-full cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-semibold hover:bg-[#cbd9c6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24352a]"
        @click="modalStore.close()"
      >
        <span aria-hidden="true">×</span>
        {{ tr('Modal.thoat') }}
      </button>
    </div>
  </Teleport>
</template>
