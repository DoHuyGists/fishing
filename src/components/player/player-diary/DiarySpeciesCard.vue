<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { getFormattingLocale, t as tr } from "../../../i18n";
import type { DiaryFishEntry } from "../../../types/model/diary";
import RichTextContent from "../../shared/RichTextContent.vue";
import { useDiaryStore } from "../../../stores/player-diary-store.ts";

const props = defineProps<{ entry: DiaryFishEntry; list?: boolean }>();
const imageFailed = ref(false);
const diaryStore = useDiaryStore();
watch(
  () => props.entry.species.image,
  () => {
    imageFailed.value = false;
  },
);
const format = (value: number | null | undefined, suffix = "") =>
  value == null
    ? tr("FishingMapModal.unknown")
    : `${value.toLocaleString(getFormattingLocale(), { maximumFractionDigits: 2 })}${suffix}`;
const stats = computed(() => {
  const fish = diaryStore.speciesDetails[props.entry.species.id] ?? props.entry.species;
  return [
    { key: "weight", value: `${format(fish.weight_min)} – ${format(fish.weight_max)} kg` },
    { key: "catchRate", value: format(fish.base_catch_rate == null ? null : fish.base_catch_rate * 100, "%") },
    { key: "experience", value: format(fish.experience_point) },
    { key: "strength", value: format(fish.strength) },
    { key: "alertness", value: format(fish.alertness) },
    { key: "burst", value: format(fish.burst_multiplier, "×") },
    { key: "activeTime", value: fish.active_time || tr("FishingMapModal.unknown") },
    { key: "habitat", value: fish.location || tr("FishingMapModal.unknown") },
    { key: "fishType", value: fish.fish_type || tr("FishingMapModal.unknown") },
  ];
});
const caughtDate = computed(() => {
  if (!props.entry.caughtAt) return "";
  const date = new Date(props.entry.caughtAt);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(getFormattingLocale());
});
</script>

<template>
  <article
    class="min-w-0 self-start overflow-hidden rounded-xl border border-border-default bg-white"
    :class="list ? 'sm:flex' : ''"
  >
    <div
      class="flex items-center justify-center border-border-default bg-palette-edf3e7 p-3"
      :class="list ? 'h-28 border-b sm:h-36 sm:w-40 sm:shrink-0 sm:border-b-0 sm:border-r' : 'aspect-[2/1] border-b'"
    >
      <span v-if="!entry.isCaught" class="flex flex-col items-center gap-2 text-center text-xs text-palette-52664e">
        <span aria-hidden="true" class="text-3xl">🔒</span>
        {{ tr("CatchDiaryModal.notConquered") }}
      </span>
      <img
        v-else-if="entry.species.image && !imageFailed"
        :src="entry.species.image"
        :alt="entry.species.name"
        loading="lazy"
        class="h-full w-full object-contain"
        @error="imageFailed = true"
      />
      <span v-else class="text-4xl" aria-hidden="true">🐟</span>
    </div>
    <div class="min-w-0 flex-1 space-y-3 p-3">
      <div class="break-words text-base font-bold">{{ entry.species.name }}</div>
      <div class="flex flex-wrap gap-2 text-xs">
        <span class="rounded-lg border border-border-default bg-surface px-2 py-1">
          {{ tr("CatchDiaryModal.rarity") }}: {{ entry.species.rarity || tr("FlipBook.da_cau") }}
        </span>
        <span v-if="caughtDate" class="rounded-lg border border-border-default bg-surface px-2 py-1">
          {{ tr("CatchDiaryModal.caughtOn", { value0: caughtDate }) }}
        </span>
      </div>
      <RichTextContent :content="entry.species.information || tr('FlipBook.chua_co_thong_tin_sinh_thai')" />
      <details
        class="group border-t border-border-default pt-2"
        @toggle="($event.target as HTMLDetailsElement).open && diaryStore.loadSpeciesDetails(entry.species.id)"
      >
        <summary
          class="cursor-pointer rounded text-sm font-semibold text-palette-52664e focus-visible:outline-2 focus-visible:outline-palette-698563"
        >
          {{ tr("CatchDiaryModal.speciesDetails") }}
        </summary>
        <div v-if="diaryStore.detailsLoading[entry.species.id]" role="status" class="py-3 text-xs">
          {{ tr("CatchDiaryModal.dang_tai_nhat_ky") }}
        </div>
        <div v-else-if="diaryStore.detailsErrors[entry.species.id]" role="alert" class="py-3 text-xs text-red-800">
          <div>{{ diaryStore.detailsErrors[entry.species.id] }}</div>
          <button type="button" class="mt-2 underline" @click="diaryStore.loadSpeciesDetails(entry.species.id)">
            {{ tr("Maintenance.thu_lai") }}
          </button>
        </div>
        <div v-else class="player-content-in mt-3 grid grid-cols-2 gap-2" :class="list ? 'lg:grid-cols-3' : ''">
          <div
            v-for="stat in stats"
            :key="stat.key"
            class="min-w-0 rounded-lg border border-border-default bg-surface p-2"
          >
            <div class="text-xs text-palette-52664e">{{ tr(`FishingMapModal.${stat.key}`) }}</div>
            <div class="mt-1 break-words text-sm font-semibold">{{ stat.value }}</div>
          </div>
        </div>
      </details>
    </div>
  </article>
</template>
