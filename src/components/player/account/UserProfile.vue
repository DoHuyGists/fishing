<script lang="ts" setup>
import { getFormattingLocale } from '../../../i18n';
import { t as tr } from "../../../i18n";

import { computed, onMounted, onUnmounted, ref } from "vue";
import { useAuthStore } from "../../../stores/auth.ts";
import { useCurrencyStore } from "../../../stores/currency.ts";
import { useUserProfileStore } from "../../../stores/userProfile.ts";
import { useCountryStore } from "../../../stores/country.ts";
import { useLocaleStore } from "../../../stores/locale.ts";
import Cash from "../currency/Cash.vue";
import TwoOptionsModal from "../../shared/TwoOptionsModal.vue";
import UpdateIdentityModal from "./UpdateIdentityModal.vue";
import ChangePasswordModal from "./ChangePasswordModal.vue";
import { formatDateTime } from "../../../utils/time.ts";

defineEmits<{ signOut: [] }>();

const authStore = useAuthStore();
const currencyStore = useCurrencyStore();
const userProfileStore = useUserProfileStore();
const countryStore = useCountryStore();
const localeStore = useLocaleStore();
const copied = ref(false);
const selectedCountryId = ref("");
const countrySearch = ref("");
const showCountryModal = ref(false);
const isUpdatingCountry = ref(false);
const countryError = ref("");
const now = ref(Date.now());
const clock = window.setInterval(() => { now.value = Date.now(); }, 60_000);
onUnmounted(() => window.clearInterval(clock));
const showIdentityModal = ref(false);
const showPasswordModal = ref(false);

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
const joinedDate = computed(() => {
  const value = userProfileStore.profile?.created_at || authStore.user?.created_at;
  if (!value) return tr('UserProfile.chua_co_thong_tin');
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? tr('UserProfile.chua_co_thong_tin') : formatDateTime(date);
});
const filteredCountries = computed(() => {
  const query = countrySearch.value.trim().toLocaleLowerCase();
  return query
    ? countryStore.countries.filter((country) => country.name.toLocaleLowerCase().includes(query))
    : countryStore.countries;
});

onMounted(() => countryStore.fetchCountries());

async function updateCountry() {
  const userId = authStore.user?.id;
  if (!userId || !selectedCountryId.value || selectedCountryId.value === userProfileStore.profile?.country_id || !canChangeCountry.value || isUpdatingCountry.value) return;
  isUpdatingCountry.value = true;
  countryError.value = "";
  try {
    await userProfileStore.updateCountry(userId, selectedCountryId.value);
    showCountryModal.value = false;
    selectedCountryId.value = "";
  } catch {
    countryError.value = userProfileStore.error || tr('UserProfile.khong_the_cap_nhat_quoc_gia_vui_long_thu_lai');
  } finally {
    isUpdatingCountry.value = false;
  }
}

function openCountryModal() {
  now.value = Date.now();
  selectedCountryId.value = userProfileStore.profile?.country_id ?? "";
  countrySearch.value = "";
  countryError.value = "";
  showCountryModal.value = true;
  void countryStore.fetchCountries();
}

function closeCountryModal() {
  if (isUpdatingCountry.value) return;
  showCountryModal.value = false;
  selectedCountryId.value = "";
  countrySearch.value = "";
  countryError.value = "";
}

function copyUserId() {
  const id = authStore.user?.id;
  if (!id) return;

  navigator.clipboard.writeText(id).then(() => {
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  });
}

const formattedExp = computed(() => {
  const exp = userProfileStore.profile?.experience_point;
  return exp !== undefined && exp !== null ? Number(exp).toLocaleString(getFormattingLocale()) : "0";
});

const maxExp = computed(() => {
  const level = userProfileStore.profile?.level;
  return level != undefined && level != null ? level * 1000 : 0;
});

