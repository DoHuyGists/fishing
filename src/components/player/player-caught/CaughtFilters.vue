<script setup lang="ts">
import { t as tr } from "../../../i18n";
import type { CaughtFish, CaughtFishFilters } from "../../../types/model/caughtFish";

const filters = defineModel<CaughtFishFilters>({ required: true });
defineProps<{
  rarities: string[];
  origins: NonNullable<CaughtFish["origin"]>[];
  active: boolean;
  invalidWeightRange: boolean;
}>();
defineEmits<{ reset: [] }>();

const inputClass = "w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
</script>

<template>
  <aside class="slide-fade-in from-bottom flex min-h-0 shrink-0 flex-col gap-3 rounded-xl border border-border bg-surface/50 p-3 max-md:max-h-[35vh] md:w-56 md:overflow-y-auto" :aria-label="tr('CaughtModal.filters')">
    <div class="flex items-center justify-between gap-2">
      <div class="text-sm font-bold">{{ tr("CaughtModal.filters") }}</div>
      <button type="button" class="cursor-pointer text-xs text-content underline disabled:opacity-40" :disabled="!active && filters.sort === 'newest'" @click="$emit('reset')">
        {{ tr("CaughtModal.reset_filters") }}
      </button>
    </div>
    <div class="grid min-h-0 grid-cols-2 gap-3 overflow-y-auto md:grid-cols-1 md:overflow-visible">
      <label class="col-span-2 flex flex-col gap-1 text-xs md:col-span-1">
        <span>{{ tr("CaughtModal.search") }}</span>
        <input v-model="filters.search" type="search" :class="inputClass" :placeholder="tr('CaughtModal.tim_theo_ten_ca')" />
      </label>
      <label class="flex flex-col gap-1 text-xs">
        <span>{{ tr("CaughtModal.rarity") }}</span>
        <select v-model="filters.rarity" :class="inputClass">
          <option value="ALL">{{ tr("Achievement.tat_ca") }}</option>
          <option v-for="rarity in rarities" :key="rarity" :value="rarity">{{ rarity }}</option>
        </select>
      </label>
      <label class="flex flex-col gap-1 text-xs">
        <span>{{ tr("CaughtModal.variant") }}</span>
        <select v-model="filters.variant" :class="inputClass">
          <option value="ALL">{{ tr("Achievement.tat_ca") }}</option>
          <option value="NORMAL">{{ tr("CaughtModal.variant_normal") }}</option>
          <option value="GOLDEN">{{ tr("CaughtModal.variant_golden") }}</option>
          <option value="MUTATED">{{ tr("CaughtModal.variant_mutated") }}</option>
        </select>
      </label>
      <label class="flex flex-col gap-1 text-xs">
        <span>{{ tr("CatchDialog.ca_xin") }}</span>
        <select v-model="filters.shiny" :class="inputClass">
          <option value="ALL">{{ tr("Achievement.tat_ca") }}</option>
          <option value="shiny">{{ tr("CaughtModal.shiny_only") }}</option>
          <option value="regular">{{ tr("CaughtModal.non_shiny") }}</option>
        </select>
      </label>
      <label class="flex flex-col gap-1 text-xs">
        <span>{{ tr("CaughtModal.min_stars") }}</span>
        <select v-model.number="filters.minStars" :class="inputClass">
          <option :value="0">{{ tr("Achievement.tat_ca") }}</option>
          <option v-for="stars in 5" :key="stars" :value="stars">{{ tr("CaughtModal.stars_at_least", { count: stars }) }}</option>
        </select>
      </label>
      <label class="col-span-2 flex flex-col gap-1 text-xs md:col-span-1">
        <span>{{ tr("CaughtModal.origin") }}</span>
        <select v-model="filters.origin" :class="inputClass">
          <option value="ALL">{{ tr("Achievement.tat_ca") }}</option>
          <option value="farm">{{ tr("CaughtModal.nguon_nuoi_tai_ao") }}</option>
          <option v-for="origin in origins" :key="origin.id" :value="origin.id">{{ origin.country }} - {{ origin.name }}</option>
        </select>
      </label>
      <div class="col-span-2 grid grid-cols-2 gap-2 md:col-span-1">
        <label class="flex min-w-0 flex-col gap-1 text-xs">
          <span>{{ tr("CaughtModal.min_weight") }}</span>
          <input v-model.number="filters.minWeight" type="number" min="0" step="any" :class="inputClass" :aria-invalid="invalidWeightRange" :aria-describedby="invalidWeightRange ? 'caught-weight-error' : undefined" />
        </label>
        <label class="flex min-w-0 flex-col gap-1 text-xs">
          <span>{{ tr("CaughtModal.max_weight") }}</span>
          <input v-model.number="filters.maxWeight" type="number" min="0" step="any" :class="inputClass" :aria-invalid="invalidWeightRange" :aria-describedby="invalidWeightRange ? 'caught-weight-error' : undefined" />
        </label>
        <span v-if="invalidWeightRange" id="caught-weight-error" role="alert" class="col-span-2 text-xs text-danger">{{ tr("CaughtModal.invalid_weight_range") }}</span>
      </div>
      <label class="col-span-2 flex flex-col gap-1 text-xs md:col-span-1">
        <span>{{ tr("CaughtModal.sort") }}</span>
        <select v-model="filters.sort" :class="inputClass">
          <option value="newest">{{ tr("CaughtModal.sort_newest") }}</option>
          <option value="oldest">{{ tr("CaughtModal.sort_oldest") }}</option>
          <option value="heaviest">{{ tr("CaughtModal.sort_heaviest") }}</option>
          <option value="lightest">{{ tr("CaughtModal.sort_lightest") }}</option>
          <option value="stars">{{ tr("CaughtModal.sort_stars") }}</option>
        </select>
      </label>
    </div>
  </aside>
</template>
