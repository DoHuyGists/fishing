<script lang="ts" setup>
import { ref } from 'vue';
import FishingAreaManagement from './FishingAreaManagement.vue';
import SpeciesManagement from './SpeciesManagement.vue';
import SpeciesInAreaManagement from './SpeciesInAreaManagement.vue';

const showFishingAreaManagement = ref(false);
const showSpeciesManagement = ref(false);
const showSpeciesInAreaManagement = ref(false);
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-6">
    <h1 class="text-xl font-extrabold text-[#153221] mb-4">Quản trị</h1>

    <div class="flex flex-wrap gap-3">
      <button type="button"
        class="px-4 py-2 rounded-lg bg-[#153221] text-white text-sm font-bold hover:bg-emerald-800 transition-colors cursor-pointer"
        @click="showFishingAreaManagement = true">
        🗺️ Quản lý bãi câu
      </button>
      <button type="button"
        class="px-4 py-2 rounded-lg bg-[#153221] text-white text-sm font-bold hover:bg-emerald-800 transition-colors cursor-pointer"
        @click="showSpeciesManagement = true">
        🐟 Quản lý loài cá
      </button>
      <button type="button"
        class="px-4 py-2 rounded-lg bg-[#153221] text-white text-sm font-bold hover:bg-emerald-800 transition-colors cursor-pointer"
        @click="showSpeciesInAreaManagement = true">
        🎯 Quản lý cá theo bãi câu
      </button>
    </div>

    <FishingAreaManagement v-if="showFishingAreaManagement" @close="showFishingAreaManagement = false" />
    <SpeciesManagement v-if="showSpeciesManagement" @close="showSpeciesManagement = false" />
    <SpeciesInAreaManagement v-if="showSpeciesInAreaManagement" @close="showSpeciesInAreaManagement = false" />
  </div>
</template>
