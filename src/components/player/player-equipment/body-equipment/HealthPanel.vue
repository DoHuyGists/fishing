<script setup lang="ts">
import { t as tr } from "../../../../i18n/index.ts";
import { useHealthStore } from "../../../../stores/player-health-store.ts";
import HealthOverview from "./HealthOverview.vue";
import BodyEquipmentSets from "./BodyEquipmentSets.vue";

const store = useHealthStore();
</script>

<template>
  <div class="min-w-0 h-full flex flex-col space-y-2.5 text-content py-2">
    <div
      v-if="store.error"
      role="alert"
      class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface p-2 text-xs text-danger"
    >
      <span>{{ store.error }}</span>
      <button
        type="button"
        :disabled="store.loading"
        class="min-h-8 rounded border border-danger px-2 disabled:opacity-50"
        @click="store.loadInventory()"
      >
        {{ tr("Modal.lam_moi") }}
      </button>
    </div>
    <HealthOverview />
    <BodyEquipmentSets />
  </div>
</template>
