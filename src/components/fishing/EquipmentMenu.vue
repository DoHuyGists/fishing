<script setup lang="ts">
import { equipmentCategories } from "../../data/equipmentCatalog.ts";
import { useEquipmentStore } from "../../stores/equipment.ts";
import { useFishingStore, type FishingTool } from "../../stores/fishing.ts";
import SearchableDropdown from "./SearchableDropdown.vue";
import AdjusDepth from "./AdjusDepth.vue";

const store = useFishingStore();
const equipmentStore = useEquipmentStore();

function onVariantChange(category: FishingTool, variantId: string) {
  store.selectVariant(category, variantId);
}
</script>

<template>
  <div class="flex flex-wrap gap-2" aria-label="Dụng cụ câu cá">
    <div v-for="category in equipmentCategories" :key="category.id"
      class="flex items-center gap-2 px-2.5 py-[7px] rounded-xl border border-[#e4dfd4] bg-[#fffefa] cursor-pointer transition-[0.18s] ease-in-out"
      :class="{ 'border-[#5d9a5b] bg-[#eef8e9] shadow-[inset_0_0_0_1px_#b9dba7]': store.selectedTool === category.id }"
      @click="store.selectTool(category.id)">
      <span class="flex-none max-[620px]:w-[50px] text-[#345344] text-[11px] font-bold whitespace-nowrap">{{
        category.name
      }}</span>
      <SearchableDropdown :options="equipmentStore.variants[category.id]"
        :model-value="store.equipmentLoadout[category.id]"
        @update:model-value="(id) => onVariantChange(category.id, id)" />
    </div>
    <button type="button"
      class="flex items-center gap-2 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] px-3 py-2 text-[11px] font-bold text-[#24352a] transition hover:border-[#70a77e] hover:bg-[#eaf5e8]"
      @click="store.openDepthAdjuster()">
      <span aria-hidden="true" class="text-base text-[#398d80]">≋</span>
      Điều chỉnh độ sâu
    </button>
    <AdjusDepth />
  </div>
</template>
