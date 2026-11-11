<script setup lang="ts">
import { t as tr } from "../../../i18n";

import Modal from "../../shared/Modal.vue";
import CurrencyConvertTable from "./CurrencyConvertTable.vue";
import RedeemCodeForm from "./RedeemCodeForm.vue";
import { useCurrencyStore } from "../../../stores/currency.ts";

const currencyStore = useCurrencyStore();

async function loadData() {
  await Promise.all([currencyStore.fetchConversionRates(), currencyStore.fetchCurrency()]);
}

</script>

<template>
  <Modal :title="tr('RedeemCodeModal.doi_ma_qua_tang')" :sub-title="tr('RedeemCodeModal.nhap_ma_de_nhan_phan_thuong')" :on-refresh="loadData">
    <div class="grid w-full grid-cols-1 items-start gap-2 text-[#24352a] lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
      <CurrencyConvertTable />
      <RedeemCodeForm />
    </div>
  </Modal>
</template>
