<script setup lang="ts">
import { t as tr } from "../../../i18n";
import { ref, watch } from "vue";
import { COUNTRY_UNLOCK_COST, useFishingMapStore } from "../../../stores/player-fishing-map-store";
import { useAuthStore } from "../../../stores/auth";
import { useCurrencyStore } from "../../../stores/player-currency-store";
import type { Country } from "../../../stores/player-country-store";
import PaymentConfirmation from "../../shared/PaymentConfirmation.vue";
const store = useFishingMapStore();
const auth = useAuthStore();
const currency = useCurrencyStore();
const purchaseCountry = ref<Country | null>(null);
watch(() => auth.sessionGeneration, () => { purchaseCountry.value = null; });

function openUnlock(country: Country) {
  if (!store.canUnlock(country.id) || store.unlockingCountryId) return;
  store.unlockError = "";
  purchaseCountry.value = country;
  void currency.fetchCurrency(true);
}

async function confirmUnlock() {
  const country = purchaseCountry.value;
  if (!country || currency.loading || currency.error || currency.shells < COUNTRY_UNLOCK_COST) return;
  if (await store.unlockCountry(country.id)) purchaseCountry.value = null;
}
</script>

<template>
  <aside class="flex min-h-0 min-w-0 shrink-0 flex-col rounded-xl border border-border-default bg-surface p-3 md:w-64 lg:w-72">
    <div class="mb-3 text-lg font-bold">{{ tr("FishingMapModal.countries") }}</div>
    <input
      v-model="store.countrySearch"
      type="search"
      class="mb-2 w-full shrink-0 rounded-lg border border-border-default bg-white px-3 py-2 text-sm"
      :aria-label="tr('FishingMapModal.countrySearch')"
      :placeholder="tr('FishingMapModal.countrySearch')"
    />
    <select
      v-model="store.countryFilter"
      class="mb-3 w-full shrink-0 rounded-lg border border-border-default bg-white px-3 py-2 text-sm"
      :aria-label="tr('FishingMapModal.countryFilter')"
    >
      <option value="all">{{ tr("FishingMapModal.allCountries") }}</option>
      <option value="unlocked">{{ tr("FishingMapModal.unlocked") }}</option>
      <option value="locked">{{ tr("FishingMapModal.locked") }}</option>
    </select>
    <nav
      :aria-label="tr('FishingMapModal.countries')"
      class="grid min-h-0 max-h-52 content-start gap-2 overflow-y-auto overscroll-contain md:max-h-none md:flex-1 md:pr-1"
    >
      <div
        v-for="country in store.countries"
        :key="country.id"
        class="rounded-lg border border-border-default"
      >
      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-content"
        :class="
          store.selectedCountryId === country.id && store.canView
            ? 'bg-surface font-bold'
            : 'bg-white enabled:hover:bg-surface'
        "
        :disabled="store.loading || !store.unlockedIds.has(country.id)"
        :aria-current="store.selectedCountryId === country.id && store.canView ? 'true' : undefined"
        @click="store.selectCountry(country.id)"
      >
        <span class="min-w-0 flex-1 break-words">{{ country.name }}</span>
        <span class="shrink-0 text-xs">{{
          tr(store.unlockedIds.has(country.id) ? "FishingMapModal.unlocked" : "FishingMapModal.locked")
        }}</span>
      </button>
      <button
        v-if="store.canUnlock(country.id)"
        type="button"
        class="ocean-primary-action mx-3 mb-3 rounded-lg bg-content px-3 py-2 text-sm font-bold text-white hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="Boolean(store.unlockingCountryId)"
        :aria-label="tr('FishingMapModal.unlockCountry', { country: country.name })"
        @click="openUnlock(country)"
      >
        {{ tr("FishingMapModal.unlockPrice", { price: COUNTRY_UNLOCK_COST }) }}
      </button>
      </div>
      <div v-if="!store.loading && !store.countries.length" role="status" class="py-4 text-center text-sm">
        {{ tr("FishingMapModal.noCountries") }}
      </div>
    </nav>
  </aside>
  <PaymentConfirmation
    v-if="purchaseCountry"
    :title="tr('FishingMapModal.unlockCountry', { country: purchaseCountry.name })"
    currency="shells"
    :balance="currency.shells"
    :total="COUNTRY_UNLOCK_COST"
    :busy="Boolean(store.unlockingCountryId)"
    :disabled="currency.loading || Boolean(currency.error) || !store.canUnlock(purchaseCountry.id)"
    :error="store.unlockError || currency.error"
    @cancel="purchaseCountry = null"
    @confirm="confirmUnlock"
  />
</template>
