<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useCurrencyStore } from "../../stores/currency.ts";
import { useAuthStore } from "../../stores/auth.ts";
import InteractWorldWrapper from "./InteractWorldMap.vue";
import MarketWindow from "../market/MarketWindow.vue";
import { useCaughtStore } from "../../stores/caught.ts";
import CaughtList from "../caught/CaughtList.vue";
import CatchDiaryModal from "../diary/CatchDiaryModal.vue";
import AccountInfoModal from "../account/AccountInfoModal.vue";
import SpinWheelModal from "../spin-wheel/SpinWheelModal.vue";
import InventoryModal from "../inventory/InventoryModal.vue";
import Feedbackmodal from "../feedback/Feedbackmodal.vue";
import MissionModal from "../mission/MissionModal.vue";
import EventModal from "../event/EventModal.vue";
import RedeemCode from "./RedeemCode.vue";
import NotificationModal from "../notification/NotificationModal.vue";
import { useModalStore } from "../../stores/modal.ts";
import { supabaseFishRepository } from "../../data/supabaseFishRepository";
import { useMarketStore } from "../../stores/market";
import FishSellConfirm from "../caught/FishSellConfirm.vue";
import FishReleaseConfirm from "../caught/FishReleaseConfirm.vue";

const currencyStore = useCurrencyStore();
const authStore = useAuthStore();
const caughtStore = useCaughtStore();
const modalStore = useModalStore();
const marketStore = useMarketStore();
const fishToSell = ref<any | null>(null);
const fishToRelease = ref<any | null>(null);
const isSellingFish = ref(false);
const isReleasingFish = ref(false);
const fishActionError = ref("");
const recentCaughtFishes = computed(() =>
  [...caughtStore.caughtFishes]
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
    .slice(0, 10),
);

function openSellConfirm(fish: any) {
  fishToSell.value = fish;
  fishActionError.value = "";
}

async function sellFish(price: number) {
  if (!fishToSell.value) return;
  if (!authStore.userId) {
    fishActionError.value = "Bạn chưa đăng nhập.";
    return;
  }
  isSellingFish.value = true;
  fishActionError.value = "";
  try {
    await supabaseFishRepository.listFishOnMarket(fishToSell.value.id, price);
    caughtStore.caughtFishes = caughtStore.caughtFishes.filter((fish) => fish.id !== fishToSell.value.id);
    await marketStore.loadMarketListings();
    fishToSell.value = null;
  } catch (error: any) {
    fishActionError.value = error.message || "Không thể đăng bán cá. Vui lòng thử lại.";
  } finally {
    isSellingFish.value = false;
  }
}

async function releaseFish() {
  if (!fishToRelease.value) return;
  isReleasingFish.value = true;
  try {
    await supabaseFishRepository.deleteCaughtFish(fishToRelease.value.id);
    caughtStore.caughtFishes = caughtStore.caughtFishes.filter((fish) => fish.id !== fishToRelease.value.id);
    fishToRelease.value = null;
  } catch (error) {
    console.error("Không thể thả cá:", error);
  } finally {
    isReleasingFish.value = false;
  }
}

onMounted(() => {
  if (authStore.userId) {
    currencyStore.fetchCurrency();
    caughtStore.loadCaughtFishes();
  }
});

</script>

