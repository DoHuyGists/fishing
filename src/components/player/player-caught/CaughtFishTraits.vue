<script setup lang="ts">
import { t as tr } from "../../../i18n";
import type { CaughtFish } from "../../../types/model/caughtFish";

defineProps<{ fish: Pick<CaughtFish, "variant_type" | "star_rating" | "is_shiny"> }>();
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
    <span
      class="rounded border px-1.5 py-0.5"
      :class="
        fish.variant_type === 'GOLDEN'
          ? 'border-gold bg-surface text-gold'
          : fish.variant_type === 'MUTATED'
            ? 'border-special bg-surface text-special'
            : 'border-border-default bg-surface text-content'
      "
    >
      {{ fish.variant_type }}
    </span>
    <span
      v-if="fish.star_rating != null"
      class="text-gold"
      :aria-label="tr('CatchDialog.star_rating', { count: fish.star_rating })"
    >
      {{ fish.star_rating }}<span aria-hidden="true"> ★</span>
    </span>
    <span v-if="fish.is_shiny" class="rounded border border-gold bg-surface px-1.5 py-0.5 text-gold">
      {{ tr("CatchDialog.ca_xin") }}
    </span>
  </div>
</template>
