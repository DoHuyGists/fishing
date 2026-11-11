<script lang="ts" setup>
import { t as tr } from "../../../i18n";

import { provide } from "vue";
import EquipmentSets from "./EquipmentSets.vue";
import InventoryItems from "./InventoryItems.vue";
import Modal from "../../shared/Modal.vue";
import Cash from "../currency/Cash.vue";
import { inventoryTableContextKey, useInventoryTable } from "./useInventoryTable.ts";

const inventory = useInventoryTable();
provide(inventoryTableContextKey, inventory);

const { busy, buySet, currencyStore, deleteSelected, load, loading, modal, selected, SET_PRICE } = inventory;

const guildeSteps = [
  {
    target: "#user-inventory",
    get title() { return tr('InventoryModal.tui_do'); },
    get description() { return tr('InventoryModal.day_la_cac_vat_pham_ban_dang_o_huu'); },
  },
  {
    target: "#user-equipment-sets",
    get title() { return tr('EquipmentSets.set_trang_bi'); },
    get description() { return tr('InventoryModal.day_la_cac_set_trang_bi_ban_cai_dat_truoc_khi_cau'); },
  },
  {
    target: "#set-0-slot-0",
    get title() { return tr('InventoryModal.slot_trang_bi'); },
    get description() { return tr('InventoryModal.day_la_slot_trang_bi_moi_slot_se_chua_cac_vat_pham_cung_loai'); },
  },
  {
    target: "#buy-set-button",
    title: "Mua set",
    get description() { return tr('InventoryModal.co_the_mua_them_set_trang_bi'); },
  },
];
</script>
<template>
  <Modal :title="tr('InventoryModal.trang_bi')" :guid-steps="guildeSteps" :on-refresh="load">
    <section class="h-full w-full text-slate-800">
      <div v-if="loading" class="py-24 text-center text-sm text-slate-500">{{ tr('InventoryModal.dang_tai_kho_do') }}</div>

      <div v-else class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <InventoryItems @request-delete="modal = 'delete'" />
        <EquipmentSets @request-buy="modal = 'buy'" />
      </div>

      <div v-if="modal" class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4" role="dialog"
        aria-modal="true" @click.self="modal = null" @keydown.esc="modal = null">
        <div class="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
          <template v-if="modal === 'buy'">
            <div class="text-base font-semibold">{{ tr('InventoryModal.mua_them_set_trang_bi') }}</div>
            <div class="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <span>{{ tr('InventoryModal.ban_se_them_1_set_trang_bi_voi_gia') }}</span>
              <Cash :amount="SET_PRICE" />
            </div>
            <div class="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <span>{{ tr('FishSellConfirm.so_du_hien_tai') }}</span>
              <Cash :amount="currencyStore.cash" />
            </div>
          </template>
          <template v-else>
            <div class="text-base font-semibold">{{ tr('InventoryModal.xoa') }} {{ selected.size }} {{ tr('InventoryModal.vat_pham') }}</div>
            <div class="mt-2 text-sm text-slate-600">
              {{ tr('InventoryModal.khong_the_xoa_vat_pham_dang_co_trong_set_hay_go_vat_pham_va_luu_') }}
            </div>
          </template>

          <div class="mt-5 flex justify-end gap-2">
            <button type="button" class="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
              :disabled="busy" @click="modal = null">
              {{ tr('AccountInfoModal.huy') }}
            </button>
            <button v-if="modal === 'buy'" type="button"
              class="rounded-md bg-teal-700 px-3 py-1.5 text-sm text-white hover:bg-teal-800 disabled:opacity-50"
              :disabled="busy" @click="buySet">
              {{ busy ? tr('InventoryModal.dang_xu_ly') : tr('InventoryModal.mua') }}
            </button>
            <button v-else type="button"
              class="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              :disabled="busy" @click="deleteSelected">
              {{ busy ? tr('InventoryModal.dang_xoa') : tr('InventoryModal.xoa') }}
            </button>
          </div>
        </div>
      </div>
    </section>
  </Modal>
</template>
