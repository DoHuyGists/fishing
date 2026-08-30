<script setup lang="ts">
import { equipmentCategories, equipmentVariants } from "../data/equipmentCatalog";
import { useFishingStore, type FishingTool } from "../stores/fishing";
import SearchableDropdown from "./SearchableDropdown.vue";

const store = useFishingStore();

function onVariantChange(category: FishingTool, variantId: string) {
  store.selectVariant(category, variantId);
}
</script>

<template>
  <div class="flex flex-wrap gap-2" aria-label="Dụng cụ câu cá">
    <div
      v-for="category in equipmentCategories"
      :key="category.id"
      class="flex items-center gap-2 px-2.5 py-[7px] rounded-xl border border-[#e4dfd4] bg-[#fffefa] cursor-pointer transition-[0.18s] ease-in-out"
      :class="{ 'border-[#5d9a5b] bg-[#eef8e9] shadow-[inset_0_0_0_1px_#b9dba7]': store.selectedTool === category.id }"
      @click="store.selectTool(category.id)"
    >
      <span class="flex-none text-[15px]">{{ category.icon }}</span>
      <span class="flex-none w-[62px] max-[620px]:w-[50px] text-[#345344] text-[11px] font-bold whitespace-nowrap">{{ category.name }}</span>
      <SearchableDropdown
        :options="equipmentVariants[category.id]"
        :model-value="store.equipmentLoadout[category.id]"
        @update:model-value="(id) => onVariantChange(category.id, id)"
      />
    </div>
  </div>
</template>
