<script lang="ts" setup>
import { t as tr } from "../../../i18n";

import { computed, provide } from "vue";
import FishingEquipmentSets from "./fishing-equipment/FishingEquipmentSets.vue";
import FishingEquipmentOverview from "./fishing-equipment/FishingEquipmentOverview.vue";
import InventoryItems from "./InventoryItems.vue";
import Modal from "../../shared/Modal.vue";
import PaymentConfirmation from "../../shared/PaymentConfirmation.vue";
import { inventoryTableContextKey, useInventoryTable } from "./useInventoryTable.ts";
import Tab from "../../shared/Tab.vue";
import HealthPanel from "./body-equipment/HealthPanel.vue";
import type { InventoryTab } from "../../../types/model/inventory";
import { useModalStore } from "../../../stores/modal";

const { initialTab = "fishing", compact = false } = defineProps<{ initialTab?: InventoryTab; compact?: boolean }>();
const inventory = useInventoryTable(initialTab);
provide(inventoryTableContextKey, inventory);
const modalStore = useModalStore();

const { activeTab, busy, buySet, currencyStore, deleteSelected, load, loading, modal, selected, SET_PRICE } = inventory;
const tabs = computed(() => [
  { key: "fishing", label: tr("InventoryModal.fishingTab") },
  { key: "health", label: tr("InventoryModal.healthTab") },
]);

const guildeSteps = [
  {
    target: "#user-inventory",
    get title() {
      return tr("InventoryModal.tui_do");
    },
    get description() {
      return tr("InventoryModal.day_la_cac_vat_pham_ban_dang_o_huu");
    },
  },
  {
    target: "#user-equipment-sets",
    get title() {
      return tr("EquipmentSets.set_trang_bi");
    },
    get description() {
      return tr("InventoryModal.day_la_cac_set_trang_bi_ban_cai_dat_truoc_khi_cau");
    },
  },
  {
    target: "#set-0-slot-0",
    get title() {
      return tr("InventoryModal.slot_trang_bi");
    },
    get description() {
      return tr("InventoryModal.day_la_slot_trang_bi_moi_slot_se_chua_cac_vat_pham_cung_loai");
    },
  },
  {
    target: "#buy-set-button",
    get title() {
      return tr("InventoryModal.mua_them_set_trang_bi");
    },
    get description() {
      return tr("InventoryModal.co_the_mua_them_set_trang_bi");
    },
  },
];
</script>
<template>
  <Modal
    :title="tr('InventoryModal.trang_bi')"
    :guid-steps="activeTab === 'fishing' ? guildeSteps : []"
    :on-refresh="load"
    :compact="compact"
    :show-count-data="!compact"
    content-width-class="max-w-6xl"
    role="dialog"
    aria-modal="true"
    :aria-label="tr('InventoryModal.trang_bi')"
    @click.self="modalStore.close"
    @keydown.esc="modal ? (modal = null) : modalStore.close()"
  >
    <section class="h-full w-full text-slate-800">
      <div v-if="loading" class="py-24 text-center text-sm text-slate-500">
        {{ tr("InventoryModal.dang_tai_kho_do") }}
      </div>

      <div v-else class="grid min-w-0 grid-cols-1 items-start gap-3 lg:grid-cols-2">
        <InventoryItems @request-delete="modal = 'delete'" />
        <div class="min-w-0">
          <Tab v-model="activeTab" :tabs="tabs" :aria-label="tr('InventoryModal.trang_bi')">
            <template #fishing>
              <div class="space-y-2.5">
                <FishingEquipmentOverview />
                <FishingEquipmentSets @request-buy="modal = 'buy'" />
              </div>
            </template>
            <template #health><HealthPanel /></template>
          </Tab>
        </div>
      </div>

      <PaymentConfirmation
        v-if="modal === 'buy'"
        :title="tr('InventoryModal.mua_them_set_trang_bi')"
        :balance="currencyStore.cash"
        :total="SET_PRICE"
        :busy="busy"
        :confirm-text="tr('InventoryModal.mua')"
        @cancel="modal = null"
        @confirm="buySet"
      />
      <div
        v-if="modal === 'delete'"
        class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4"
        role="dialog"
        aria-modal="true"
        @click.self="modal = null"
        @keydown.esc="modal = null"
      >
        <div class="player-popup-in w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
          <div class="text-base font-semibold">
            {{ tr("InventoryModal.xoa") }} {{ selected.size }} {{ tr("InventoryModal.vat_pham") }}
          </div>
          <div class="mt-2 text-sm text-slate-600">
            {{ tr("InventoryModal.khong_the_xoa_vat_pham_dang_co_trong_set_hay_go_vat_pham_va_luu_") }}
          </div>

          <div class="mt-5 flex justify-end gap-2">
            <button
              type="button"
              class="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
              :disabled="busy"
              @click="modal = null"
            >
              {{ tr("AccountInfoModal.huy") }}
            </button>
            <button
              type="button"
              class="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              :disabled="busy"
              @click="deleteSelected"
            >
              {{ busy ? tr("InventoryModal.dang_xoa") : tr("InventoryModal.xoa") }}
            </button>
          </div>
        </div>
      </div>
    </section>
  </Modal>
</template>
