<script setup lang="ts">
import { computed } from 'vue';
import { t as tr } from '../../../i18n';
import { useDispatchStore } from '../../../stores/dispatch';
import { useCurrencyStore } from '../../../stores/currency';
import PaymentConfirmation from '../../shared/PaymentConfirmation.vue';
import TwoOptionsModal from '../../shared/TwoOptionsModal.vue';
const store = useDispatchStore();
const currency = useCurrencyStore();
const title = computed(() => store.confirmation?.kind === 'buy' ? tr('Dispatch.buy')
  : store.confirmation?.kind === 'repeat' ? tr('Dispatch.repeat') : tr('Dispatch.start'));
</script>

<template>
  <PaymentConfirmation v-if="store.confirmation && ['buy','start','repeat'].includes(store.confirmation.kind)"
    :title="title" :currency="store.confirmation.kind === 'buy' ? 'shells' : 'cash'"
    :balance="store.confirmation.kind === 'buy' ? currency.shells : currency.cash + store.repeatCashReward"
    :balance-label="store.confirmation.kind === 'repeat' ? tr('Dispatch.repeatBalance') : undefined"
    :total="store.confirmationCost" :busy="store.busy" :disabled="store.needsRefresh || store.loading" :error="store.error"
    @confirm="store.confirm" @cancel="store.confirmation = null">
    <div class="text-sm">{{ store.confirmation.kind === 'buy' ? tr('Dispatch.buyHint') : store.confirmation.kind === 'repeat' ? tr('Dispatch.repeatHint') : tr('Dispatch.startHint') }}</div>
  </PaymentConfirmation>
  <TwoOptionsModal v-else-if="store.confirmation"
    :title="store.confirmation.kind === 'cancel' ? tr('Dispatch.cancel') : tr('Dispatch.finish')"
    :message="store.confirmation.kind === 'cancel' ? tr('Dispatch.cancelHint') : tr('Dispatch.finishHint')"
    :first-disabled="store.busy" :second-disabled="store.busy || store.loading || store.needsRefresh"
    :second-text="tr('Fishfarm.xac_nhan')" :on-first="() => { store.confirmation = null }" :on-second="store.confirm" />
</template>
