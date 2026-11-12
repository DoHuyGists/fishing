import type { DonationStatus } from "../types/model/donation";
import { defineStore } from 'pinia';
import { supabaseDonationRepository } from '../data/supabaseDonationRepository';
import { getFormattingLocale, t as tr } from '../i18n';
import { useInformationModalStore } from './informationModal';

interface Attempt { id: string; amountCents: number; orderId: string }
const storageKey = (userId: string) => `fishing.paypal-donation.${userId}`;

export const useDonationStore = defineStore('donation', {
  state: () => ({
    ownerId: '', amount: '', attempt: null as Attempt | null,
    status: '' as DonationStatus | '', busy: false, errorCode: '', cancelled: false,
    lastThankedDonationId: '',
  }),
  getters: {
    amountCents: (state): number => /^\d{1,4}(\.\d{1,2})?$/.test(state.amount.trim()) ? Math.round(Number(state.amount) * 100) : 0,
    validAmount(): boolean { return this.amountCents >= 100 && this.amountCents <= 100000; },
    settled: (state): boolean => ['COMPLETED', 'DECLINED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'REVERSED'].includes(state.status),
  },
  actions: {
    showThankYou() {
      if (this.status !== 'COMPLETED' || !this.attempt || this.lastThankedDonationId === this.attempt.id) return;
      const amount = new Intl.NumberFormat(getFormattingLocale(), {
        style: 'currency', currency: 'USD', currencyDisplay: 'code',
      }).format(this.attempt.amountCents / 100);
      useInformationModalStore().open({
        name: tr('donationPayment.thankYouTitle'),
        image: '/favicon.svg',
        description: tr('donationPayment.thankYouDescription', { amount }),
      });
      this.lastThankedDonationId = this.attempt.id;
    },
    bindUser(userId: string) {
      if (this.ownerId === userId) return;
      this.$reset();
      this.ownerId = userId;
      if (!userId) return;
      try {
        const value = JSON.parse(sessionStorage.getItem(storageKey(userId)) ?? 'null');
        if (value && typeof value.id === 'string' && Number.isInteger(value.amountCents) && typeof value.orderId === 'string') {
          this.attempt = value;
          this.amount = (value.amountCents / 100).toFixed(2);
        }
      } catch { /* Checkout still works when browser storage is unavailable. */ }
    },
    saveAttempt() {
      try {
        if (this.attempt) sessionStorage.setItem(storageKey(this.ownerId), JSON.stringify(this.attempt));
        else sessionStorage.removeItem(storageKey(this.ownerId));
      } catch { /* Storage is best effort; server idempotency remains authoritative. */ }
    },
    async createOrder(): Promise<{ orderId: string }> {
      if (!this.ownerId) throw new Error('AUTH_REQUIRED');
      if (!this.validAmount) throw new Error('INVALID_AMOUNT');
      if (!this.attempt) {
        this.attempt = { id: crypto.randomUUID(), amountCents: this.amountCents, orderId: '' };
        this.saveAttempt();
      }
      const owner = this.ownerId;
      const attempt = this.attempt;
      const result = await supabaseDonationRepository.request('create', attempt.id, attempt.amountCents);
      if (this.ownerId !== owner) throw new Error('AUTH_REQUIRED');
      this.attempt = { ...attempt, orderId: result.orderId };
      this.status = result.status;
      this.showThankYou();
      this.saveAttempt();
      return { orderId: result.orderId };
    },
    async verify(capture = false) {
      if (!this.attempt || !this.ownerId) return;
      const owner = this.ownerId;
      const id = this.attempt.id;
      this.busy = true;
      this.errorCode = '';
      this.cancelled = false;
      try {
        const result = await supabaseDonationRepository.request(capture ? 'capture' : 'status', id);
        if (this.ownerId !== owner || this.attempt?.id !== id) return;
        this.status = result.status;
        this.showThankYou();
        if (this.settled) {
          try { sessionStorage.removeItem(storageKey(owner)); } catch { /* Optional recovery storage. */ }
        }
      } catch (error) {
        if (this.ownerId === owner) this.errorCode = error instanceof Error ? error.message : 'PAYMENT_UNAVAILABLE';
      } finally { if (this.ownerId === owner) this.busy = false; }
    },
    resetAttempt() {
      if (this.busy || (!this.settled && this.status !== 'CREATED' && this.errorCode !== 'ATTEMPT_EXPIRED')) return;
      this.attempt = null;
      this.amount = '';
      this.status = '';
      this.errorCode = '';
      this.cancelled = false;
      this.saveAttempt();
    },
  },
});
