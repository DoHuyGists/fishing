<script lang="ts" setup>
import { t as tr } from "../../../../i18n/index.ts";
import EquipmentSetsPanel from "../../../shared/EquipmentSetsPanel.vue";
import EquipmentSetCard from "../../../shared/EquipmentSetCard.vue";

import { useInventoryTableContext } from "../useInventoryTable.ts";

defineEmits<{ "request-buy": [] }>();

const {
  SLOTS,
  LABELS,
  inventoryStore,
  equipmentStore,
  equipmentCapacity,
  isActiveSlot,
  isDirty,
  itemName,
  pagedSets,
  filteredSets,
  SETS_PER_PAGE,
  busy,
  loading,
  removeFromSet,
  saveSet,
  savingId,
  switchingId,
  setPage,
  setSearch,
  toggleActive,
  handleUpdateSetUsed,
} = useInventoryTableContext();
</script>

<template>
  <EquipmentSetsPanel
    id="user-equipment-sets"
    v-model:search="setSearch"
    :title="tr('EquipmentSets.fishingTitle')"
    :count="inventoryStore.equipmentSets.length"
    action-id="buy-set-button"
    :action-label="tr('EquipmentSets.mua_them_set')"
    :action-disabled="busy || loading"
    :empty="!pagedSets.length"
    :empty-text="inventoryStore.equipmentSets.length ? tr('EquipmentSets.khong_co_set_nao_khop_voi_tim_kiem') : tr('EquipmentSets.ban_chua_co_set_nao_bam_mua_them_set_de_bat_dau')"
    :page="setPage"
    :total="filteredSets.length"
    :page-size="SETS_PER_PAGE"
    :loading="busy || loading || !!savingId || !!switchingId"
    @action="$emit('request-buy')"
    @change-page="setPage = $event"
  >
      <EquipmentSetCard
        v-for="{ set, index: setIndex } in pagedSets"
        :key="set.id"
        :number="setIndex + 1"
        :dirty="isDirty(set)"
        :used="set.isUsed"
        radio-name="equipment-set"
        :radio-key="`${set.id}-${switchingId}`"
        :use-disabled="!!switchingId"
        :save-disabled="!isDirty(set) || savingId === set.id || equipmentStore.countSetItems(set) > equipmentCapacity"
        :saving="savingId === set.id"
        @choose="handleUpdateSetUsed($event, set.id)"
        @save="saveSet(set)"
      >
          <template #summary>
            <span
              class="ml-2 font-normal"
              :class="equipmentStore.countSetItems(set) >= equipmentCapacity ? 'text-amber-700' : 'text-[#526650]'"
            >
              {{
                tr("EquipmentSets.capacity_usage", {
                  count: equipmentStore.countSetItems(set),
                  capacity: equipmentCapacity,
                })
              }}
            </span>
          </template>

        <div
          v-if="equipmentStore.countSetItems(set) > equipmentCapacity"
          class="mb-2 text-xs text-amber-700"
          role="status"
        >
          {{ tr("EquipmentSets.capacity_reached", { capacity: equipmentCapacity }) }}
        </div>

        <div class="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          <div
            v-for="(slot, slotIndex) in SLOTS"
            :key="slot"
            :class="[
              'min-w-0 cursor-pointer rounded-md border p-1.5 transition',
              isActiveSlot(set.id, slot)
                ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600'
                : 'border-[#cbd9c6] hover:border-teal-500',
            ]"
            @click="toggleActive(set.id, slot)"
          >
            <button
              type="button"
              :id="`set-${setIndex}-slot-${slotIndex}`"
              class="mb-1 flex min-h-8 w-full items-center justify-between gap-1 text-left text-xs font-semibold disabled:opacity-40"
              :aria-label="tr('Health.selectSetSlot', { set: setIndex + 1, slot: LABELS[slot] })"
              :aria-pressed="isActiveSlot(set.id, slot)"
              @click.stop="toggleActive(set.id, slot)"
            >
              <span class="truncate">{{ LABELS[slot] }}</span>
              <span>{{ set[slot].length }}</span>
            </button>

              <div
                v-for="eq in set[slot]"
                :key="eq.id"
                class="mt-1 flex min-w-0 items-center justify-between gap-1 rounded bg-[#f5f9f0] p-1 text-xs"
              >
                <span class="truncate" :title="itemName(eq, eq.id)">{{ itemName(eq, eq.id) }}</span>
                <button
                  type="button"
                  class="shrink-0 rounded px-1 text-[#526650] hover:bg-rose-100 hover:text-rose-700 disabled:opacity-40"
                  :aria-label="tr('EquipmentSets.go_value0_khoi_set', { value0: itemName(eq, eq.id) })"
                  @click.stop="removeFromSet(set, slot, eq)"
                >
                  ×
                </button>
              </div>
            <div v-if="set[slot].length === 0" class="py-2 text-center text-xs text-[#526650]">
              {{ tr("FlipBook.trong") }}
            </div>
          </div>
        </div>
      </EquipmentSetCard>
  </EquipmentSetsPanel>
</template>
