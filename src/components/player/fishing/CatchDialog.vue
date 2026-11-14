<script setup lang="ts">
import { t as tr } from "../../../i18n";

import { computed } from "vue";
import { useFishingStore } from "../../../stores/fishing";
import Fishthrash from "./Fishthrash.vue";

const store = useFishingStore();
const caught = computed(() => store.inventory[0]);
const variantFrameClass = computed(() => {
  switch (caught.value?.variantType) {
    case "GOLDEN":
      return "border-[#ffd54a] shadow-[0_24px_70px_rgba(255,190,45,0.38)]";
    case "MUTATED":
      return "border-[#b47cff] shadow-[0_24px_70px_rgba(150,75,255,0.38)]";
    default:
      return "border-[rgba(255,226,149,0.68)]";
  }
});
</script>

<template>
  <Teleport to="body">
    <Transition name="player-popup" :duration="{ enter: 220, leave: 150 }">
      <div
        v-if="store.catchDialogOpen && caught"
        class="fixed z-30 inset-0 grid place-items-center p-5 bg-[rgba(4,17,11,0.72)] backdrop-blur-[7px]"
        role="presentation"
        @click.self="store.closeCatchDialog"
      >
        <section
          class="player-popup-panel catch-card w-[min(360px,100%)] overflow-hidden border-2 rounded-[22px] bg-[linear-gradient(145deg,#173d2b,#0e281b)] shadow-[0_24px_70px_rgba(0,0,0,0.48)] text-center text-[#f4f0df]"
          :class="variantFrameClass"
          role="dialog"
          aria-modal="true"
          aria-labelledby="catch-title"
        >
          <div class="mt-[19px] mb-2.5 text-[#e8bd62] text-[10px] font-black tracking-[0.16em] uppercase">
            {{ tr('CatchDialog.cu_cau_thanh_cong') }}
          </div>
          <Fishthrash :src="caught.image" :width="240" />
          <div class="px-5 pt-3.5 pb-3">
            <span
              class="inline-block px-2 py-1 rounded-full bg-[#dcae52] text-[#254130] text-[9px] font-black tracking-[0.1em]"
              >{{ caught.variantType }}</span
            >
            <span
              v-if="caught.isShiny"
              class="inline-block ml-1 px-2 py-1 rounded-full bg-[#fff1a8] text-[#6b4b00] text-[9px] font-black tracking-widest"
              >{{ tr('CatchDialog.ca_xin') }}</span
            >
            <div
              v-if="caught.starRating !== undefined"
              class="mt-2 mb-0 text-[#ffd65a] text-sm font-black"
              :aria-label="`${caught.starRating} sao`"
            >
              {{ "★".repeat(Math.max(0, Math.floor(caught.starRating))) }}
            </div>
            <div id="catch-title" class="mt-2 mb-[3px] text-2xl">{{ caught.name }}</div>
            <div class="m-0 text-[#b7cfb9] text-[13px]">
              {{ caught.weight }}<span v-if="caught.length"> · {{ caught.length }}</span>
            </div>
          </div>
          <button
            type="button"
            class="w-[calc(100%-40px)] mx-5 mt-1 mb-5 p-3 border-0 rounded-[10px] bg-[#e1aa49] text-[#173223] cursor-pointer font-black"
            @click="store.closeCatchDialog"
          >
            {{ tr('CatchDialog.cau_tiep') }}
          </button>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
