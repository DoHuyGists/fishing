<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, useTemplateRef } from "vue";
import type { CurrencyKind, PaymentCostLine } from "../../types/model/currency";
import { t as tr } from "../../i18n";
import Cash from "../player/currency/Cash.vue";
import Shells from "../player/currency/Shells.vue";
import Tickets from "../player/currency/Tickets.vue";

const props = withDefaults(defineProps<{
  title: string;
  balance: number;
  total: number;
  currency?: CurrencyKind;
  costs?: PaymentCostLine[];
  balanceLabel?: string;
  totalLabel?: string;
  remainingLabel?: string;
  confirmText?: string;
  busyText?: string;
  error?: string;
  busy?: boolean;
  disabled?: boolean;
  embedded?: boolean;
}>(), { currency: "cash", costs: () => [], busy: false, disabled: false, embedded: false });

const emit = defineEmits<{ cancel: []; confirm: [] }>();
const dialog = useTemplateRef<HTMLElement>('dialog');
let previousFocus: HTMLElement | null = null;
const currencies = { cash: Cash, shells: Shells, tickets: Tickets };
const validAmounts = computed(() => Number.isFinite(props.balance) && Number.isFinite(props.total) && props.total >= 0);
const insufficient = computed(() => validAmounts.value && props.balance < props.total);
const canConfirm = computed(() => validAmounts.value && !insufficient.value && !props.busy && !props.disabled);
const errorMessage = computed(() => props.error || (insufficient.value ? tr('PaymentConfirmation.insufficientBalance') : ''));

function cancel() {
  if (!props.busy) emit('cancel');
}

function confirm() {
  if (canConfirm.value) emit('confirm');
}

onMounted(() => {
  if (props.embedded) return;
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  dialog.value?.focus();
});

onBeforeUnmount(() => {
  if (previousFocus?.isConnected) previousFocus.focus();
});

function handleKeydown(event: KeyboardEvent) {
  if (props.embedded) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    cancel();
  } else if (event.key === 'Tab') {
    const controls = Array.from(dialog.value?.querySelectorAll<HTMLElement>(
      'button, input, select, textarea, a[href], [tabindex]',
    ) ?? []).filter(element => !element.matches(':disabled') && element.tabIndex >= 0 && element.getClientRects().length > 0);
    const first = controls[0];
    const last = controls[controls.length - 1];
    const active = document.activeElement;
    if (!first || (event.shiftKey ? active === first || active === dialog.value : active === last || active === dialog.value)) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    }
  }
}
</script>

<template>
  <Teleport to="body" :disabled="embedded">
  <section
    ref="dialog"
    :role="embedded ? undefined : 'dialog'"
    :aria-modal="embedded ? undefined : true"
    :tabindex="embedded ? undefined : -1"
    :aria-label="title"
    :aria-busy="busy"
    :class="embedded ? 'text-[#24352a]' : 'fixed inset-0 z-[10001] flex items-center justify-center overflow-y-auto bg-black/50 p-4 text-[#24352a] backdrop-blur-xs outline-none'"
    @keydown="handleKeydown"
    @click.self="!embedded && cancel()"
  >
    <form
      class="min-w-0 space-y-4"
      :class="embedded ? 'w-full' : 'player-popup-in my-auto w-full max-w-sm rounded-2xl border border-[#cbd9c6] bg-white p-5 shadow-xl'"
      @submit.prevent="confirm"
    >
      <div role="heading" aria-level="2" class="text-base font-extrabold">{{ title }}</div>
      <fieldset :disabled="busy" class="m-0 min-w-0 space-y-4 border-0 p-0">
        <slot />
      </fieldset>
      <div class="space-y-3 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-3 text-sm">
        <div class="flex items-center justify-between gap-3">
          <span>{{ balanceLabel || tr('FishSellConfirm.so_du_hien_tai') }}</span>
          <component :is="currencies[currency]" :amount="balance" :size="22" :interactive="false" class="shrink-0" />
        </div>
        <slot name="summary" />
        <div v-for="(cost, index) in costs" :key="index" class="flex items-center justify-between gap-3">
          <span>{{ cost.label }}</span>
          <component :is="currencies[currency]" :amount="cost.amount" :size="22" :interactive="false" class="shrink-0" />
        </div>
        <div class="flex items-center justify-between gap-3 border-t border-[#cbd9c6] pt-3 font-bold">
          <span>{{ totalLabel || tr('ShopModal.thanh_tien') }}</span>
          <component :is="currencies[currency]" :amount="total" :size="22" :interactive="false" class="shrink-0" />
        </div>
        <div v-if="remainingLabel" class="flex items-center justify-between gap-3">
          <span>{{ remainingLabel }}</span>
          <component :is="currencies[currency]" :amount="Math.max(0, balance - total)" :size="22" :interactive="false" class="shrink-0" />
        </div>
      </div>
      <slot name="after-summary" />
      <div v-if="errorMessage" role="alert" class="text-sm font-semibold text-red-700">{{ errorMessage }}</div>
      <div class="flex justify-end gap-2">
        <button v-if="!embedded" type="button" class="min-h-11 rounded-lg border border-[#cbd9c6] px-4 py-2 text-sm font-bold hover:bg-[#f5f9f0] focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50" :disabled="busy" @click="cancel">
          {{ tr('AccountInfoModal.huy') }}
        </button>
        <button type="submit" class="min-h-11 rounded-lg bg-[#24352a] px-4 py-2 text-sm font-bold text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50" :class="{ 'w-full': embedded }" :disabled="!canConfirm">
          {{ busy ? (busyText || tr('DailyAttendance.dang_xu_ly')) : (confirmText || tr('Fishfarm.xac_nhan')) }}
        </button>
      </div>
    </form>
  </section>
  </Teleport>
</template>
