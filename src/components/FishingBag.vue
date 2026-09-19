<script setup lang="ts">
import { ref } from "vue";
import { useFishingStore, type CaughtFish } from "../stores/fishing";

const store = useFishingStore();
const selectedFishToRelease = ref<CaughtFish | null>(null);
const isReleasing = ref(false);

function openReleaseConfirm(fish: CaughtFish) {
  selectedFishToRelease.value = fish;
}

function cancelRelease() {
  selectedFishToRelease.value = null;
}

async function handleRelease() {
  if (!selectedFishToRelease.value) return;
  isReleasing.value = true;
  try {
    await store.releaseFish(selectedFishToRelease.value.id);
    selectedFishToRelease.value = null;
  } catch (err) {
    console.error("Lỗi khi thả cá:", err);
  } finally {
    isReleasing.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="bag-dialog">
      <div
        v-if="store.bagOpen"
        class="fixed z-[31] inset-0 grid place-items-center p-5 bg-[rgba(4,17,11,0.72)] backdrop-blur-[7px]"
        role="presentation"
        @click.self="store.closeBag"
      >
        <section
          class="w-[min(460px,100%)] max-h-[min(580px,80vh)] overflow-auto border border-[rgba(255,226,149,0.68)] rounded-[20px] bg-[linear-gradient(145deg,#173d2b,#0e281b)] shadow-[0_24px_70px_rgba(0,0,0,0.48)] text-[#f4f0df]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bag-title"
        >
          <header class="flex justify-between items-start px-5 pt-[19px] pb-3.5 border-b border-[rgba(223,241,207,0.14)]">
            <div>
              <p class="m-0 text-[#e8bd62] text-[10px] font-black tracking-[0.16em] uppercase">Túi cá</p>
              <h2 id="bag-title" class="mt-1.5 mb-0 text-xl">Thành quả câu được</h2>
            </div>
            <button
              type="button"
              class="w-[29px] h-[29px] border-0 rounded-full bg-[rgba(235,243,219,0.13)] text-white cursor-pointer text-[22px] leading-none"
              aria-label="Đóng túi cá"
              @click="store.closeBag"
            >
              ×
            </button>
          </header>
          <p v-if="!store.inventory.length" class="py-[35px] px-5 text-[#b7cfb9] text-center text-[13px]">Túi còn trống. Hãy ra hồ câu một con cá!</p>
          <ul v-else class="grid gap-[9px] m-0 p-[13px] list-none">
            <li
              v-for="fish in store.inventory"
              :key="fish.id"
              class="flex items-center justify-between gap-3 p-2 border border-[rgba(223,241,207,0.15)] rounded-xl bg-[rgba(7,28,18,0.35)]"
            >
              <div class="flex items-center gap-3 min-w-0">
                <img :src="fish.image" :alt="fish.name" class="w-[74px] h-12 rounded-lg object-cover flex-shrink-0" />
                <div class="grid gap-0.5 min-w-0">
                  <span class="text-[#e8bd62] text-[9px] font-black tracking-[0.09em] uppercase">{{ fish.rarity }}</span>
                  <strong class="text-sm truncate">{{ fish.name }}</strong>
                  <small class="text-[#b7cfb9] text-[11px]">{{ fish.weight }} · {{ fish.length }}</small>
                </div>
              </div>
              <button
                type="button"
                class="flex-shrink-0 px-3 py-1.5 border border-[rgba(235,110,110,0.4)] rounded-lg bg-[rgba(194,59,59,0.2)] hover:bg-[rgba(194,59,59,0.4)] text-[#ffaaaa] hover:text-white text-xs font-bold transition-colors cursor-pointer"
                @click.stop="openReleaseConfirm(fish)"
              >
                Thả
              </button>
            </li>
          </ul>
        </section>
      </div>
    </Transition>

    <!-- Dialog xác nhận thả cá -->
    <Transition name="bag-dialog">
      <div
        v-if="selectedFishToRelease"
        class="fixed z-[32] inset-0 grid place-items-center p-5 bg-[rgba(4,17,11,0.82)] backdrop-blur-[8px]"
        role="presentation"
        @click.self="cancelRelease"
      >
        <div
          class="w-[min(380px,100%)] p-5 border border-[rgba(255,226,149,0.5)] rounded-[20px] bg-[linear-gradient(145deg,#1b4531,#0f2e1f)] shadow-[0_24px_70px_rgba(0,0,0,0.6)] text-[#f4f0df] text-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-release-title"
        >
          <h3 id="confirm-release-title" class="m-0 text-lg font-bold text-[#e8bd62]">Xác nhận thả cá</h3>
          <p class="my-4 text-sm text-[#c8dccb] leading-relaxed">
            Bạn có chắc chắn muốn thả <strong class="text-white">{{ selectedFishToRelease.name }}</strong> ({{ selectedFishToRelease.weight }}) về lại hồ không?
          </p>
          <div class="flex justify-center gap-3 mt-5">
            <button
              type="button"
              class="px-4 py-2 border border-[rgba(255,255,255,0.2)] rounded-xl bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.2)] text-white text-xs font-semibold transition-colors cursor-pointer"
              @click="cancelRelease"
            >
              Hủy
            </button>
            <button
              type="button"
              class="px-4 py-2 border border-[#e65c5c] rounded-xl bg-[#c23b3b] hover:bg-[#d94848] text-white text-xs font-bold shadow-[0_4px_12px_rgba(194,59,59,0.4)] transition-colors cursor-pointer disabled:opacity-50"
              :disabled="isReleasing"
              @click="handleRelease"
            >
              {{ isReleasing ? 'Đang thả...' : 'Xác nhận thả' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.bag-dialog-enter-active,
.bag-dialog-leave-active {
  transition: opacity 0.18s ease;
}
.bag-dialog-enter-from,
.bag-dialog-leave-to {
  opacity: 0;
}
</style>
