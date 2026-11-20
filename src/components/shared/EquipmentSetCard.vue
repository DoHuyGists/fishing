<script setup lang="ts">
import { t as tr } from "../../i18n";

defineProps<{
  number: number;
  dirty: boolean;
  used: boolean;
  radioName: string;
  radioKey?: string;
  useDisabled?: boolean;
  saveDisabled?: boolean;
  saving?: boolean;
}>();
defineEmits<{ choose: [event: Event]; save: [] }>();
</script>

<template>
  <article class="shared-equipment-card slide-fade-in from-bottom player-content-in min-w-0 rounded-lg border border-border-default bg-white p-2" :class="{ 'shared-equipment-card--used': used }">
    <div class="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
      <div class="min-w-0 font-semibold">
        {{ tr("EquipmentSets.setNumber", { number }) }}
        <slot name="summary" />
        <span v-if="dirty" class="ml-2 font-normal text-gold">{{ tr("EquipmentSets.chua_luu") }}</span>
      </div>
      <label class="flex cursor-pointer items-center gap-1.5">
        <input :key="radioKey" type="radio" :name="radioName" :checked="used" :disabled="useDisabled" class="accent-accent" @change="$emit('choose', $event)" />
        {{ tr("EquipmentSets.su_dung") }}
      </label>
      <button type="button" :disabled="saveDisabled" class="ocean-primary-action rounded-md bg-content px-3 py-1 text-white hover:bg-content disabled:cursor-not-allowed disabled:opacity-40" @click="$emit('save')">
        {{ saving ? tr("ChangePasswordModal.dang_luu") : tr("EquipmentSets.luu_set") }}
      </button>
    </div>
    <slot />
  </article>
</template>

<style scoped>
.ocean-theme .shared-equipment-card {
  box-shadow: inset 0 1px color-mix(in srgb, var(--color-surface) 5.098%, transparent);
}

.ocean-theme .shared-equipment-card--used {
  border-color: var(--color-ocean-gold);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-gold) 14.902%, transparent), inset 0 1px color-mix(in srgb, var(--color-surface) 10.196%, transparent);
}

.ocean-theme .shared-equipment-card input[type="radio"] {
  accent-color: var(--color-ocean-gold);
}
</style>
