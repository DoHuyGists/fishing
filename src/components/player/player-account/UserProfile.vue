<script lang="ts" setup>
import { getFormattingLocale } from "../../../i18n";
import { t as tr } from "../../../i18n";

import { computed, onMounted, ref } from "vue";
import { useAuthStore } from "../../../stores/auth.ts";
import { useCurrencyStore } from "../../../stores/player-currency-store.ts";
import { useUserProfileStore } from "../../../stores/player-user-profile-store.ts";
import { useCountryStore } from "../../../stores/player-country-store.ts";
import Cash from "../player-currency/Cash.vue";
import LanguageSelector from "../../shared/LanguageSelector.vue";
import UpdateCountryModal from "./UpdateCountryModal.vue";
import UpdateIdentityModal from "./UpdateIdentityModal.vue";
import ChangePasswordModal from "./ChangePasswordModal.vue";
import { formatDateTime } from "../../../utils/time.ts";

defineEmits<{ signOut: [] }>();

const authStore = useAuthStore();
const currencyStore = useCurrencyStore();
const userProfileStore = useUserProfileStore();
const countryStore = useCountryStore();
const copied = ref(false);
const showCountryModal = ref(false);
const showIdentityModal = ref(false);
const showPasswordModal = ref(false);

const currentCountry = computed(() =>
  countryStore.countries.find((country) => country.id === userProfileStore.profile?.country_id),
);
const joinedDate = computed(() => {
  const value = userProfileStore.profile?.created_at || authStore.user?.created_at;
  if (!value) return tr("UserProfile.chua_co_thong_tin");
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? tr("UserProfile.chua_co_thong_tin") : formatDateTime(date);
});
onMounted(() => countryStore.fetchCountries());

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
    <div
      class="profile-captain slide-fade-in from-top player-content-in flex items-center gap-4 bg-surface border border-surface/80 rounded-xl p-4"
    >
      <div
        class="profile-captain__avatar w-14 h-14 rounded-full bg-accent text-white flex items-center justify-center text-xl font-black shadow-md shrink-0"
      >
        <img
          v-if="userProfileStore.profile?.avatar_url"
          :src="userProfileStore.profile.avatar_url"
          :alt="tr('UpdateIdentityModal.anh_dai_dien')"
          class="h-full w-full rounded-full object-cover"
          referrerpolicy="no-referrer"
        />
        <span v-else>{{ userInitial }}</span>
      </div>
      <div class="flex flex-col min-w-0 flex-1">
        <span class="font-bold text-sm text-content truncate" :title="authStore.user?.email || ''">
          {{ userProfileStore.profile?.display_name || authStore.user?.email || tr("UserProfile.chua_cap_nhat_email") }}
        </span>
        <div class="flex flex-wrap items-center gap-2 mt-1.5">
          <span
            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-surface text-gold border border-gold"
          >
            {{ tr("UserProfile.cap") }} {{ userProfileStore.level }}
          </span>
          <span
            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface text-content border border-accent"
          >
            ✨ {{ formattedExp }} EXP
          </span>
        </div>
      </div>
    </div>

    <div>
      <div class="text-xs font-bold text-content uppercase tracking-wider mb-2">
        {{ tr("UserProfile.chi_so_can_thu") }}
      </div>
      <div class="slide-fade-in from-bottom player-content-in grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
        <div class="bg-white border border-border rounded-xl p-3 flex flex-col gap-1">
          <div class="flex items-center gap-1.5 text-content text-[11px] font-medium">
            <span>🎒</span><span>{{ tr("UserProfile.suc_chua_tui_do") }}</span>
          </div>
          <span class="text-sm font-bold text-content">
            {{ userProfileStore.inventoryCapacity }}
            <span class="text-xs font-normal text-content">{{ tr("UserProfile.o") }}</span>
          </span>
        </div>
        <div class="bg-white border border-border rounded-xl p-3 flex flex-col gap-1">
          <div class="flex items-center gap-1.5 text-content text-[11px] font-medium">
            <span>🐟</span><span>{{ tr("UserProfile.suc_chua_kho_ca") }}</span>
          </div>
          <span class="text-sm font-bold text-content">
            {{ userProfileStore.speciesStorageCapacity }}
            <span class="text-xs font-normal text-content">{{ tr("UserProfile.con") }}</span>
          </span>
        </div>
        <div class="bg-white border border-border rounded-xl p-3 flex flex-col gap-1">
          <div class="flex items-center gap-1.5 text-content text-[11px] font-medium">
            <span>🎣</span><span>{{ tr("UserProfile.suc_chua_bo_trang_bi") }}</span>
          </div>
          <span class="text-sm font-bold text-content">
            {{ userProfileStore.equipmentCapacity }}
            <span class="text-xs font-normal text-content">{{ tr("UserProfile.o") }}</span>
          </span>
        </div>
        <div class="bg-white border border-border rounded-xl p-3 flex flex-col gap-1">
          <div class="flex items-center gap-1.5 text-content text-[11px] font-medium">
            <span>🧺</span><span>{{ tr("UserProfile.suc_chua_gio_ca") }}</span>
          </div>
          <span class="text-sm font-bold text-content">
            {{ userProfileStore.fishingNetCapacity }}
            <span class="text-xs font-normal text-content">{{ tr("UserProfile.con") }}</span>
          </span>
        </div>
        <div class="bg-white border border-border rounded-xl p-3 flex flex-col gap-1">
          <div class="flex items-center gap-1.5 text-content text-[11px] font-medium">
            <span>🏆</span><span>{{ tr("UserProfile.cap_do") }}</span>
          </div>
          <span class="text-sm font-bold text-content"
            >{{ tr("UserProfile.level") }} {{ userProfileStore.level }}</span
          >
        </div>
        <div class="bg-white border border-border rounded-xl p-3 flex flex-col gap-1">
          <div class="flex items-center gap-1.5 text-content text-[11px] font-medium">
            <span>⚡</span><span>{{ tr("UserProfile.diem_kinh_nghiem") }}</span>
          </div>
          <div class="flex items-center gap-1 text-md text-content">
            <span class="font-bold">{{ formattedExp }}</span
            ><span>/</span><span>{{ maxExp }}</span>
          </div>
        </div>
      </div>
    </div>

    <div>
      <div class="text-xs font-bold text-content uppercase tracking-wider mb-2">
        {{ tr("UserProfile.chi_tiet_tai_khoan") }}
      </div>
      <div
        class="slide-fade-in from-bottom player-content-in bg-white border border-border rounded-xl divide-y divide-border text-xs"
      >
        <div class="flex justify-between items-center gap-3 px-3.5 py-2.5">
          <span class="text-content font-medium">{{ tr("UserProfile.quoc_gia") }}</span>
          <span class="text-right font-semibold text-content">{{
            currentCountry?.name ||
            (countryStore.isLoading ? tr("UserProfile.dang_tai_quoc_gia") : tr("UserProfile.chua_co_thong_tin"))
          }}</span>
        </div>
        <div class="flex justify-between items-center px-3.5 py-2.5">
          <span class="text-content font-medium">{{ tr("UserProfile.user_id") }}</span>
          <div class="flex items-center gap-1.5">
            <span
              class="font-mono text-[11px] bg-white border border-border px-2 py-0.5 rounded text-content max-w-[170px] sm:max-w-[220px] truncate"
              >{{ authStore.user?.id || "N/A" }}</span
            >
            <button
              type="button"
              class="cursor-pointer text-[10px] font-semibold text-content bg-surface hover:bg-surface border border-accent px-2 py-0.5 rounded transition-colors"
              @click="copyUserId"
              :title="tr('UserProfile.sao_chep_user_id')"
            >
              {{ copied ? tr("UserProfile.da_chep") : tr("UserProfile.chep") }}
            </button>
          </div>
        </div>
        <div class="flex justify-between items-center px-3.5 py-2.5">
          <span class="text-content font-medium">{{ tr("UserProfile.ngay_tham_gia") }}</span>
          <span class="font-semibold text-content">{{ joinedDate }}</span>
        </div>
      </div>
    </div>

    <div class="flex flex-wrap gap-2 justify-end">
      <LanguageSelector />
      <button
        type="button"
        class="rounded-lg border border-border-default bg-surface px-4 py-2 text-sm font-semibold text-content transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        aria-haspopup="dialog"
        @click="showCountryModal = true"
      >
        {{ tr("UserProfile.doi_quoc_gia") }}
      </button>
      <button
        type="button"
        class="rounded-lg border border-border-default bg-surface px-4 py-2 text-sm font-semibold text-content transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        aria-haspopup="dialog"
        @click="showIdentityModal = true"
      >
        {{ tr("UpdateIdentityModal.ten_va_anh_dai_dien") }}
      </button>
      <button
        type="button"
        class="rounded-lg border border-border-default bg-surface px-4 py-2 text-sm font-semibold text-content transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        aria-haspopup="dialog"
        @click="showPasswordModal = true"
      >
        {{ tr("ChangePasswordModal.doi_mat_khau") }}
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-lg border border-danger bg-surface px-4 py-2 text-sm font-semibold text-danger transition-colors hover:border-danger hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
        @click="$emit('signOut')"
      >
        <span aria-hidden="true"><img src="/icons/signout.svg?v=2" width="20" alt="" draggable="false" /></span>
        {{ tr("AccountInfoModal.dang_xuat") }}
      </button>
    </div>

    <Teleport to="body">
      <UpdateCountryModal v-if="showCountryModal" @close="showCountryModal = false" />
      <UpdateIdentityModal v-if="showIdentityModal" @close="showIdentityModal = false" />
      <ChangePasswordModal v-if="showPasswordModal" @close="showPasswordModal = false" />
    </Teleport>
  </div>
</template>

<style scoped>
html.ocean-theme .profile-captain {
  border-color: color-mix(in srgb, var(--color-ocean-gold) 70%, transparent);
  background: var(--color-primary);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--color-surface) 12%, transparent), 0 4px 16px color-mix(in srgb, var(--color-content) 18%, transparent);
}

html.ocean-theme .profile-captain__avatar {
  border: 2px solid var(--color-ocean-gold);
  background: var(--color-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-gold) 16%, transparent), 0 4px 10px color-mix(in srgb, var(--color-content) 25%, transparent);
  color: var(--color-white);
}
</style>
