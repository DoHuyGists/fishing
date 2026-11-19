<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { t as tr } from "../../../i18n";
import { useAuthStore } from "../../../stores/auth.ts";
import { useUserProfileStore } from "../../../stores/userProfile.ts";
import { useCountryStore } from "../../../stores/player-country-store.ts";
import { useToast } from "../../../composables/useToast";
import TwoOptionsModal from "../../shared/TwoOptionsModal.vue";

const emit = defineEmits<{ close: [] }>();
const authStore = useAuthStore();
const userProfileStore = useUserProfileStore();
const countryStore = useCountryStore();
const toast = useToast();
const selectedCountryId = ref(userProfileStore.profile?.country_id ?? "");
const countrySearch = ref("");
const isUpdatingCountry = ref(false);
const countryError = ref("");
const now = ref(Date.now());
const clock = window.setInterval(() => {
  now.value = Date.now();
}, 60_000);
onUnmounted(() => window.clearInterval(clock));

const countryCooldownDaysRemaining = computed(() => {
  const cooldown = userProfileStore.profile?.update_country_cooldown;
  if (!cooldown) return 0;
  const remainingMs = new Date(cooldown).getTime() - now.value;
  return Number.isFinite(remainingMs) && remainingMs > 0 ? Math.ceil(remainingMs / (24 * 60 * 60 * 1000)) : 0;
});
const canChangeCountry = computed(
  () => !userProfileStore.profile?.country_id || countryCooldownDaysRemaining.value === 0,
);
const currentCountry = computed(() =>
  countryStore.countries.find((country) => country.id === userProfileStore.profile?.country_id),
);
const filteredCountries = computed(() => {
  const query = countrySearch.value.trim().toLocaleLowerCase();
  return query
    ? countryStore.countries.filter((country) => country.name.toLocaleLowerCase().includes(query))
    : countryStore.countries;
});

onMounted(() => countryStore.fetchCountries());

async function updateCountry() {
  const userId = authStore.user?.id;
  if (
    !userId ||
    !selectedCountryId.value ||
    selectedCountryId.value === userProfileStore.profile?.country_id ||
    !canChangeCountry.value ||
    isUpdatingCountry.value
  )
    return;
  isUpdatingCountry.value = true;
  countryError.value = "";
  try {
    await userProfileStore.updateCountry(userId, selectedCountryId.value);
    emit("close");
    selectedCountryId.value = "";
    toast.success(tr("UserProfile.da_cap_nhat_quoc_gia"));
  } catch {
    countryError.value = userProfileStore.error || tr("UserProfile.khong_the_cap_nhat_quoc_gia_vui_long_thu_lai");
    toast.error(countryError.value);
  } finally {
    isUpdatingCountry.value = false;
  }
}

function closeCountryModal() {
  if (!isUpdatingCountry.value) emit("close");
}
</script>

<template>
  <TwoOptionsModal
    :title="tr('UserProfile.doi_quoc_gia')"
    :first-text="tr('AccountInfoModal.huy')"
    :second-text="isUpdatingCountry ? tr('UserProfile.dang_cap_nhat') : tr('UserProfile.xac_nhan_doi')"
    :first-disabled="isUpdatingCountry"
    :second-disabled="
      !canChangeCountry ||
      countryStore.isLoading ||
      isUpdatingCountry ||
      !selectedCountryId ||
      selectedCountryId === userProfileStore.profile?.country_id
    "
    :on-first="closeCountryModal"
    :on-dismiss="closeCountryModal"
    :on-second="updateCountry"
    @keydown.esc.stop="closeCountryModal"
  >
    <div class="max-h-[calc(100dvh-14rem)] space-y-4 overflow-y-auto text-sm text-[#24352a]">
      <div class="rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] p-3 text-xs leading-relaxed">
        <div class="mb-1 font-semibold">{{ tr("UserProfile.luu_y_truoc_khi_doi") }}</div>
        <div>{{ tr("UserProfile.chon_quoc_gia_anh_huong_mui_gio") }}</div>
        <div class="mt-1">{{ tr("UserProfile.sau_khi_cap_nhat_quoc_gia_ban_can_cho_365_ngay_de_co_the_doi_tie") }}</div>
      </div>
      <div>
        {{ tr("UserProfile.quoc_gia_hien_tai") }}
        <span class="font-semibold">{{ currentCountry?.name || tr("UserProfile.chua_co_thong_tin") }}</span>
      </div>
      <div
        v-if="!canChangeCountry"
        role="status"
        class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
      >
        {{ tr("UserProfile.ban_con") }} {{ countryCooldownDaysRemaining }}
        {{ tr("UserProfile.ngay_nua_moi_co_the_doi_quoc_gia") }}
      </div>
      <fieldset
        :disabled="!canChangeCountry || countryStore.isLoading || isUpdatingCountry"
        class="min-w-0 space-y-2 disabled:opacity-60"
      >
        <legend class="mb-2 font-semibold">{{ tr("UserProfile.chon_quoc_gia_moi") }}</legend>
        <input
          v-model="countrySearch"
          type="search"
          autocomplete="off"
          :placeholder="tr('UserProfile.tim_quoc_gia')"
          :aria-label="tr('UserProfile.tim_quoc_gia_2')"
          class="w-full rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-600"
        />
        <div class="max-h-40 overflow-y-auto rounded-lg border border-[#cbd9c6] bg-[#f5f9f0]">
          <div v-if="countryStore.isLoading" role="status" class="px-3 py-2 text-xs text-gray-500">
            {{ tr("UserProfile.dang_tai_quoc_gia") }}
          </div>
          <template v-else>
            <label
              v-for="country in filteredCountries"
              :key="country.id"
              class="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-[#e7ecda]"
              :class="{ 'bg-[#e7ecda]': selectedCountryId === country.id }"
            >
              <input
                v-model="selectedCountryId"
                type="radio"
                name="profile-country"
                :value="country.id"
                class="accent-[#24352a]"
                @change="countryError = ''"
              />
              <span>{{ country.name }}</span>
            </label>
            <div v-if="filteredCountries.length === 0" class="px-3 py-2 text-xs text-gray-500">
              {{ tr("UserProfile.khong_tim_thay_quoc_gia") }}
            </div>
          </template>
        </div>
      </fieldset>
      <div v-if="countryError" role="alert" class="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
        {{ countryError }}
      </div>
    </div>
  </TwoOptionsModal>
</template>
