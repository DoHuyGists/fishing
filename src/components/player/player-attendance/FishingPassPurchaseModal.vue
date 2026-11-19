<script setup lang="ts">
import { t as tr } from "../../../i18n";

import PaymentConfirmation from "../../shared/PaymentConfirmation.vue";
import { useCurrencyStore } from "../../../stores/currency";
import { useFishingPassStore } from "../../../stores/fishingPass";
import { useToast } from "../../../composables/useToast";

const emit = defineEmits<{ close: [] }>();
const currencyStore = useCurrencyStore();
const passStore = useFishingPassStore();
const toast = useToast();

async function buyFishingPass() {
  try {
    const purchased = await passStore.buyFishingPass();
    if (!purchased) return;
    emit("close");
    toast.success(tr('FishingPassPurchaseModal.mua_fishing_pass_thanh_cong'), { get title() { return tr('FishingPassPurchaseModal.giao_dich_thanh_cong'); } });
  } catch (err) {
    toast.error(err instanceof Error ? err.message : tr('FishingPassPurchaseModal.khong_the_mua_fishing_pass_vui_long_thu_lai'), { get title() { return tr('FishingPassPurchaseModal.mua_that_bai'); } });
  }
}
</script>

<template>
  <PaymentConfirmation
    :title="tr('FishingPassPurchaseModal.xac_nhan_mua_fishing_pass')"
    currency="shells"
    :balance="currencyStore.shells"
    :total="passStore.price"
    :balance-label="tr('FishingPassPurchaseModal.so_vo_so_hien_tai')"
    :total-label="tr('FishingPassPurchaseModal.so_vo_so_can_thanh_toan')"
    :remaining-label="tr('FishingPassPurchaseModal.so_vo_so_con_lai')"
    :confirm-text="tr('FishingPassPurchaseModal.xac_nhan_mua')"
    :busy="passStore.isBuying"
    :error="currencyStore.shells < passStore.price ? tr('FishingPassPurchaseModal.ban_khong_du_vo_so_de_mua_fishing_pass') : ''"
    @cancel="emit('close')"
    @confirm="buyFishingPass"
  >
    <div class="text-sm text-emerald-900/70">{{ tr('FishingPassPurchaseModal.mo_khoa_phan_thuong_fishing_pass') }}</div>
  </PaymentConfirmation>
</template>
