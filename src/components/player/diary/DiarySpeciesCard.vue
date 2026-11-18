<script setup lang="ts">
import { computed, ref } from "vue";
import { getFormattingLocale, t as tr } from "../../../i18n";
import type { DiaryFishEntry } from "../../../stores/diary";
import RichTextContent from "../../shared/RichTextContent.vue";

const props = defineProps<{ entry: DiaryFishEntry }>();
const imageFailed = ref(false);
const caughtDate = computed(() => {
  if (!props.entry.caughtAt) return "";
  const date = new Date(props.entry.caughtAt);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(getFormattingLocale());
});
</script>

<template>
  <article class="min-w-0 self-start overflow-hidden rounded-xl border border-[#cbd9c6] bg-white">
    <div class="flex aspect-[16/9] items-center justify-center border-b border-[#cbd9c6] bg-[#edf3e7] p-4 sm:aspect-[3/1]">
      <img v-if="entry.species.image && !imageFailed" :src="entry.species.image" :alt="entry.species.name" loading="lazy" class="h-full w-full object-contain" @error="imageFailed = true" />
      <span v-else class="text-4xl" aria-hidden="true">🐟</span>
    </div>
    <div class="space-y-3 p-3 sm:p-4">
      <div class="break-words text-base font-bold">{{ entry.species.name }}</div>
      <div class="flex flex-wrap gap-2 text-xs">
        <span class="rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-2 py-1">
          {{ tr('CatchDiaryModal.rarity') }}: {{ entry.species.rarity || tr('FlipBook.da_cau') }}
        </span>
        <span v-if="caughtDate" class="rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-2 py-1">
          {{ tr('CatchDiaryModal.caughtOn', { value0: caughtDate }) }}
        </span>
      </div>
      <RichTextContent :content="entry.species.information || tr('FlipBook.chua_co_thong_tin_sinh_thai')" />
    </div>
  </article>
</template>
