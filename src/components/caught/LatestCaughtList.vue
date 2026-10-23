<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { supabaseFishRepository } from "../../data/supabaseFishRepository";
import { useMarketStore } from "../../stores/market";
import { useAuthStore } from "../../stores/auth";
import { useCaughtStore } from "../../stores/caught";
import FishSellConfirm from "./FishSellConfirm.vue";
import FishReleaseConfirm from "./FishReleaseConfirm.vue";
const marketStore = useMarketStore();
const fishToSell = ref<any | null>(null);
const fishToRelease = ref<any | null>(null);
const isSellingFish = ref(false);
const isReleasingFish = ref(false);
const fishActionError = ref("");
const authStore = useAuthStore();
const caughtStore = useCaughtStore();

const recentCaughtFishes = computed(() =>
  caughtStore.inNetFishes,
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
</script>
<template>
    <section class="mt-3 w-full max-w-sm rounded-xl border border-emerald-900/15 bg-white/95 p-3 shadow-sm">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="m-0 text-sm font-bold text-[#153221]">Cá trong lưới</h2>
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
            <img :src="fish.species?.image || '/fish/VN/fish.jpg'" :alt="fish.species?.name || 'Cá'" class="h-10 w-1/3 shrink-0 rounded-md object-cover" />
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

      <FishSellConfirm :fish="fishToSell" :is-loading="isSellingFish" :error="fishActionError" @cancel="fishToSell = null" @confirm="sellFish" />
      <FishReleaseConfirm :fish="fishToRelease" :is-loading="isReleasingFish" @cancel="fishToRelease = null" @confirm="releaseFish" />
</template>
