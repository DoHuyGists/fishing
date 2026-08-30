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
          <div class="m-[13px] p-2.5 rounded-[10px] bg-[rgba(7,28,18,0.36)] text-[#b7cfb9] text-[11px]">
            Mồi: <b class="text-[#f3da94]">{{ store.currentBait }}</b> · Cần {{ store.equipment.rodMaxWeight }} kg · Dây
            {{ store.equipment.lineMaxWeight }} kg · Mòn máy {{ store.equipment.reelWearPercent }}%
          </div>
          <ul class="grid gap-2 m-0 py-0 px-[13px] list-none">
            <li
              v-for="entry in store.fishCatchChances"
              :key="entry.fish.id"
              class="flex items-center gap-2.5 p-2 border border-[rgba(223,241,207,0.15)] rounded-xl bg-[rgba(7,28,18,0.35)]"
            >
              <img :src="entry.fish.image" :alt="entry.fish.name" class="w-[68px] h-11 rounded-[7px] object-cover" />
              <div class="grid gap-[3px]">
                <strong class="text-[13px]">{{ entry.fish.name }}</strong
                ><small class="text-[#b7cfb9] text-[10px]"
                  >{{ entry.fish.weight }} kg · Ưa {{ entry.fish.favoriteBait }} · Kháng cự
                  {{ Math.round(entry.fish.resistance * 100) }}%</small
                >
              </div>
              <div class="ml-auto text-right">
                <b class="text-[#e8bd62] text-lg">{{ entry.catch }}%</b><small class="text-[#b7cfb9] text-[10px]">Tỉ lệ bắt</small><span class="text-[#8fc87b] text-[9px]">Cắn câu {{ entry.bite }}%</span>
              </div>
            </li>
          </ul>
          <p class="m-0 pt-[13px] px-5 pb-[18px] text-center text-[#b7cfb9] text-[10px]">Tỉ lệ bắt đã tính theo tải cần/dây, độ mòn máy và kỹ năng hiện tại.</p>
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