<template>
  <div class="map-page h-screen p-3 relative flex gap-3 overflow-hidden">

    <!-- Khung Bản đồ trung tâm -->
    <InteractWorldWrapper />

    <div>
      <div class="flex items-center flex-wrap gap-2">
        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="modalStore.open('account')">
          <span class="text-sm">⚙️</span>
          <span>Tài khoản</span>
        </button>

        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="modalStore.open('market')">
          <span class="text-sm">🏪</span>
          <span>Chợ cá</span>
        </button>

        <!-- Nhật ký -->
        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="modalStore.open('diary')">
          <span class="text-sm">📖</span>
          <span>Nhật ký</span>
        </button>

        <!-- Gacha -->
        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="modalStore.open('gacha')">
          <span class="text-sm">🎁</span>
          <span>Gacha</span>
        </button>

        <!-- Túi đồ -->
        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="modalStore.open('inventory')">
          <span class="text-sm">📦</span>
          <span>Túi đồ</span>
        </button>

        <!-- Feedback -->
        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="modalStore.open('feedback')">
          <span class="text-sm">📄</span>
          <span>Phản hồi</span>
        </button>

        <!-- Mission -->
        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="modalStore.open('mission')">
          <span class="text-sm">📄</span>
          <span>Nhiệm vụ</span>
        </button>

        <!-- Event -->
        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="modalStore.open('event')">
          <span class="text-sm">📄</span>
          <span>Sự kiện</span>
        </button>

        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="modalStore.open('caught')">
          <span class="text-sm" aria-hidden="true">🐟</span>
          <span>Túi cá</span>
        </button>

        <!-- Redeem code -->
        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="modalStore.open('redeem')">
          <span class="text-sm" aria-hidden="true">🎁</span>
          <span>Đổi mã</span>
        </button>

        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="modalStore.open('notifications')">
          <span class="text-sm" aria-hidden="true">🔔</span>
          <span>Thông báo</span>
        </button>
      </div>

      <section class="mt-3 w-full max-w-sm rounded-xl border border-emerald-900/15 bg-white/95 p-3 shadow-sm">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="m-0 text-sm font-bold text-[#153221]">10 cá mới câu</h2>
          <span class="text-[11px] text-gray-500">{{ recentCaughtFishes.length }} cá</span>
        </div>
        <p v-if="caughtStore.isLoadingCaught && !recentCaughtFishes.length" class="m-0 py-3 text-center text-xs text-gray-500">
          Đang tải danh sách cá...
        </p>
        <p v-else-if="!recentCaughtFishes.length" class="m-0 py-3 text-center text-xs text-gray-500">
          Chưa câu được cá nào
        </p>
        <ul v-else class="m-0 max-h-[min(55vh,520px)] list-none space-y-2 overflow-y-auto p-0">
          <li v-for="(fish, index) in recentCaughtFishes" :key="fish.id" class="flex min-w-0 items-center gap-2 rounded-lg bg-emerald-50/70 p-2">
            <img :src="fish.species?.image || '/fish/VN/fish.jpg'" :alt="fish.species?.name || 'Cá'" class="h-10 w-10 shrink-0 rounded-md object-cover" />
            <div class="min-w-0 flex-1">
              <p class="m-0 truncate text-xs font-bold text-gray-800">{{ fish.species?.name || 'Cá chưa rõ tên' }}</p>
              <p class="m-0 text-[10px] text-gray-500">{{ fish.species?.rarity || 'Thường' }} · {{ fish.created_at ? new Date(fish.created_at).toLocaleDateString('vi-VN') : '' }}</p>
            </div>
            <div class="flex shrink-0 flex-col gap-1">
              <span class="text-center text-[10px] font-semibold text-emerald-800">#{{ index + 1 }}</span>
              <button type="button" class="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800 hover:bg-emerald-100" @click="openSellConfirm(fish)">
                Bán
              </button>
              <button type="button" class="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700 hover:bg-red-100" @click="fishToRelease = fish">
                Thả
              </button>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <Teleport to="body">
      <Transition enter-active-class="transition-opacity duration-200 ease-out" enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-150 ease-in" leave-to-class="opacity-0">
        <div v-if="modalStore.isModalOpening">
          <AccountInfoModal v-if="modalStore.isOpening('account')" />
          <MarketWindow v-if="modalStore.isOpening('market')"/>
          <CatchDiaryModal v-if="modalStore.isOpening('diary')"/>
          <SpinWheelModal v-if="modalStore.isOpening('gacha')"/>
          <InventoryModal v-if="modalStore.isOpening('inventory')"/>
          <Feedbackmodal v-if="modalStore.isOpening('feedback')"/>
          <MissionModal v-if="modalStore.isOpening('mission')"/>
          <EventModal v-if="modalStore.isOpening('event')"/>
          <RedeemCode v-if="modalStore.isOpening('redeem')" />
          <NotificationModal v-if="modalStore.isOpening('notifications')" />
          <CaughtList v-if="modalStore.isOpening('caught')" />
        </div>
      </Transition>
    </Teleport>
    <FishSellConfirm :fish="fishToSell" :is-loading="isSellingFish" :error="fishActionError" @cancel="fishToSell = null" @confirm="sellFish" />
    <FishReleaseConfirm :fish="fishToRelease" :is-loading="isReleasingFish" @cancel="fishToRelease = null" @confirm="releaseFish" />
  </div>
</template>

<style lang="css">
@media (max-width: 1024px) {
  .map-page {
    height: auto;
    min-height: 100vh;
    flex-direction: column;
    overflow: auto;
  }

  .map-sidebar,
  .caught-sidebar {
    width: 100%;
    flex-basis: auto;
    height: 350px;
  }
}
</style>