const userInitial = computed(() => {
  const email = authStore.user?.email || "";
  return email.length > 0 ? email.charAt(0).toUpperCase() : "U";
});
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex items-center gap-4 bg-linear-to-r from-emerald-50 to-teal-50/70 border border-emerald-100/80 rounded-xl p-4">
      <div class="w-14 h-14 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xl font-black shadow-md shrink-0">
        <img v-if="userProfileStore.profile?.avatar_url" :src="userProfileStore.profile.avatar_url" :alt="tr('UpdateIdentityModal.anh_dai_dien')" class="h-full w-full rounded-full object-cover" referrerpolicy="no-referrer" />
        <span v-else>{{ userInitial }}</span>
      </div>
      <div class="flex flex-col min-w-0 flex-1">
        <span class="font-bold text-sm text-[#263238] truncate" :title="authStore.user?.email || ''">
          {{ userProfileStore.profile?.display_name || authStore.user?.email || tr('UserProfile.chua_cap_nhat_email') }}
        </span>
        <div class="flex flex-wrap items-center gap-2 mt-1.5">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            {{ tr('UserProfile.cap') }} {{ userProfileStore.level }}
          </span>
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            ✨ {{ formattedExp }} EXP
          </span>
        </div>
      </div>
    </div>

    <div>
      <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{{ tr('UserProfile.chi_so_can_thu') }}</div>
      <div class="grid grid-cols-2 gap-2.5">
        <div class="bg-gray-50 border border-gray-100 rounded-xl p-3 flex flex-col gap-1">
          <div class="flex items-center gap-1.5 text-gray-500 text-[11px] font-medium">
            <span>🎒</span><span>{{ tr('UserProfile.suc_chua_tui_do') }}</span>
          </div>
          <span class="text-sm font-bold text-[#263238]">
            {{ userProfileStore.inventoryCapacity }} <span class="text-xs font-normal text-gray-500">{{ tr('UserProfile.o') }}</span>
          </span>
        </div>
        <div class="bg-gray-50 border border-gray-100 rounded-xl p-3 flex flex-col gap-1">
          <div class="flex items-center gap-1.5 text-gray-500 text-[11px] font-medium">
            <span>🐟</span><span>{{ tr('UserProfile.suc_chua_kho_ca') }}</span>
          </div>
          <span class="text-sm font-bold text-[#263238]">
            {{ userProfileStore.speciesStorageCapacity }} <span class="text-xs font-normal text-gray-500">{{ tr('UserProfile.con') }}</span>
          </span>
        </div>
        <div class="bg-gray-50 border border-gray-100 rounded-xl p-3 flex flex-col gap-1">
          <div class="flex items-center gap-1.5 text-gray-500 text-[11px] font-medium">
            <span>🏆</span><span>{{ tr('UserProfile.cap_do') }}</span>
          </div>
          <span class="text-sm font-bold text-[#263238]">{{ tr('UserProfile.level') }} {{ userProfileStore.level }}</span>
        </div>
        <div class="bg-gray-50 border border-gray-100 rounded-xl p-3 flex flex-col gap-1">
          <div class="flex items-center gap-1.5 text-gray-500 text-[11px] font-medium">
            <span>⚡</span><span>{{ tr('UserProfile.diem_kinh_nghiem') }}</span>
          </div>
          <div class="flex items-center gap-1 text-md text-[#263238]">
            <span class="font-bold">{{ formattedExp }}</span><span>/</span><span>{{ maxExp }}</span>
          </div>
        </div>
      </div>
    </div>

    <div>
      <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{{ tr('UserProfile.chi_tiet_tai_khoan') }}</div>
      <div class="bg-gray-50 border border-gray-100 rounded-xl divide-y divide-gray-100 text-xs">
        <div class="flex justify-between items-center gap-3 px-3.5 py-2.5">
          <span class="text-gray-500 font-medium">{{ tr('UserProfile.quoc_gia') }}</span>
          <span class="text-right font-semibold text-[#24352a]">{{ currentCountry?.name || (countryStore.isLoading ? tr('UserProfile.dang_tai_quoc_gia') : tr('UserProfile.chua_co_thong_tin')) }}</span>
        </div>
        <div class="flex justify-between items-center px-3.5 py-2.5">
          <span class="text-gray-500 font-medium">{{ tr('UserProfile.user_id') }}</span>
          <div class="flex items-center gap-1.5">
            <span class="font-mono text-[11px] bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-700 max-w-[170px] sm:max-w-[220px] truncate">{{ authStore.user?.id || "N/A" }}</span>
            <button type="button" class="cursor-pointer text-[10px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded transition-colors" @click="copyUserId" :title="tr('UserProfile.sao_chep_user_id')">
              {{ copied ? tr('UserProfile.da_chep') : tr('UserProfile.chep') }}
            </button>
          </div>
        </div>
        <div class="flex justify-between items-center px-3.5 py-2.5">
          <span class="text-gray-500 font-medium">{{ tr('UserProfile.ngay_tham_gia') }}</span>
          <span class="font-semibold text-[#24352a]">{{ joinedDate }}</span>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <TwoOptionsModal v-if="showCountryModal" :title="tr('UserProfile.doi_quoc_gia')" :first-text="tr('AccountInfoModal.huy')" :second-text="isUpdatingCountry ? tr('UserProfile.dang_cap_nhat') : tr('UserProfile.xac_nhan_doi')" :first-disabled="isUpdatingCountry"
        :second-disabled="!canChangeCountry || countryStore.isLoading || isUpdatingCountry || !selectedCountryId || selectedCountryId === userProfileStore.profile?.country_id" :on-first="closeCountryModal" :on-dismiss="closeCountryModal" :on-second="updateCountry"
        @keydown.esc.stop="closeCountryModal">
        <div class="max-h-[calc(100dvh-14rem)] space-y-4 overflow-y-auto text-sm text-[#24352a]">
          <div class="rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] p-3 text-xs leading-relaxed">
            <div class="mb-1 font-semibold">{{ tr('UserProfile.luu_y_truoc_khi_doi') }}</div>
            <div>{{ tr('UserProfile.sau_khi_doi_ban_se_nhan_duoc_mot_chia_khoa_mo_khu_vuc_cau') }}</div>
            <div class="mt-1">{{ tr('UserProfile.sau_khi_cap_nhat_quoc_gia_ban_can_cho_365_ngay_de_co_the_doi_tie') }}</div>
          </div>
          <div>{{ tr('UserProfile.quoc_gia_hien_tai') }} <span class="font-semibold">{{ currentCountry?.name || tr('UserProfile.chua_co_thong_tin') }}</span></div>
          <div v-if="!canChangeCountry" role="status" class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            {{ tr('UserProfile.ban_con') }} {{ countryCooldownDaysRemaining }} {{ tr('UserProfile.ngay_nua_moi_co_the_doi_quoc_gia') }}
          </div>
          <fieldset :disabled="!canChangeCountry || countryStore.isLoading || isUpdatingCountry" class="min-w-0 space-y-2 disabled:opacity-60">
            <legend class="mb-2 font-semibold">{{ tr('UserProfile.chon_quoc_gia_moi') }}</legend>
            <input v-model="countrySearch" type="search" autocomplete="off" :placeholder="tr('UserProfile.tim_quoc_gia')" :aria-label="tr('UserProfile.tim_quoc_gia_2')" class="w-full rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-600" />
            <div class="max-h-40 overflow-y-auto rounded-lg border border-[#cbd9c6] bg-[#f5f9f0]">
              <div v-if="countryStore.isLoading" role="status" class="px-3 py-2 text-xs text-gray-500">{{ tr('UserProfile.dang_tai_quoc_gia') }}</div>
              <template v-else>
                <label v-for="country in filteredCountries" :key="country.id" class="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-[#e7ecda]" :class="{ 'bg-[#e7ecda]': selectedCountryId === country.id }">
                  <input v-model="selectedCountryId" type="radio" name="profile-country" :value="country.id" class="accent-[#24352a]" @change="countryError = ''" />
                  <span>{{ country.name }}</span>
                </label>
                <div v-if="filteredCountries.length === 0" class="px-3 py-2 text-xs text-gray-500">{{ tr('UserProfile.khong_tim_thay_quoc_gia') }}</div>
              </template>
            </div>
          </fieldset>
          <div v-if="countryError" role="alert" class="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{{ countryError }}</div>
        </div>
      </TwoOptionsModal>
    </Teleport>
    <div class="flex flex-wrap gap-2 justify-end">
      <label class="flex items-center justify-between gap-3 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-3.5 py-2.5 text-xs text-[#24352a]">
        <span class="font-medium">{{ tr('language.label') }}</span>
      <select v-model="localeStore.locale" :disabled="localeStore.saving" :aria-busy="localeStore.saving" class="cursor-pointer rounded bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-wait disabled:opacity-60" :aria-label="tr('language.label')">
          <option value="vi">Tiếng Việt</option>
          <option value="en">English</option>
        </select>
    </label>
    <div v-if="localeStore.error" role="alert" class="text-xs text-red-700">{{ localeStore.error }}</div>
      <button type="button" class="rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-4 py-2 text-sm font-semibold text-[#24352a] transition-colors hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600" aria-haspopup="dialog"
        @click="openCountryModal">
        {{ tr('UserProfile.doi_quoc_gia') }}
      </button>
      <button type="button" class="rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-4 py-2 text-sm font-semibold text-[#24352a] transition-colors hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600" aria-haspopup="dialog"
        @click="showIdentityModal = true">
        {{ tr('UpdateIdentityModal.ten_va_anh_dai_dien') }}
      </button>
      <button type="button" class="rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-4 py-2 text-sm font-semibold text-[#24352a] transition-colors hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600" aria-haspopup="dialog"
        @click="showPasswordModal = true">
        {{ tr('ChangePasswordModal.doi_mat_khau') }}
      </button>
      <button type="button" class="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:border-red-300 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
        @click="$emit('signOut')">
        <span aria-hidden="true"><img src="/icons/signout.svg?v=2" width="20" alt="" draggable="false" /></span>
        {{ tr('AccountInfoModal.dang_xuat') }}
      </button>
    </div>

    <Teleport to="body">
      <UpdateIdentityModal v-if="showIdentityModal" @close="showIdentityModal = false" />
      <ChangePasswordModal v-if="showPasswordModal" @close="showPasswordModal = false" />
    </Teleport>
  </div>
</template>
