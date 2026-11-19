<script setup lang="ts">
import { computed, ref } from "vue";
import { t as tr } from "../../../i18n";
import type { Country } from "../../../stores/player-country-store";
import { useDiaryStore } from "../../../stores/player-diary-store";

const props = defineProps<{ countries: Country[]; selectedCode: string }>();
const emit = defineEmits<{ select: [code: string] }>();
const diaryStore = useDiaryStore();
const searchQuery = ref("");
const filteredCountries = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase();
  return props.countries.filter(
    (country) => country.name.toLocaleLowerCase().includes(query) || country.code.toLocaleLowerCase().includes(query),
  );
});
</script>

<template>
  <nav
    class="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#cbd9c6] bg-[#f5f9f0]"
    :aria-label="tr('CatchDiaryModal.countries')"
  >
    <div class="border-b border-[#cbd9c6] p-2 sm:p-3">
      <div class="mb-3 text-sm font-bold">{{ tr("CatchDiaryModal.countries") }}</div>
      <input
        v-model="searchQuery"
        type="search"
        :aria-label="tr('BookShelf.tim_quoc_gia')"
        :placeholder="tr('BookShelf.tim_quoc_gia')"
        class="w-full min-w-0 rounded-lg border border-[#cbd9c6] bg-white px-2 py-2 text-xs outline-none focus:border-[#698563] focus:ring-2 focus:ring-[#cbd9c6] sm:text-sm"
      />
    </div>
    <div class="flex-1 space-y-1 overflow-y-auto p-1.5 sm:p-2">
      <button
        v-for="country in filteredCountries"
        :key="country.code"
        type="button"
        :aria-current="selectedCode === country.code ? 'true' : undefined"
        class="w-full cursor-pointer rounded-lg border p-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#698563] sm:p-3"
        :class="
          selectedCode === country.code
            ? 'border-[#cbd9c6] bg-[#e7ecda] shadow-sm'
            : 'border-transparent hover:border-[#cbd9c6] hover:bg-white'
        "
        @click="emit('select', country.code)"
      >
        <div class="break-words text-xs font-bold sm:text-sm">{{ country.name }}</div>
        <div class="mt-1 break-words text-[11px] text-[#52664e] sm:text-xs">
          {{
            tr("CatchDiaryModal.conqueredCount", {
              value0: diaryStore.caughtEntriesForCountry(country.code, country.name).length,
            })
          }}
        </div>
      </button>
      <div v-if="!filteredCountries.length" role="status" class="break-words px-2 py-6 text-center text-xs leading-5">
        {{ tr("CatchDiaryModal.noMatchingCountries") }}
      </div>
    </div>
  </nav>
</template>
