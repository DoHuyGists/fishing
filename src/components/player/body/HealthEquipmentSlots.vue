<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { healthSlots } from '../../../data/healthEquipment';
import { t as tr } from '../../../i18n';
import { useHealthStore } from '../../../stores/health';
import { useToast } from '../../../composables/useToast';
import type { BodyEquipmentSet, HealthSlot } from '../../../types/model/health';
import Pagination from '../../shared/Pagination.vue';

const store = useHealthStore(), toast = useToast();
const search = ref(''), page = ref(1);
const name = (id: string) => store.ownedItems.find(item => item.inventory.id === id)?.name ?? `#${id.slice(0, 6)}`;
const filtered = computed(() => store.sets.map((set, index) => ({ set, index })).filter(({ set, index }) => {
  const query = search.value.trim().toLowerCase();
  return !query || `set ${index + 1}`.includes(query) || healthSlots.some(slot => set[slot].some(item => name(item.inventory_id).toLowerCase().includes(query)));
}));
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / 3)));
const visible = computed(() => filtered.value.slice((page.value - 1) * 3, page.value * 3));
watch(search, () => { page.value = 1; });
watch(pages, value => { page.value = Math.min(page.value, value); });
function select(set: BodyEquipmentSet, slot: HealthSlot) {
  const same = store.selectedSetId === set.id && store.selectedSlot === slot;
  store.selectedSetId = same ? '' : set.id; store.selectedSlot = same ? null : slot;
}
async function run(action: () => Promise<void>) {
  try { await action(); toast.success(tr('useInventoryTable.cap_nhat_thanh_cong')); }
  catch (error) { toast.error((error as Error).message); }
}
</script>

<template>
  <section class="min-w-0 space-y-2 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-2" :aria-label="tr('Health.equipment')">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <span class="text-sm font-bold">{{ tr('Health.equipment') }} ({{ store.sets.length }})</span>
      <button type="button" :disabled="store.busy || store.loading || !!store.error" class="rounded bg-teal-700 px-3 py-1.5 text-xs text-white disabled:opacity-40" @click="run(() => store.createSet())">{{ tr('Health.addSet') }}</button>
    </div>
    <input v-model="search" type="search" :aria-label="tr('EquipmentSets.tim_theo_so_set_hoac_ten_vat_pham')" :placeholder="tr('EquipmentSets.tim_theo_so_set_hoac_ten_vat_pham')" class="w-full rounded border border-[#cbd9c6] bg-white px-2 py-1.5 text-xs" />
    <div v-if="!visible.length" class="py-6 text-center text-xs text-[#526650]">{{ tr('Health.noSets') }}</div>
    <article v-for="{ set, index } in visible" :key="set.id" class="min-w-0 rounded-lg border border-[#cbd9c6] bg-white p-2">
      <div class="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span class="font-semibold">Set {{ index + 1 }} <span v-if="store.isDirty(set)" class="font-normal text-amber-700">{{ tr('EquipmentSets.chua_luu') }}</span></span>
        <label class="flex items-center gap-1">
          <input type="radio" name="body-equipment-set" :checked="set.is_used" :disabled="store.busy || store.loading || !!store.error" @change="run(() => store.chooseSet(set.id))" />
          {{ tr('EquipmentSets.su_dung') }}
        </label>
        <button type="button" :disabled="!store.isDirty(set) || store.busy || store.loading || !!store.error" class="rounded bg-slate-800 px-3 py-1 text-white disabled:opacity-40" @click="run(() => store.saveSet(set))">{{ tr('EquipmentSets.luu_set') }}</button>
      </div>
      <div class="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        <div v-for="slot in healthSlots" :key="slot" class="min-w-0 rounded border p-1.5" :class="store.selectedSetId === set.id && store.selectedSlot === slot ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600' : 'border-[#cbd9c6]'">
          <button type="button" :disabled="store.busy || store.loading" class="mb-1 flex min-h-8 w-full items-center justify-between gap-1 text-left text-xs font-semibold" :aria-label="tr('Health.selectSetSlot', { set: index + 1, slot: tr(`Health.slot_${slot}`) })" :aria-pressed="store.selectedSetId === set.id && store.selectedSlot === slot" @click="select(set, slot)">
            <span>{{ tr(`Health.slot_${slot}`) }}</span><span>{{ set[slot].length }}</span>
          </button>
          <div v-for="item in set[slot]" :key="item.inventory_id" class="mt-1 flex min-w-0 items-center justify-between gap-1 rounded bg-slate-100 p-1 text-xs">
            <span class="truncate" :title="name(item.inventory_id)">{{ name(item.inventory_id) }}</span>
            <button type="button" :disabled="store.busy || store.loading" class="shrink-0 rounded px-1 hover:bg-rose-100" :aria-label="tr('Health.unequipNamed', { item: name(item.inventory_id) })" @click="store.unequip(set, slot, item.inventory_id)">×</button>
          </div>
          <div v-if="!set[slot].length" class="py-2 text-center text-xs text-[#526650]">{{ tr('FlipBook.trong') }}</div>
        </div>
      </div>
    </article>
    <Pagination :page="page" :total="filtered.length" :page-size="3" :loading="store.loading || store.busy" @change="page = $event" />
  </section>
</template>
