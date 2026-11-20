<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { getFormattingLocale, t as tr } from "../../../i18n";
import { useFishingMapStore } from "../../../stores/player-fishing-map-store.ts";
import RichTextContent from "../../shared/RichTextContent.vue";

const store = useFishingMapStore();
const dialog = ref<HTMLDialogElement | null>(null);
const fish = computed(() => store.selectedSpecies?.details);
const format = (value: number | null | undefined, suffix = "") =>
  value == null
    ? tr("FishingMapModal.unknown")
    : `${value.toLocaleString(getFormattingLocale(), { maximumFractionDigits: 2 })}${suffix}`;
const stats = computed(() => {
  const value = fish.value;
  return [
    { key: "weight", icon: "⚖", value: `${format(value?.weight_min)} – ${format(value?.weight_max)} kg` },
    {
      key: "catchRate",
      icon: "🎯",
      value: format(value?.base_catch_rate == null ? null : value.base_catch_rate * 100, "%"),
    },
    { key: "experience", icon: "⭐", value: format(value?.experience_point) },
    { key: "strength", icon: "💪", value: format(value?.strength) },
    { key: "alertness", icon: "👁", value: format(value?.alertness) },
    { key: "burst", icon: "⚡", value: format(value?.burst_multiplier, "×") },
  ];
});
function close() {
  store.selectedSpecies = null;
}
watch(
  [() => store.selectedSpecies, dialog],
  () => {
    if (store.selectedSpecies && dialog.value && !dialog.value.open) dialog.value.showModal();
    else if (!store.selectedSpecies) dialog.value?.close();
  },
  { flush: "post" },
);
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      aria-labelledby="map-species-title"
      class="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-border-default bg-surface p-0 text-content shadow-xl backdrop:bg-content/40"
      @cancel.prevent="close"
      @close="close"
      @click.self="close"
    >
      <div v-if="store.selectedSpecies" class="player-popup-in relative space-y-5 p-5 sm:p-6" @click.stop>
        <button
          type="button"
          autofocus
          :aria-label="tr('InformationModal.dong_thong_tin')"
          class="absolute right-2 top-2 flex size-9 items-center justify-center rounded-full text-2xl hover:bg-border-default/50"
          @click="close"
        >
          ×
        </button>
        <div class="flex items-center gap-4 pr-7">
          <img
            v-if="store.selectedSpecies.speciesImage"
            :src="store.selectedSpecies.speciesImage"
            alt=""
            class="size-20 shrink-0 object-contain"
          />
          <div id="map-species-title" class="break-words text-xl font-bold">
            {{ store.selectedSpecies.speciesName }}
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div
            v-for="stat in stats"
            :key="stat.key"
            class="flex flex-col items-center justify-center gap-1 rounded-xl border border-border-default bg-white p-3 text-center"
          >
            <span aria-hidden="true" class="text-xl">{{ stat.icon }}</span>
            <span class="text-xs text-content">{{ tr(`FishingMapModal.${stat.key}`) }}</span>
            <span class="text-sm font-bold">{{ stat.value }}</span>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div
            v-for="detail in [
              { key: 'rarity', value: fish?.rarity },
              { key: 'activeTime', value: fish?.active_time },
              { key: 'habitat', value: fish?.location },
              { key: 'fishType', value: fish?.fish_type },
            ]"
            :key="detail.key"
            class="min-w-0 rounded-lg border border-border-default p-3"
          >
            <div class="text-xs text-content">{{ tr(`FishingMapModal.${detail.key}`) }}</div>
            <div class="mt-1 break-words font-semibold">{{ detail.value || tr("FishingMapModal.unknown") }}</div>
          </div>
        </div>
        <RichTextContent v-if="fish?.information" :content="fish.information" />
      </div>
    </dialog>
  </Teleport>
</template>
