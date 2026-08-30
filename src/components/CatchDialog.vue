<script setup lang="ts">
import { computed } from "vue";
import { useFishingStore } from "../stores/fishing";

const store = useFishingStore();
const caught = computed(() => store.inventory[0]);
</script>

<template>
  <Teleport to="body">
    <Transition name="catch-dialog">
      <div
        v-if="store.catchDialogOpen && caught"
        class="fixed z-30 inset-0 grid place-items-center p-5 bg-[rgba(4,17,11,0.72)] backdrop-blur-[7px]"
        role="presentation"
        @click.self="store.closeCatchDialog"
      >
        <section
          class="catch-card w-[min(360px,100%)] overflow-hidden border border-[rgba(255,226,149,0.68)] rounded-[22px] bg-[linear-gradient(145deg,#173d2b,#0e281b)] shadow-[0_24px_70px_rgba(0,0,0,0.48)] text-center text-[#f4f0df]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="catch-title"
        >
          <p class="mt-[19px] mb-2.5 text-[#e8bd62] text-[10px] font-black tracking-[0.16em] uppercase">Cú câu thành công</p>
          <img :src="caught.image" :alt="caught.name" class="block w-[calc(100%-28px)] h-[178px] mx-3.5 rounded-[14px] object-cover" />
          <div class="px-5 pt-3.5 pb-3">
            <span class="inline-block px-2 py-1 rounded-full bg-[#dcae52] text-[#254130] text-[9px] font-black tracking-[0.1em]">{{ caught.rarity }}</span>
            <h2 id="catch-title" class="mt-2 mb-[3px] text-2xl">{{ caught.name }}</h2>
            <p class="m-0 text-[#b7cfb9] text-[13px]">{{ caught.weight }} · {{ caught.length }}</p>
            <small class="block mt-1.5 text-[#e8bd62] text-[11px] font-bold">Tỉ lệ bắt lúc kéo: {{ caught.chance }}%</small>
          </div>
          <button
            type="button"
            class="w-[calc(100%-40px)] mx-5 mt-1 mb-5 p-3 border-0 rounded-[10px] bg-[#e1aa49] text-[#173223] cursor-pointer font-black"
            @click="store.closeCatchDialog"
          >
            Câu tiếp
          </button>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.catch-dialog-enter-active,
.catch-dialog-leave-active {
  transition: opacity 0.2s ease;
}
.catch-dialog-enter-active .catch-card,
.catch-dialog-leave-active .catch-card {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}
.catch-dialog-enter-from,
.catch-dialog-leave-to {
  opacity: 0;
}
.catch-dialog-enter-from .catch-card,
.catch-dialog-leave-to .catch-card {
  opacity: 0;
  transform: translateY(16px) scale(0.96);
}
</style>
