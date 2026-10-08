<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from "vue";
import { useToast, type ToastItem, type ToastPosition, type ToastVariant } from "../composables/useToast";

const { toasts, dismiss } = useToast();
const icons: Record<ToastVariant, string> = {
  success: "✓",
  error: "×",
  warning: "!",
  info: "i",
  neutral: "•",
};
const variantClasses: Record<ToastVariant, string> = {
  success: "border-l-green-600",
  error: "border-l-red-600",
  warning: "border-l-amber-600",
  info: "border-l-blue-600",
  neutral: "border-l-slate-500",
};
const variantTextClasses: Record<ToastVariant, string> = {
  success: "text-green-600",
  error: "text-red-600",
  warning: "text-amber-600",
  info: "text-blue-600",
  neutral: "text-slate-500",
};
const positionClasses: Record<ToastPosition, string> = {
  "top-left": "left-4 [left:max(1rem,env(safe-area-inset-left))] [top:max(1rem,env(safe-area-inset-top))]",
  top: "left-1/2 -translate-x-1/2 [top:max(1rem,env(safe-area-inset-top))]",
  "top-right": "right-4 [right:max(1rem,env(safe-area-inset-right))] [top:max(1rem,env(safe-area-inset-top))]",
  right: "right-4 top-1/2 -translate-y-1/2 [right:max(1rem,env(safe-area-inset-right))]",
  "bottom-right": "right-4 bottom-4 [right:max(1rem,env(safe-area-inset-right))] [bottom:max(1rem,env(safe-area-inset-bottom))]",
  bottom: "bottom-4 left-1/2 -translate-x-1/2 [bottom:max(1rem,env(safe-area-inset-bottom))]",
  "bottom-left": "left-4 bottom-4 [left:max(1rem,env(safe-area-inset-left))] [bottom:max(1rem,env(safe-area-inset-bottom))]",
  left: "left-4 top-1/2 -translate-y-1/2 [left:max(1rem,env(safe-area-inset-left))]",
};
const positions: ToastPosition[] = ["top-left", "top", "top-right", "right", "bottom-right", "bottom", "bottom-left", "left"];
const groupedToasts = computed(() => positions
  .map((position) => ({ position, items: toasts.value.filter((toast) => toast.position === position) }))
  .filter((group) => group.items.length > 0));

const liveMode = computed(() => toasts.value.some((toast) => toast.variant === "error") ? "assertive" : "polite");
const activeTimers = new Map<string, ReturnType<typeof setTimeout>>();

function startTimer(toast: ToastItem) {
  clearTimer(toast.id);
  if (toast.duration <= 0) return;
  activeTimers.set(toast.id, setTimeout(() => dismiss(toast.id), toast.duration));
}

function clearTimer(id: string) {
  const timer = activeTimers.get(id);
  if (timer) clearTimeout(timer);
  activeTimers.delete(id);
}

function runAction(toast: ToastItem) {
  toast.action?.onClick();
  if (toast.action?.dismissOnClick !== false) dismiss(toast.id);
}

watch(toasts, (current) => {
  const currentIds = new Set(current.map((toast) => toast.id));
  for (const id of activeTimers.keys()) if (!currentIds.has(id)) clearTimer(id);
  for (const toast of current) if (!activeTimers.has(toast.id)) startTimer(toast);
}, { immediate: true });
onBeforeUnmount(() => activeTimers.forEach(clearTimeout));
</script>

<template>
  <div aria-label="Thông báo" :aria-live="liveMode" aria-relevant="additions text">
    <div
      v-for="group in groupedToasts"
      :key="group.position"
      class="pointer-events-none fixed z-[10000] w-[min(25rem,calc(100vw-2rem))]"
      :class="positionClasses[group.position]"
    >
    <TransitionGroup
      tag="div"
      class="grid gap-3"
      enter-from-class="translate-x-4 opacity-0"
      enter-active-class="transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none"
      leave-from-class="opacity-100"
      leave-to-class="translate-x-4 opacity-0"
      leave-active-class="absolute right-0 left-0 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none"
      move-class="transition-transform duration-200 ease-out motion-reduce:transition-none"
    >
      <article
        v-for="toast in group.items"
        :key="toast.id"
        class="pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 border-l-4 bg-white px-4 py-3.5 text-slate-800 shadow-[0_12px_32px_rgba(15,23,42,0.16)] transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none"
        :class="variantClasses[toast.variant]"
        :role="toast.variant === 'error' ? 'alert' : 'status'"
        @mouseenter="clearTimer(toast.id)"
        @mouseleave="startTimer(toast)"
      >
        <span class="grid h-6 w-6 flex-none place-items-center rounded-full border-2 border-current font-extrabold leading-none" :class="variantTextClasses[toast.variant]" aria-hidden="true">{{ icons[toast.variant] }}</span>
        <div class="min-w-0 flex-1">
          <strong v-if="toast.title" class="mb-0.5 block text-sm">{{ toast.title }}</strong>
          <p class="m-0 break-words text-sm leading-snug text-slate-600">{{ toast.message }}</p>
          <button v-if="toast.action" class="mt-2 bg-transparent p-0 text-sm font-bold underline" :class="variantTextClasses[toast.variant]" type="button" @click="runAction(toast)">
            {{ toast.action.label }}
          </button>
        </div>
        <button
          v-if="toast.dismissible"
          class="flex-none bg-transparent px-1 text-2xl leading-none"
          :class="variantTextClasses[toast.variant]"
          type="button"
          :aria-label="`Đóng thông báo: ${toast.message}`"
          @click="dismiss(toast.id)"
        >
          <span aria-hidden="true">×</span>
        </button>
      </article>
    </TransitionGroup>
    </div>
  </div>
</template>
