<template>
  <section class="slide-fade-in from-right player-content-in flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#cbd9c6] bg-white text-[#24352a]" aria-labelledby="donation-payment-title">
    <div class="flex items-center gap-3 border-b border-[#cbd9c6] bg-[#edf3e7] px-5 py-4">
      <div class="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#cbd9c6] bg-white text-[#36513f]">
        <svg aria-hidden="true" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="3" />
          <path d="M2 10h20M6 15h3" />
        </svg>
      </div>
      <div id="donation-payment-title" role="heading" aria-level="2" class="min-w-0 flex-1 text-base font-bold sm:text-lg">{{ tr('donationPayment.title') }}</div>
      <span class="shrink-0 rounded-full border border-[#cbd9c6] bg-white px-2.5 py-1 text-xs font-semibold text-[#52634f]">USD</span>
    </div>
    <div class="flex min-w-0 flex-1 flex-col gap-4 p-5">
    <div class="text-sm leading-6 text-[#52634f]">{{ tr('donationPayment.description') }}</div>
    <div v-if="!configured" role="status" class="text-sm">{{ tr('donationPayment.unavailable') }}</div>
    <div v-else-if="!auth.isAuthenticated" role="status" class="text-sm">{{ tr('donationPayment.signIn') }}</div>
    <template v-else>
      <label for="donation-usd" class="block space-y-2 text-sm font-semibold">
        <span>{{ tr('donationPayment.amount') }}</span>
        <input id="donation-usd" v-model="donation.amount" type="text" inputmode="decimal" autocomplete="off"
          :disabled="donation.busy || !!donation.attempt" :aria-invalid="donation.amount.trim() !== '' && !donation.validAmount" aria-describedby="donation-amount-help"
          class="min-h-12 w-full rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] px-4 text-base font-semibold text-[#24352a] tabular-nums transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#36513f] disabled:opacity-60 aria-invalid:border-red-300" />
      </label>
      <div id="donation-amount-help" class="text-xs leading-5 text-[#52634f]">{{ tr('donationPayment.amountHelp') }}</div>
      <div v-if="loading" role="status" class="text-sm">{{ tr('donationPayment.loading') }}</div>
      <div v-if="donation.busy" role="status" class="text-sm">{{ tr('donationPayment.processing') }}</div>
      <div v-if="donation.status" role="status" aria-live="polite" class="rounded-xl border px-4 py-3 text-sm font-semibold leading-6"
        :class="donation.status === 'COMPLETED' ? 'border-[#cbd9c6] bg-[#edf3e7] text-[#24352a]' : 'border-[#cbd9c6] bg-[#f5f9f0] text-[#52634f]'">{{ tr(`donationPayment.status_${donation.status}`) }}</div>
      <div v-if="donation.cancelled" role="status" class="text-sm">{{ tr('donationPayment.cancelled') }}</div>
      <div v-if="errorKey" role="alert" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{{ tr(errorKey) }}</div>
      <div v-if="sdk && donation.validAmount && !donation.settled && !['APPROVED', 'PENDING'].includes(donation.status)" class="donation-payment-buttons grid min-w-0 gap-3"
        :class="{ 'pointer-events-none opacity-50': donation.busy }" :inert="donation.busy">
        <component :is="'paypal-button'" v-if="paypalEligible" type="pay" @click="startPayment('paypal', $event)" />
        <component :is="'paypal-basic-card-container'" v-if="cardEligible">
          <component :is="'paypal-basic-card-button'" @click="startPayment('card', $event)" />
        </component>
        <div v-if="!loading && !paypalEligible && !cardEligible" class="text-sm">{{ tr('donationPayment.ineligible') }}</div>
      </div>
      <div v-if="donation.attempt && !donation.busy && !donation.settled" class="space-y-3">
        <button type="button" class="min-h-11 w-full rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] px-4 py-3 text-sm font-semibold transition hover:bg-[#e6efdf] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24352a]" @click="donation.verify(true)">{{ tr('donationPayment.verify') }}</button>
      </div>
      <button v-if="donation.settled || donation.status === 'CREATED' || donation.errorCode === 'ATTEMPT_EXPIRED'" type="button"
        :disabled="donation.busy" class="min-h-11 w-full rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] px-4 py-3 text-sm font-semibold transition hover:bg-[#e6efdf] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24352a] disabled:opacity-50"
        @click="donation.resetAttempt()">{{ tr('donationPayment.newDonation') }}</button>
      <button v-if="sdkError" type="button" class="min-h-11 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] px-4 py-3 text-sm font-semibold transition hover:bg-[#e6efdf] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24352a]" @click="initialize()">{{ tr('donationPayment.retry') }}</button>
    </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { t as tr } from '../../../i18n';
