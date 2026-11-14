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
  <article class="slide-fade-in from-bottom player-content-in min-w-0 rounded-lg border border-[#cbd9c6] bg-white p-2">
    <div class="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
      <div class="min-w-0 font-semibold">
        {{ tr("EquipmentSets.setNumber", { number }) }}
        <slot name="summary" />
        <span v-if="dirty" class="ml-2 font-normal text-amber-700">{{ tr("EquipmentSets.chua_luu") }}</span>
      </div>
      <label class="flex cursor-pointer items-center gap-1.5">
        <input :key="radioKey" type="radio" :name="radioName" :checked="used" :disabled="useDisabled" class="accent-teal-700" @change="$emit('choose', $event)" />
        {{ tr("EquipmentSets.su_dung") }}
      </label>
      <button type="button" :disabled="saveDisabled" class="rounded-md bg-slate-800 px-3 py-1 text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40" @click="$emit('save')">
        {{ saving ? tr("ChangePasswordModal.dang_luu") : tr("EquipmentSets.luu_set") }}
      </button>
    </div>
    <slot />
  </article>
</template>
