<script setup lang="ts">
import { computed } from "vue";
import { t as tr } from "../../../i18n/index.ts";
import { healthSlots } from "../../../data/healthEquipment.ts";
import { useHealthStore } from "../../../stores/player-health-store.ts";
import { useModalStore } from "../../../stores/player-modal-store.ts";
import { useToast } from "../../../composables/useToast.ts";
import type { BodyEquipmentSet } from "../../../types/model/health.ts";

const store = useHealthStore();
const modalStore = useModalStore();
const toast = useToast();
// Show persisted equipment, matching the set that actually contributes bonuses.
const usedSet = computed(() => store.savedSets.find((set) => set.is_used));
const usedSetIndex = computed(() => store.savedSets.findIndex((set) => set.id === usedSet.value?.id));
const itemsById = computed(() => new Map(store.ownedItems.map((item) => [item.inventory.id, item])));
const itemName = (id: string) => itemsById.value.get(id)?.name ?? `#${id.slice(0, 6)}`;
const countItems = (set: BodyEquipmentSet) => healthSlots.reduce((total, slot) => total + set[slot].length, 0);

async function switchSet(set: BodyEquipmentSet) {
  if (set.is_used || store.busy || store.loading || store.error) return;
  try {
    await store.chooseSet(set.id);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : tr("PrepareModal.khong_the_doi_set_trang_bi"));
  }
}
</script>

<template>
  <section
    :aria-label="tr('EquipmentSets.bodyTitle')"
    class="slide-fade-in from-left player-content-in flex shrink-0 flex-col gap-1.5 rounded-lg border border-border-default bg-surface-hover p-2 text-content shadow-sm"
    :aria-busy="store.loading || store.busy"
  >
    <header class="flex flex-wrap items-center justify-between gap-2 border-b border-border-default pb-1.5">
      <div class="flex items-center gap-2.5">
        <span class="h-2.5 w-2.5 shrink-0 rounded-full bg-content-disabled"></span>
        <div>
          <div class="text-[15px] font-bold leading-snug tracking-tight">{{ tr("EquipmentSets.bodyTitle") }}</div>
          <div class="mt-0.5 text-xs leading-normal text-content-subtle">{{ tr("PrepareModal.body_sets_hint") }}</div>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span
          v-if="usedSet"
          class="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-selected px-3 py-1 text-xs font-semibold text-content-secondary"
        >
          {{ tr("PrepareModal.dang_dung_set") }} {{ usedSetIndex + 1 }}
        </span>
        <button
          type="button"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-border-default bg-surface px-3 py-1.5 text-xs font-semibold text-content cursor-pointer transition-all duration-150 hover:bg-surface active:scale-95"
          @click="modalStore.open('body')"
        >
          <span aria-hidden="true">🎒</span>
          {{ tr("InventoryModal.kho_do") }}
        </button>
      </div>
    </header>

    <div v-if="store.loading" class="flex items-center justify-center gap-2 p-4 text-sm text-content-subtle" role="status">
      <span class="h-5 w-5 animate-spin rounded-full border-2 border-border-default border-t-content"></span>
      {{ tr("PrepareModal.dang_tai_trang_bi") }}
    </div>
    <div v-else-if="store.error" class="p-4 text-center text-sm" role="alert">
      <div class="text-danger">{{ store.error }}</div>
      <button
        type="button"
        class="mt-2 rounded-lg border border-border-default bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-white"
        :disabled="store.busy"
        @click="store.loadInventory()"
      >
        {{ tr("Maintenance.thu_lai") }}
      </button>
    </div>
    <template v-else>
      <div v-if="store.savedSets.length" class="flex flex-wrap gap-1.5">
        <button
          v-for="(set, index) in store.savedSets"
          :key="set.id"
          type="button"
          class="group flex flex-col items-start gap-0.5 rounded-lg border px-2.5 py-1 transition-all duration-150 disabled:cursor-not-allowed"
          :class="
            set.is_used
              ? 'cursor-default border-content-disabled bg-surface-selected shadow-sm'
              : 'border-border-default bg-surface text-content hover:border-content-disabled hover:bg-white'
          "
          :disabled="store.busy"
          :aria-pressed="set.is_used"
          @click="switchSet(set)"
        >
          <span class="flex items-center gap-1.5">
            <span class="text-[13px] font-bold">{{ tr("EquipmentSets.setNumber", { number: index + 1 }) }}</span>
            <span class="rounded-full bg-surface-hover px-1.5 py-px text-[10px] font-semibold text-content">
              {{ set.is_used ? tr("EquipmentPickerModal.dang_dung") : tr("PrepareModal.doi_sang_set_nay") }}
            </span>
          </span>
          <span class="text-[11px] text-content-subtle">{{ countItems(set) }} {{ tr("ListItems.vat_pham") }}</span>
        </button>
      </div>
      <div v-else class="rounded-xl border border-border-default bg-surface p-6 text-center text-[13px] text-content-subtle">
        {{ tr("PrepareModal.body_sets_empty") }}
      </div>

      <div v-if="usedSet" class="grid grid-cols-2 gap-1.5 md:grid-cols-3 xl:grid-cols-6">
        <div
          v-for="slot in healthSlots"
          :key="slot"
          class="min-h-[88px] overflow-hidden rounded-md border border-border-default bg-surface"
        >
          <div class="flex items-center justify-between gap-1 border-b border-border-default bg-surface-hover px-1.5 py-1">
            <span class="text-xs font-semibold">{{ tr(`Health.slot_${slot}`) }}</span>
            <span class="text-[11px] text-content-subtle">{{ usedSet[slot].length }} {{ tr("PrepareModal.mon") }}</span>
          </div>
          <div class="flex max-h-[120px] flex-col gap-1 overflow-y-auto p-1">
            <div
              v-for="item in usedSet[slot]"
              :key="item.inventory_id"
              class="flex items-center gap-1 rounded border border-content-disabled bg-surface-selected p-1"
            >
              <div class="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded bg-surface-hover">
                <img
                  v-if="itemsById.get(item.inventory_id)?.image"
                  :src="itemsById.get(item.inventory_id)?.image"
                  :alt="itemName(item.inventory_id)"
                  class="h-5 w-5 object-contain"
                  loading="lazy"
                />
                <span v-else class="text-lg">{{ itemsById.get(item.inventory_id)?.icon }}</span>
              </div>
              <span class="min-w-0 flex-1 truncate text-xs font-semibold" :title="itemName(item.inventory_id)">
                {{ itemName(item.inventory_id) }}
              </span>
              <span class="shrink-0 text-[9px] font-bold text-content-secondary">{{ tr("Health.equipped") }}</span>
            </div>
            <div v-if="!usedSet[slot].length" class="px-2 py-6 text-center text-[11px] italic text-content-subtle">
              {{ tr("Health.emptySlot") }}
            </div>
          </div>
        </div>
      </div>
      <div v-else-if="store.savedSets.length" class="p-4 text-center text-sm text-content-subtle">
        {{ tr("PrepareModal.chua_chon_set_trang_bi_nao") }}
      </div>
    </template>
  </section>
</template>
