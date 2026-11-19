<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { healthSlots } from "../../../../data/healthEquipment.ts";
import { t as tr } from "../../../../i18n/index.ts";
import { useHealthStore } from "../../../../stores/health.ts";
import { useToast } from "../../../../composables/useToast.ts";
import type { BodyEquipmentSet, HealthSlot } from "../../../../types/model/health.ts";
import EquipmentSetsPanel from "../../../shared/EquipmentSetsPanel.vue";
import EquipmentSetCard from "../../../shared/EquipmentSetCard.vue";

const store = useHealthStore(),
  toast = useToast();
const search = ref(""),
  page = ref(1);
const name = (id: string) => store.ownedItems.find((item) => item.inventory.id === id)?.name ?? `#${id.slice(0, 6)}`;
const filtered = computed(() =>
  store.sets
    .map((set, index) => ({ set, index }))
    .filter(({ set, index }) => {
      const query = search.value.trim().toLowerCase();
      return (
        !query ||
        tr("EquipmentSets.setNumber", { number: index + 1 }).toLowerCase().includes(query) ||
        healthSlots.some((slot) => set[slot].some((item) => name(item.inventory_id).toLowerCase().includes(query)))
      );
    }),
);
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / 3)));
const visible = computed(() => filtered.value.slice((page.value - 1) * 3, page.value * 3));
watch(search, () => {
  page.value = 1;
});
watch(pages, (value) => {
  page.value = Math.min(page.value, value);
});
function select(set: BodyEquipmentSet, slot: HealthSlot) {
  const same = store.selectedSetId === set.id && store.selectedSlot === slot;
  store.selectedSetId = same ? "" : set.id;
  store.selectedSlot = same ? null : slot;
}
async function run(action: () => Promise<void>) {
  try {
    await action();
    toast.success(tr("useInventoryTable.cap_nhat_thanh_cong"));
  } catch (error) {
    toast.error((error as Error).message);
  }
}
</script>

<template>
  <EquipmentSetsPanel
    v-model:search="search"
    :title="tr('EquipmentSets.bodyTitle')"
    :count="store.sets.length"
    :action-label="tr('Health.addSet')"
    :action-disabled="store.busy || store.loading || !!store.error"
    :empty="!visible.length"
    :empty-text="store.sets.length ? tr('EquipmentSets.khong_co_set_nao_khop_voi_tim_kiem') : tr('Health.noSets')"
    :page="page"
    :total="filtered.length"
    :page-size="3"
    :loading="store.loading || store.busy"
    @action="run(() => store.createSet())"
    @change-page="page = $event"
  >
    <EquipmentSetCard
      v-for="{ set, index } in visible"
      :key="set.id"
      :number="index + 1"
      :dirty="store.isDirty(set)"
      :used="set.is_used"
      radio-name="body-equipment-set"
      :use-disabled="store.busy || store.loading || !!store.error"
      :save-disabled="!store.isDirty(set) || store.busy || store.loading || !!store.error"
      @choose="run(() => store.chooseSet(set.id))"
      @save="run(() => store.saveSet(set))"
    >
      <div class="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        <div
          v-for="slot in healthSlots"
          :key="slot"
          class="min-w-0 rounded-md border p-1.5 transition"
          :class="
            store.selectedSetId === set.id && store.selectedSlot === slot
              ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600'
              : 'border-[#cbd9c6] hover:border-teal-500'
          "
        >
          <button
            type="button"
            :disabled="store.busy || store.loading"
            class="mb-1 flex min-h-8 w-full items-center justify-between gap-1 text-left text-xs font-semibold disabled:opacity-40"
            :aria-label="tr('Health.selectSetSlot', { set: index + 1, slot: tr(`Health.slot_${slot}`) })"
            :aria-pressed="store.selectedSetId === set.id && store.selectedSlot === slot"
            @click="select(set, slot)"
          >
            <span>{{ tr(`Health.slot_${slot}`) }}</span
            ><span>{{ set[slot].length }}</span>
          </button>
          <div
            v-for="item in set[slot]"
            :key="item.inventory_id"
            class="mt-1 flex min-w-0 items-center justify-between gap-1 rounded bg-[#f5f9f0] p-1 text-xs"
          >
            <span class="truncate" :title="name(item.inventory_id)">{{ name(item.inventory_id) }}</span>
            <button
              type="button"
              :disabled="store.busy || store.loading"
              class="shrink-0 rounded px-1 text-[#526650] hover:bg-rose-100 hover:text-rose-700 disabled:opacity-40"
              :aria-label="tr('Health.unequipNamed', { item: name(item.inventory_id) })"
              @click="store.unequip(set, slot, item.inventory_id)"
            >
              ×
            </button>
          </div>
          <div v-if="!set[slot].length" class="py-2 text-center text-xs text-[#526650]">{{ tr("FlipBook.trong") }}</div>
        </div>
      </div>
    </EquipmentSetCard>
  </EquipmentSetsPanel>
</template>
