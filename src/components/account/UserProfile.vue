<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useAuthStore } from "../../stores/auth";
import { useCurrencyStore } from "../../stores/currency";
import { useUserProfileStore } from "../../stores/userProfile";
import { useCountryStore } from "../../stores/country";
import Cash from "../currency/Cash.vue";
import TwoOptionsModal from "../shared/TwoOptionsModal.vue";

defineEmits<{ signOut: [] }>();

const authStore = useAuthStore();
const currencyStore = useCurrencyStore();
const userProfileStore = useUserProfileStore();
const countryStore = useCountryStore();
const copied = ref(false);
const selectedCountryId = ref("");
const countrySearch = ref("");
const isCountryDropdownOpen = ref(false);
const showCountryConfirm = ref(false);
const isUpdatingCountry = ref(false);
const countryError = ref("");

const countryCooldownDaysRemaining = computed(() => {
  const cooldown = userProfileStore.profile?.update_country_cooldown;
  if (!cooldown) return 0;
  const remainingMs = new Date(cooldown).getTime() - Date.now();
  return Number.isFinite(remainingMs) && remainingMs > 0 ? Math.ceil(remainingMs / (24 * 60 * 60 * 1000)) : 0;
});
const canChangeCountry = computed(() => !userProfileStore.profile?.country_id || countryCooldownDaysRemaining.value === 0);
const selectedCountry = computed(() => countryStore.countries.find((country) => country.id === selectedCountryId.value));
const filteredCountries = computed(() => {
  const query = countrySearch.value.trim().toLocaleLowerCase();
  return query ? countryStore.countries.filter((country) => country.name.toLocaleLowerCase().includes(query)) : countryStore.countries;
});

onMounted(() => countryStore.fetchCountries());

async function updateCountry() {
  const userId = authStore.user?.id;
  if (!userId || !selectedCountryId.value || !canChangeCountry.value || isUpdatingCountry.value) return;
  isUpdatingCountry.value = true;
  countryError.value = "";
  try {
    await userProfileStore.updateCountry(userId, selectedCountryId.value);
    showCountryConfirm.value = false;
  } catch {
    countryError.value = userProfileStore.error || "Không thể cập nhật quốc gia. Vui lòng thử lại.";
  } finally {
    isUpdatingCountry.value = false;
  }
}