import { useAuthStore } from '../../../stores/auth';
import { useDonationStore } from '../../../stores/donation';
import { loadPayPal, type PayPalInstance } from '../../../utils/paypalCheckout';

const auth = useAuthStore();
const donation = useDonationStore();
const configured = Boolean(import.meta.env.VITE_PAYPAL_CLIENT_ID?.trim()) && ['sandbox', 'live'].includes(import.meta.env.VITE_PAYPAL_ENVIRONMENT);
const sdk = shallowRef<PayPalInstance>();
const loading = ref(false);
const sdkError = ref(false);
const paypalEligible = ref(false);
const cardEligible = ref(false);
let disposed = false;
let eligibilityRequest = 0;
const errorKey = computed(() => {
  const code = donation.errorCode;
  if (code === 'FEATURE_DISABLED' || code === 'FEATURE_FLAGS_UNAVAILABLE') return 'FeatureAvailability.maintenance';
  if (code === 'INVALID_AMOUNT') return 'donationPayment.invalidAmount';
  if (code === 'AUTH_REQUIRED') return 'donationPayment.signIn';
  if (code === 'RATE_LIMITED') return 'donationPayment.rateLimited';
  if (code === 'ATTEMPT_EXPIRED') return 'donationPayment.expired';
  return code || sdkError.value ? 'donationPayment.error' : '';
});

async function eligibility() {
  const request = ++eligibilityRequest;
  paypalEligible.value = false;
  cardEligible.value = false;
  if (!sdk.value || !donation.validAmount) return;
  try {
    const methods = await sdk.value.findEligibleMethods({ currencyCode: 'USD', amount: (donation.amountCents / 100).toFixed(2) });
    if (disposed || request !== eligibilityRequest) return;
    paypalEligible.value = methods.isEligible('paypal');
    cardEligible.value = methods.isEligible('card');
  } catch { if (!disposed && request === eligibilityRequest) sdkError.value = true; }
}

async function initialize() {
  if (!configured || !auth.isAuthenticated || loading.value) return;
  loading.value = true;
  sdkError.value = false;
  try {
    const instance = await loadPayPal();
    if (disposed) return;
    sdk.value = instance;
    await eligibility();
  } catch { if (!disposed) sdkError.value = true; }
  finally { if (!disposed) loading.value = false; }
}

async function startPayment(method: 'paypal' | 'card', event: Event) {
  if (!sdk.value || donation.busy || donation.settled || !donation.validAmount) return;
  donation.busy = true;
  donation.errorCode = '';
  donation.cancelled = false;
  const owner = donation.ownerId;
  const options = {
    onApprove: async ({ orderId }: { orderId: string }) => {
      if (owner !== donation.ownerId || orderId !== donation.attempt?.orderId) throw new Error('PAYMENT_MISMATCH');
      await donation.verify(true);
      if (donation.errorCode) throw new Error(donation.errorCode);
    },
    onCancel: () => { if (owner === donation.ownerId) donation.cancelled = true; },
    onError: () => { if (owner === donation.ownerId && !donation.errorCode) donation.errorCode = 'PAYMENT_UNAVAILABLE'; },
  };
  try {
    const targetElement = event.currentTarget as HTMLElement;
    const session = method === 'card'
      ? await sdk.value.createPayPalGuestOneTimePaymentSession(options)
      : sdk.value.createPayPalOneTimePaymentSession(options);
    const order = donation.createOrder().catch(error => {
      if (owner === donation.ownerId) donation.errorCode = error instanceof Error ? error.message : 'PAYMENT_UNAVAILABLE';
      throw error;
    });
    await session.start({ presentationMode: 'auto', targetElement }, order);
  } catch (error) {
    if (owner === donation.ownerId && !donation.errorCode) donation.errorCode = error instanceof Error ? error.message : 'PAYMENT_UNAVAILABLE';
  } finally { if (owner === donation.ownerId) donation.busy = false; }
}

watch(() => auth.user?.id ?? '', async (userId) => {
  donation.bindUser(userId);
  if (userId) {
    if (donation.attempt?.orderId) await donation.verify();
    await initialize();
  }
}, { immediate: true });
watch(() => donation.amountCents, () => { void eligibility(); });
onBeforeUnmount(() => { disposed = true; ++eligibilityRequest; });
</script>

<style scoped>
.donation-payment-buttons :deep(paypal-button),
.donation-payment-buttons :deep(paypal-basic-card-container),
.donation-payment-buttons :deep(paypal-basic-card-button) {
  display: block;
  width: 100%;
  max-width: none;
  min-width: 0;
  --paypal-button-border-radius: 12px;
}
</style>
