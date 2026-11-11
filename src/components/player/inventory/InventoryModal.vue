<script lang="ts" setup>
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
    title: "Túi đồ",
    description: "Đây là các vật phẩm bạn đang ở hữu",
  },
  {
    target: "#user-equipment-sets",
    title: "Set trang bị",
    description: "Đây là các set trang bị bạn cài đặt trước khi câu",
  },
  {
    target: "#set-0-slot-0",
    title: "Slot trang bị",
    description: "Đây là slot trang bị, mỗi slot sẽ chứa các vật phẩm cùng loại.",
  },
  {
    target: "#buy-set-button",
    title: "Mua set",
    description: "Có thể mua thêm set trang bị",
  },
];
</script>
<template>
  <Modal title="Trang bị" :guid-steps="guildeSteps" :on-refresh="load">
    <section class="h-full w-full text-slate-800">
      <div v-if="loading" class="py-24 text-center text-sm text-slate-500">Đang tải kho đồ…</div>

      <div v-else class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <InventoryItems @request-delete="modal = 'delete'" />
        <EquipmentSets @request-buy="modal = 'buy'" />
      </div>

      <div v-if="modal" class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4" role="dialog"
        aria-modal="true" @click.self="modal = null" @keydown.esc="modal = null">
        <div class="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
          <template v-if="modal === 'buy'">
            <div class="text-base font-semibold">Mua thêm set trang bị?</div>
            <div class="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <span>Bạn sẽ thêm 1 set trang bị với giá:</span>
              <Cash :amount="SET_PRICE" />
            </div>
            <div class="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <span>Số dư hiện tại:</span>
              <Cash :amount="currencyStore.cash" />
            </div>
          </template>
          <template v-else>
            <div class="text-base font-semibold">Xóa {{ selected.size }} vật phẩm?</div>
            <div class="mt-2 text-sm text-slate-600">
              Không thể xóa vật phẩm đang có trong set. Hãy gỡ vật phẩm và lưu set trước khi xóa.
            </div>
          </template>

          <div class="mt-5 flex justify-end gap-2">
            <button type="button" class="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
              :disabled="busy" @click="modal = null">
              Hủy
            </button>
            <button v-if="modal === 'buy'" type="button"
              class="rounded-md bg-teal-700 px-3 py-1.5 text-sm text-white hover:bg-teal-800 disabled:opacity-50"
              :disabled="busy" @click="buySet">
              {{ busy ? "Đang xử lý…" : "Mua" }}
            </button>
            <button v-else type="button"
              class="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              :disabled="busy" @click="deleteSelected">
              {{ busy ? "Đang xóa…" : "Xóa" }}
            </button>
          </div>
        </div>
      </div>
    </section>
  </Modal>
</template>
