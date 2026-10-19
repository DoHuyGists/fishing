<script setup lang="ts">
import { computed, ref, watch } from "vue";
import BookCover, { type BookVariant } from "./BookCover.vue";

type Country = { code: string; name: string; information: string };
const props = defineProps<{ countries: Country[]; speciesCountByLocation: Record<string, number> }>();
const emit = defineEmits<{ selectCountry: [country: Country] }>();
const searchQuery = ref("");
const shelfPage = ref(0);
const shelfPageSize = 12;

const filteredCountries = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  return query
    ? props.countries.filter((country) => country.name.toLowerCase().includes(query) || country.code.toLowerCase().includes(query))
    : props.countries;
});
const totalShelfPages = computed(() => Math.max(1, Math.ceil(filteredCountries.value.length / shelfPageSize)));
const paginatedCountries = computed(() => filteredCountries.value.slice(shelfPage.value * shelfPageSize, (shelfPage.value + 1) * shelfPageSize));
watch(searchQuery, () => { shelfPage.value = 0; });

function getSpeciesCount(country: Country) {
  return props.speciesCountByLocation[country.code] || props.speciesCountByLocation[country.name.toUpperCase()] || 0;
}

function getBookVariant(countryCode: string, speciesCount: number): BookVariant {
  if (speciesCount >= 10) return "gold";
  if (speciesCount >= 5) return "emerald";
  if (speciesCount > 0) return "ocean";
  const hash = countryCode.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const variants: BookVariant[] = ["default", "dark", "ocean", "emerald", "gold"];
  return variants[hash % variants.length];
}
</script>

<template>
  <div class="flex-1 flex flex-col justify-between overflow-hidden">
    <div class="flex flex-wrap items-center justify-between gap-3 shrink-0">
      <div class="relative w-48 md:w-64">
        <input v-model="searchQuery" type="text" placeholder="🔍 Tìm quốc gia" class="w-full border border-amber-700/60 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-amber-400 shadow-inner" />
        <button v-if="searchQuery" type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold" @click="searchQuery = ''">✕</button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 py-2">
        <div v-for="country in paginatedCountries" :key="country.code" class="group relative select-none flex flex-col items-center justify-between p-3 rounded-2xl transition-all duration-300 cursor-pointer" @click="emit('selectCountry', country)">
          <div class="w-[140px] h-[190px] flex items-center justify-center overflow-hidden my-1">
            <BookCover :title="country.name" author="Nhật Ký Câu Cá" :num-up="country.code" :num-down="`${getSpeciesCount(country)} loài`" :variant="getBookVariant(country.code, getSpeciesCount(country))" :scale="0.33">
              <template #cover-icon><div class="absolute inset-0 flex flex-col items-center justify-center opacity-90 pointer-events-none"><span class="text-4xl drop-shadow-md">{{ country.code }}</span></div></template>
            </BookCover>
          </div>
          <div class="w-full text-center mt-2 pt-2 border-amber-800/40">
            <h3 class="m-0 text-xs md:text-sm font-serif font-bold truncate px-1">{{ country.name }}</h3>
            <span class="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full" :class="getSpeciesCount(country) > 0 ? 'bg-emerald-900/80 text-white border border-emerald-600/40' : 'bg-amber-950/60 text-amber-400/70 border border-amber-900/40'">{{ getSpeciesCount(country) }} loài cá</span>
          </div>
        </div>
      </div>
      <div v-if="paginatedCountries.length === 0" class="flex flex-col items-center justify-center p-12 text-amber-300/70">
        <span class="text-4xl mb-2">🔍</span><p class="font-serif text-base">Không tìm thấy quốc gia phù hợp với "{{ searchQuery }}"</p>
      </div>
    </div>

    <div class="mt-4 pt-2 border-t border-amber-900/40 flex items-center justify-between text-xs font-serif">
      <button type="button" class="px-3.5 py-1.5 rounded-lg bg-amber-900/80 hover:bg-amber-800 disabled:opacity-40 text-amber-100 font-bold transition-all cursor-pointer border border-amber-700/40" :disabled="shelfPage === 0" @click="shelfPage--">◀ Trang trước</button>
      <span class="text-amber-300 font-bold">{{ shelfPage + 1 }} / {{ totalShelfPages }}</span>
      <button type="button" class="px-3.5 py-1.5 rounded-lg bg-amber-900/80 hover:bg-amber-800 disabled:opacity-40 text-amber-100 font-bold transition-all cursor-pointer border border-amber-700/40" :disabled="shelfPage === totalShelfPages - 1" @click="shelfPage++">Trang sau ▶</button>
    </div>
  </div>
</template>
