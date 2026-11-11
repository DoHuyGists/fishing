<script lang="ts" setup>
import { t as tr } from "../../../i18n";

import { useInventoryTableContext } from "./useInventoryTable.ts";

defineEmits<{ "request-buy": [] }>();

const {
  SLOTS,
  LABELS,
  inventoryStore,
  isActiveSlot,
  isDirty,
  itemName,
  pagedSets,
  removeFromSet,
  saveSet,
  savingId,
  setPage,
  setPages,
  setSearch,
  toggleActive,
  handleUpdateSetUsed,
} = useInventoryTableContext();
</script>

<template>
  <div id="user-equipment-sets" class="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-slate-50">
    <header class="space-y-3 border-b border-slate-200 bg-white p-4 lg:rounded-t-lg">
      <div class="flex items-center justify-between gap-2">
        <div class="text-lg font-semibold">
          {{ tr('EquipmentSets.set_trang_bi') }}
          <span class="text-sm font-normal text-slate-500">({{ inventoryStore.equipmentSets.length }})</span>
        </div>
        <button id="buy-set-button" type="button" class="rounded-md bg-teal-700 px-3 py-1.5 text-sm text-white hover:bg-teal-800"
          @click="$emit('request-buy')">
          {{ tr('EquipmentSets.mua_them_set') }}
        </button>
      </div>
      <input v-model="setSearch" type="search" :placeholder="tr('EquipmentSets.tim_theo_so_set_hoac_ten_vat_pham')"
        class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />
    </header>

    <div class="flex-1 space-y-4 overflow-y-scroll p-4">
      <div v-if="pagedSets.length === 0" class="py-12 text-center text-sm text-slate-500">
        {{
          inventoryStore.equipmentSets.length === 0
            ? tr('EquipmentSets.ban_chua_co_set_nao_bam_mua_them_set_de_bat_dau')
            : tr('EquipmentSets.khong_co_set_nao_khop_voi_tim_kiem')
        }}
      </div>

      <article v-for="{ set, index: setIndex } in pagedSets" :key="set.id"
        class="rounded-md border border-slate-200 bg-white p-3">
        <div class="mb-3 flex items-center justify-between">
          <div class="text-sm font-semibold">
            Set {{ setIndex + 1 }}
            <span v-if="isDirty(set)" class="ml-2 text-xs font-normal text-amber-600">{{ tr('EquipmentSets.chua_luu') }}</span>
          </div>
          <div class="select-none flex gap-2">
            <input type="radio" name="equipment-set" :checked="set.isUsed"
              @change="handleUpdateSetUsed($event, set.id)" class="cursor-pointer">
            <label for="" class="text-sm">
              {{ tr('EquipmentSets.su_dung') }}
            </label>
          </div>
          <button type="button" :disabled="!isDirty(set) || savingId === set.id"
            class="rounded-md bg-slate-800 px-3 py-1 text-sm text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            @click="saveSet(set)">
            {{ savingId === set.id ? tr('ChangePasswordModal.dang_luu') : tr('EquipmentSets.luu_set') }}
          </button>
        </div>

        <div class="grid grid-cols-2 gap-2 xl:grid-cols-5">
          <div v-for="(slot, slotIndex) in SLOTS" :key="slot" :class="[
            'min-w-0 cursor-pointer rounded-md border p-2 transition',
            isActiveSlot(set.id, slot)
              ? 'border-teal-600 bg-teal-50 ring-2 ring-teal-200'
              : 'border-slate-200 hover:border-slate-400',
          ]" @click="toggleActive(set.id, slot)">
            <button type="button" :id="`set-${setIndex}-slot-${slotIndex}`"
              class="mb-1 flex w-full items-center justify-between text-left text-xs font-medium text-slate-600"
              :aria-pressed="isActiveSlot(set.id, slot)" @click.stop="toggleActive(set.id, slot)">
              <span class="truncate">{{ LABELS[slot] }}</span>
              <span class="text-slate-400">{{ set[slot].length }}</span>
            </button>

            <div class="space-y-1">
              <div v-for="eq in set[slot]" :key="eq.id"
                class="flex items-center justify-between gap-1 rounded bg-slate-100 px-1.5 py-1 text-xs">
                <span class="truncate" :title="itemName(eq, eq.id)">{{ itemName(eq, eq.id) }}</span>
                <button type="button" class="shrink-0 rounded px-1 text-slate-500 hover:bg-red-100 hover:text-red-600"
                  :aria-label="tr('EquipmentSets.go_value0_khoi_set', { value0: itemName(eq, eq.id) })" @click.stop="removeFromSet(set, slot, eq)">
                  ✕
                </button>
              </div>
            </div>
            <div v-if="set[slot].length === 0" class="py-2 text-center text-xs text-slate-400">{{ tr('FlipBook.trong') }}</div>
          </div>
        </div>
      </article>
    </div>

    <footer v-if="setPages > 1"
      class="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 text-sm lg:rounded-b-lg">
      <button type="button" :disabled="setPage <= 1"
        class="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:opacity-40" @click="setPage--">
        {{ tr('Fishfarm.truoc') }}
      </button>
      <span class="text-slate-600">{{ tr('CaughtModal.trang') }} {{ setPage }} / {{ setPages }}</span>
      <button type="button" :disabled="setPage >= setPages"
        class="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:opacity-40" @click="setPage++">
        {{ tr('Fishfarm.sau') }}
      </button>
    </footer>
  </div>
</template>
