<script setup lang="ts">
import { computed } from "vue";
import { t as tr } from "../../i18n";
import type { FishingAreaRow } from "../../types/table/fishingArea";

const props = defineProps<{
  area: Pick<FishingAreaRow, "allowDepthTool" | "survivalMode">;
}>();

const mode = computed(() => {
  if (props.area.survivalMode) {
    return { key: "FishingMode.survival", icon: "🛡️", style: "border-danger/40 text-danger" };
  }
  if (props.area.allowDepthTool) {
    return { key: "FishingMode.depth", icon: "↧", style: "border-sky/40 text-sky" };
  }
  return { key: "FishingMode.random", icon: "🎲", style: "border-accent/40 text-accent" };
});
</script>

<template>
  <span
    class="inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full border bg-surface px-2 py-0.5 text-[11px] font-semibold leading-4"
    :class="mode.style"
    :aria-label="tr('FishingMode.label', { mode: tr(mode.key) })"
    :title="tr('FishingMode.label', { mode: tr(mode.key) })"
  >
    <span aria-hidden="true">{{ mode.icon }}</span>
    <span>{{ tr(mode.key) }}</span>
  </span>
</template>
