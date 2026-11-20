<script setup lang="ts">
import { t as tr } from "../../../i18n";
import { storeToRefs } from "pinia";
import { useBadgesStore } from "../../../stores/player-badges-store";

const badgesStore = useBadgesStore();
const { searchQuery, selectedType, badgeTypes } = storeToRefs(badgesStore);
</script>

<template>
  <div v-if="badgesStore.collectionTotal" class="mt-2 flex gap-2 sm:mt-3 sm:gap-3">
    <label class="relative min-w-0 flex-1">
      <span class="sr-only">{{ tr("Achievement.tim_huy_hieu") }}</span>
      <input
        v-model="searchQuery"
        type="search"
        :placeholder="tr('Achievement.tim_huy_hieu_2')"
        class="w-full rounded-lg border border-border-default bg-white px-2.5 py-2 text-xs text-content outline-none placeholder:text-gray-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-sm"
      />
    </label>
    <label class="w-[42%] sm:w-56">
      <span class="sr-only">{{ tr("Achievement.loc_theo_loai_huy_hieu") }}</span>
      <select
        v-model="selectedType"
        class="w-full rounded-lg border border-border-default bg-white px-2 py-2 text-xs text-content outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-sm"
      >
        <option value="all">{{ tr("Achievement.tat_ca_loai_huy_hieu") }}</option>
        <option v-for="type in badgeTypes" :key="type" :value="type">{{ type }}</option>
      </select>
    </label>
  </div>
</template>
