<script lang="ts" setup>
import type { CaughtFish } from "../../../types/model/caughtFish";
import type { PostProductionViewMode } from "../../../types/model/postProduction";
import { t as tr } from "../../../i18n/index";

defineProps<{
  fish: CaughtFish;
  selected: boolean;
  variant: PostProductionViewMode;
}>();
</script>

<template>
  <button
    type="button"
    class="flex gap-1 rounded-md border p-1 transition-colors"
    :class="[
      variant === 'grid'
        ? 'flex-col items-center text-center'
        : 'w-full items-center gap-2 text-left',
      selected
        ? variant === 'grid'
          ? 'border-accent bg-surface ring-2 ring-accent'
          : 'border-accent bg-surface'
        : variant === 'species'
          ? 'border-border bg-white hover:bg-surface'
          : 'border-border bg-white hover:bg-surface',
    ]"
  >
    <img
      :src="fish.species?.image || '/fish/VN/fish.jpg'"
      :alt="fish.species?.name || tr('CaughtModal.ca')"
      class="rounded object-cover"
      :class="variant === 'grid' ? 'w-full' : variant === 'species' ? 'h-9 w-12 shrink-0' : 'h-10 w-14 shrink-0'"
    />
    <span
      class="truncate font-bold"
      :class="variant === 'grid' ? 'w-full text-[11px]' : variant === 'species' ? 'grow text-xs' : 'grow text-sm'"
    >{{ fish.species?.name || (variant === 'species' ? tr('CaughtModal.ca') : '') }}</span>
    <span class="text-content" :class="variant === 'grid' ? 'text-[10px]' : 'text-xs'">{{ fish.weight }} kg</span>
  </button>
</template>
