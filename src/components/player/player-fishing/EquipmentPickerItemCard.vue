<script setup lang="ts">
import { computed } from "vue";
import type { EquipmentVariant } from "../../../types/model/equipment";
import { t as tr } from "../../../i18n";
import { equipmentItemStats } from "../../../data/equipmentItemStats";
import { useInformationModal } from "../../../composables/useInformationModal";

const props = defineProps<{
  variant: EquipmentVariant;
  category: string;
  readOnly: boolean;
  bait: boolean;
}>();
const emit = defineEmits<{ pick: [variant: EquipmentVariant] }>();
const { open } = useInformationModal();
const image = computed(() => props.variant.image ||
  (props.variant.icon.startsWith("/") || props.variant.icon.startsWith("http") ? props.variant.icon : undefined));

function showDetails() {
  open({
    name: props.variant.name,
    image: image.value,
    icon: props.variant.icon,
    description: props.variant.detail,
    itemDetails: {
      badges: [props.category, ...(props.variant.is_used ? [tr("EquipmentPickerModal.dang_dung")] : [])],
      stats: equipmentItemStats(props.variant),
      metadata: [],
    },
  });
}
</script>

<template>
  <div class="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-white"
    :class="variant.is_used ? 'border-accent ring-1 ring-accent' : 'border-border-default'">
    <button
      type="button"
      :disabled="readOnly"
      class="relative flex min-h-[150px] w-full flex-1 items-center gap-3 p-3 text-left transition hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-[-2px]"
      :class="{ 'bg-surface': variant.is_used }"
      :aria-pressed="variant.is_used === true"
      @click="emit('pick', variant)"
    >
      <span class="grid h-32 w-20 flex-none place-items-center overflow-hidden text-3xl">
        <img v-if="image" :src="image" :alt="variant.name" loading="lazy" class="h-32 w-20 max-h-full max-w-full rounded-md object-contain" />
        <template v-else>{{ variant.icon }}</template>
      </span>
      <span class="flex min-w-0 flex-1 flex-col gap-1 leading-tight">
        <span v-if="variant.is_used" class="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide">
          <span class="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-accent text-white">✓</span>
          {{ tr("EquipmentPickerModal.dang_dung") }}
        </span>
        <strong class="break-words text-xs font-bold">{{ variant.name }}</strong>
        <small class="line-clamp-2 text-[10px] text-content">{{ variant.detail }}</small>
        <small v-if="bait" class="text-[10px] font-semibold text-content">
          {{ tr("EquipmentPickerModal.so_luong") }} {{ variant.quantity ?? 0 }}
        </small>
      </span>
    </button>
    <button
      type="button"
      class="min-h-10 w-full border-t border-border-default px-3 py-2 text-xs font-semibold text-accent transition hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-[-2px]"
      :aria-label="`${tr('InventoryItemCard.xem_chi_tiet')}: ${variant.name}`"
      @click="showDetails"
    >
      {{ tr("InventoryItemCard.xem_chi_tiet") }}
    </button>
  </div>
</template>
