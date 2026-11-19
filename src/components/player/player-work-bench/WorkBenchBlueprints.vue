<script lang="ts" setup>
import type { Blueprint } from "../../../types/model/blueprint";
import type { Item } from "../../../types/model/item";
import { t as tr } from "../../../i18n";



defineProps<{
  blueprints: Blueprint[];
  itemsById: Record<string, Item>;
  loading: boolean;
  selectedBlueprintId: string | null;
}>();
const emit = defineEmits<{
  select: [blueprint: Blueprint];
}>();
</script>

<template>
  <aside id="workbench-blueprints" class="slide-fade-in from-bottom player-content-in flex min-h-0 flex-col rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] p-3">
    <div class="mb-3 text-sm font-bold">{{ tr('WorkBenchModal.ban_ve') }}</div>
    <div v-if="loading" class="py-4 text-center text-xs opacity-60">{{ tr('WorkBenchModal.dang_tai_ban_ve') }}</div>
    <div v-else class="flex max-h-[min(65vh,44rem)] flex-col gap-2 overflow-y-auto lg:min-h-0 lg:max-h-none lg:flex-1">
      <div v-for="blueprint in blueprints" :key="blueprint.id">
        <button type="button" class="flex w-full items-center gap-2 rounded-md border p-2 text-left transition" :class="selectedBlueprintId === blueprint.id ? 'border-emerald-700 bg-emerald-100' : 'border-[#cbd9c6] bg-white hover:bg-[#e7ecda]'" @click="emit('select', blueprint)">
          <span class="grid size-11 shrink-0 place-items-center overflow-hidden rounded bg-[#f5f9f0] text-lg">
            <img v-if="itemsById[blueprint.resultItemId]?.image" :src="itemsById[blueprint.resultItemId]?.image ?? undefined" :alt="itemsById[blueprint.resultItemId]?.name ?? ''" class="h-full w-full object-contain p-1" />
            <span v-else>{{ itemsById[blueprint.resultItemId]?.icon || "?" }}</span>
          </span>
          <span class="min-w-0 truncate text-xs font-bold">{{ itemsById[blueprint.resultItemId]?.name ?? tr('WorkBenchModal.ban_ve') }}</span>
        </button>
      </div>
      <div v-if="!blueprints.length" class="py-4 text-center text-xs opacity-60">{{ tr('WorkBenchModal.chua_co_ban_ve') }}</div>
    </div>
  </aside>
</template>
