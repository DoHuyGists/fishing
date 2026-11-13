<script setup lang="ts">
import { t as tr } from '../../../i18n';
import { useHealthStore } from '../../../stores/health';
import HealthOverview from './HealthOverview.vue';
import HealthEquipmentSlots from './HealthEquipmentSlots.vue';

const store = useHealthStore();
</script>

<template>
  <div class="min-w-0 space-y-2.5 text-[#24352a]">
    <div v-if="store.error" role="alert" class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-rose-50 p-2 text-xs text-rose-800">
      <span>{{ store.error }}</span>
      <button type="button" :disabled="store.loading" class="min-h-8 rounded border border-rose-200 px-2 disabled:opacity-50" @click="store.loadInventory()">{{ tr('Modal.lam_moi') }}</button>
    </div>
    <HealthOverview />
    <HealthEquipmentSlots />
  </div>
</template>