function selectCountry(countryId: string) {
  selectedCountryId.value = countryId;
  isCountryDropdownOpen.value = false;
  countrySearch.value = "";
  showCountryConfirm.value = !!countryId;
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
  return exp !== undefined && exp !== null ? Number(exp).toLocaleString("vi-VN") : "0";
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
      class="flex items-center gap-4 bg-linear-to-r from-emerald-50 to-teal-50/70 border border-emerald-100/80 rounded-xl p-4"
    >
      <div
        class="w-14 h-14 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xl font-black shadow-md shrink-0"
      >
        {{ userInitial }}
      </div>
      <div class="flex flex-col min-w-0 flex-1">
        <span class="font-bold text-sm text-[#263238] truncate" :title="authStore.user?.email || ''">
          {{ authStore.user?.email || "Chưa cập nhật email" }}
        </span>
        <div class="flex flex-wrap items-center gap-2 mt-1.5">
          <span
            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200"
          >
            ⭐ Cấp {{ userProfileStore.level }}
          </span>
          <span
            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200"
          >
            ✨ {{ formattedExp }} EXP
          </span>
        </div>
      </div>
    </div>

    <div>
      <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Chỉ số cần thủ</div>
      <div class="grid grid-cols-2 gap-2.5">
        <div class="bg-gray-50 border border-gray-100 rounded-xl p-3 flex flex-col gap-1">
          <div class="flex items-center gap-1.5 text-gray-500 text-[11px] font-medium">
            <span>🎒</span><span>Sức chứa túi đồ</span>
          </div>
          <span class="text-sm font-bold text-[#263238]">
            {{ userProfileStore.inventoryCapacity }} <span class="text-xs font-normal text-gray-500">ô</span>
          </span>
        </div>
        <div class="bg-gray-50 border border-gray-100 rounded-xl p-3 flex flex-col gap-1">
          <div class="flex items-center gap-1.5 text-gray-500 text-[11px] font-medium">
            <span>🐟</span><span>Sức chứa kho cá</span>
          </div>
          <span class="text-sm font-bold text-[#263238]">
            {{ userProfileStore.speciesStorageCapacity }} <span class="text-xs font-normal text-gray-500">con</span>
          </span>
        </div>
        <div class="bg-gray-50 border border-gray-100 rounded-xl p-3 flex flex-col gap-1">
          <div class="flex items-center gap-1.5 text-gray-500 text-[11px] font-medium">
            <span>🏆</span><span>Cấp độ</span>
          </div>
          <span class="text-sm font-bold text-[#263238]">Level {{ userProfileStore.level }}</span>
        </div>
        <div class="bg-gray-50 border border-gray-100 rounded-xl p-3 flex flex-col gap-1">
          <div class="flex items-center gap-1.5 text-gray-500 text-[11px] font-medium">
            <span>⚡</span><span>Điểm kinh nghiệm</span>
          </div>
          <div class="flex items-center gap-1 text-md text-[#263238]">
            <span class="font-bold">{{ formattedExp }}</span><span>/</span><span>{{ maxExp }}</span>
          </div>
        </div>
      </div>
    </div>

    <div>
      <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Chi tiết tài khoản</div>
      <div class="bg-gray-50 border border-gray-100 rounded-xl divide-y divide-gray-100 text-xs">
        <div class="px-3.5 py-2.5">
          <label for="profile-country" class="mb-1.5 block text-gray-500 font-medium">Quốc gia</label>
          <div class="relative">
            <button id="profile-country" type="button" class="flex w-full items-center justify-between rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-3 py-2 text-left text-sm text-[#24352a] disabled:cursor-not-allowed disabled:opacity-60" :disabled="!canChangeCountry || countryStore.isLoading || isUpdatingCountry" :aria-expanded="isCountryDropdownOpen" aria-haspopup="listbox" @click="isCountryDropdownOpen = !isCountryDropdownOpen">
              <span>{{ selectedCountry?.name || (countryStore.isLoading ? "Đang tải quốc gia..." : "Chọn quốc gia") }}</span><span aria-hidden="true" class="ml-2 text-gray-500">▾</span>
            </button>
            <div v-if="isCountryDropdownOpen" class="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] shadow-lg">
              <div class="border-b border-[#cbd9c6] p-2"><input v-model="countrySearch" type="search" autocomplete="off" placeholder="Tìm quốc gia..." aria-label="Tìm quốc gia" class="w-full rounded-md border border-[#cbd9c6] bg-white px-3 py-2 text-sm text-[#24352a] outline-none focus:ring-2 focus:ring-emerald-600" @keydown.esc="isCountryDropdownOpen = false" /></div>
              <ul role="listbox" aria-label="Danh sách quốc gia" class="max-h-52 overflow-y-auto py-1">
                <li v-for="country in filteredCountries" :key="country.id" role="option" :aria-selected="country.id === selectedCountryId"><button type="button" class="w-full px-3 py-2 text-left text-sm text-[#24352a] hover:bg-emerald-100 focus:bg-emerald-100 focus:outline-none" @click="selectCountry(country.id)">{{ country.name }}</button></li>
                <li v-if="filteredCountries.length === 0" class="px-3 py-2 text-sm text-gray-500">Không tìm thấy quốc gia.</li>
              </ul>
            </div>
          </div>
          <p v-if="userProfileStore.profile?.country_id && countryCooldownDaysRemaining > 0" class="mt-1 text-gray-500">
            Bạn còn {{ countryCooldownDaysRemaining }} ngày nữa mới có thể đổi quốc gia.
          </p>
          <p v-if="countryError" role="alert" class="mt-1 text-red-700">{{ countryError }}</p>
        </div>
        <div class="flex justify-between items-center px-3.5 py-2.5">
          <span class="text-gray-500 font-medium">User ID</span>
          <div class="flex items-center gap-1.5">
            <span
              class="font-mono text-[11px] bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-700 max-w-[170px] sm:max-w-[220px] truncate"
            >{{ authStore.user?.id || "N/A" }}</span>
            <button
              type="button"
              class="cursor-pointer text-[10px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded transition-colors"
              @click="copyUserId"
              title="Sao chép User ID"
            >
              {{ copied ? "✓ Đã chép" : "Chép" }}
            </button>
          </div>
        </div>
        <div class="flex justify-between items-center px-3.5 py-2.5">
          <span class="text-gray-500 font-medium">Số dư hiện tại</span>
          <Cash :amount="currencyStore.formattedCash" />
        </div>
        <div class="flex justify-between items-center px-3.5 py-2.5">
          <span class="text-gray-500 font-medium">Ngày tham gia</span>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <TwoOptionsModal
        v-if="showCountryConfirm"
        title="Xác nhận quốc gia"
        message="Sau khi đổi, bạn sẽ nhận được một chìa khóa mở khu vực câu."
        :sub-text="`Sau khi cập nhật quốc gia, bạn cần chờ ${userProfileStore.profile?.country_id ? countryCooldownDaysRemaining : 365} ngày để có thể đổi.`"
        first-text="Hủy"
        :second-text="isUpdatingCountry ? 'Đang cập nhật...' : 'Xác nhận'"
        :on-first="() => { if (!isUpdatingCountry) { showCountryConfirm = false; selectedCountryId = ''; } }"
        :on-second="updateCountry"
      />
    </Teleport>

    <div class="flex items-end">
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:border-red-300 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
        @click="$emit('signOut')"
      >
        <span aria-hidden="true"><img src="/icons/signout.svg?v=2" width="20" alt="" draggable="false" /></span>
        Đăng xuất
      </button>
    </div>
  </div>
</template>


