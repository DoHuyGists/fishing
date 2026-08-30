<script setup lang="ts">
import { useFishingStore } from "../stores/fishing";

const store = useFishingStore();
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
              class="flex items-center gap-3 p-2 border border-[rgba(223,241,207,0.15)] rounded-xl bg-[rgba(7,28,18,0.35)]"
            >
              <img :src="fish.image" :alt="fish.name" class="w-[74px] h-12 rounded-lg object-cover" />
              <div class="grid gap-0.5">
                <span class="text-[#e8bd62] text-[9px] font-black tracking-[0.09em]">{{ fish.rarity }}</span
                ><strong class="text-sm">{{ fish.name }}</strong
                ><small class="text-[#b7cfb9] text-[11px]">{{ fish.weight }} · {{ fish.length }}</small>
              </div>
            </li>
          </ul>
        </section>
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
