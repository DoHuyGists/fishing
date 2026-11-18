<script setup lang="ts">
import { t as tr } from "../../../i18n";
import type { CaughtFish } from "../../../stores/caught";

defineProps<{ fish: Pick<CaughtFish, "variant_type" | "star_rating" | "is_shiny"> }>();
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
    <span class="rounded border px-1.5 py-0.5" :class="fish.variant_type === 'GOLDEN' ? 'border-amber-300 bg-amber-50 text-amber-800' : fish.variant_type === 'MUTATED' ? 'border-purple-300 bg-purple-50 text-purple-800' : 'border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a]'">
      {{ fish.variant_type }}
    </span>
    <span v-if="fish.star_rating != null" class="text-amber-700" :aria-label="tr('CatchDialog.star_rating', { count: fish.star_rating })">
      {{ fish.star_rating }}<span aria-hidden="true"> ★</span>
    </span>
    <span v-if="fish.is_shiny" class="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-amber-800">
      {{ tr('CatchDialog.ca_xin') }}
    </span>
  </div>
</template>
