<script setup lang="ts">
import { useFishingStore } from "../stores/fishing";
const store = useFishingStore();
</script>
<template>
  <Teleport to="body"
    ><Transition name="guide-dialog"
      ><div
        v-if="store.lakeGuideOpen"
        class="fixed z-[31] inset-0 grid place-items-center p-5 bg-[rgba(4,17,11,0.72)] backdrop-blur-[7px]"
        @click.self="store.closeLakeGuide"
      >
        <section
          class="w-[min(500px,100%)] overflow-hidden border border-[rgba(255,226,149,0.68)] rounded-[20px] bg-[linear-gradient(145deg,#173d2b,#0e281b)] shadow-[0_24px_70px_rgba(0,0,0,0.48)] text-[#f4f0df]"
          role="dialog"
          aria-modal="true"
        >
          <header class="flex justify-between px-5 pt-[19px] pb-3 border-b border-[rgba(223,241,207,0.14)]">
            <div>
              <p class="m-0 text-[#e8bd62] text-[10px] font-black tracking-[0.16em] uppercase">Sổ tay bãi câu</p>
              <h2 class="m-0 mt-1.5 text-xl">Cá trong hồ</h2>
            </div>
            <button
              type="button"
              class="w-[29px] h-[29px] border-0 rounded-full bg-[rgba(235,243,219,0.13)] text-white cursor-pointer text-[22px] leading-none"
              @click="store.closeLakeGuide"
            >
              ×
            </button>
          </header>
          <p class="m-0 px-5 py-8 text-center text-[#b7cfb9] text-[12px]">
            Thông tin loài cá sẽ chỉ xuất hiện sau khi hoàn thành thử thách.
          </p>
        </section>
      </div></Transition
    ></Teleport
  >
</template>
<style scoped>
.guide-dialog-enter-active,
.guide-dialog-leave-active {
  transition: opacity 0.18s ease;
}
.guide-dialog-enter-from,
.guide-dialog-leave-to {
  opacity: 0;
}
</style>
