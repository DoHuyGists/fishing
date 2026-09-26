<script setup lang="ts">
import { useFishingStore } from "../stores/fishing";

const store = useFishingStore();
</script>

<template>
  <Teleport to="body">
    <Transition name="players-dialog">
      <div v-if="store.playersOpen"
        class="fixed z-[31] inset-0 grid place-items-center p-5 bg-[rgba(4,17,11,0.72)] backdrop-blur-[7px]"
        @click.self="store.closePlayers">
        <section
          class="w-[min(440px,100%)] overflow-hidden border border-[rgba(255,226,149,0.68)] rounded-[20px] bg-[linear-gradient(145deg,#173d2b,#0e281b)] shadow-[0_24px_70px_rgba(0,0,0,0.48)] text-[#f4f0df]"
          role="dialog" aria-modal="true" aria-labelledby="players-title">
          <header class="flex justify-between px-5 pt-[19px] pb-3 border-b border-[rgba(223,241,207,0.14)]">
            <div>
              <p class="m-0 text-[#e8bd62] text-[10px] font-black tracking-[0.16em] uppercase">Cùng bãi câu</p>
              <h2 id="players-title" class="mt-1.5 mb-0 text-xl">Người chơi đang câu</h2>
            </div>
            <button type="button"
              class="w-[29px] h-[29px] border-0 rounded-full bg-[rgba(235,243,219,0.13)] text-white cursor-pointer text-[22px] leading-none"
              aria-label="Đóng danh sách" @click="store.closePlayers">
              ×
            </button>
          </header>
          <p class="px-5 pt-3 pb-1.5 text-[#b7cfb9] text-xs">Chạm vào người chơi để xem thông tin.</p>
          <ul v-if="!store.selectedPlayer" class="grid gap-2 m-0 p-3 list-none">
            <li v-for="player in store.nearbyPlayers" :key="player.id">
              <button type="button"
                class="flex items-center w-full gap-[11px] p-2.5 border border-[rgba(223,241,207,0.15)] rounded-xl bg-[rgba(7,28,18,0.35)] text-inherit cursor-pointer text-left hover:border-[#d8b866] hover:bg-[rgba(55,91,57,0.5)]"
                @click="store.selectPlayer(player)">
                <span
                  class="grid flex-none place-items-center w-[39px] h-[39px] border-1 border-[rgba(255,255,255,0.35)] rounded-full text-white text-[11px] font-black"
                  :style="{ background: player.color }">{{ player.avatar }}</span>
                <span class="grid gap-[3px]"><strong class="text-sm">{{ player.name }}</strong><small
                    class="text-[#b7cfb9] text-[10px]">Cấp {{ player.level }} · {{ player.title }}</small></span>
                <span class="ml-auto text-[#e8bd62] text-[11px] font-extrabold">Xem ›</span>
              </button>
            </li>
          </ul>
          <article v-else class="grid justify-items-center px-5 pt-4 pb-[22px] text-center">
            <button type="button"
              class="justify-self-start border-0 bg-transparent text-[#e8bd62] cursor-pointer text-xs font-extrabold"
              @click="store.selectedPlayer = null">
              ‹ Danh sách
            </button>
            <span
              class="grid place-items-center w-[66px] h-[66px] my-2.5 border-1 border-[rgba(255,255,255,0.35)] rounded-full text-white text-lg font-black"
              :style="{ background: store.selectedPlayer.color }">{{ store.selectedPlayer.avatar }}</span>
            <h3 class="m-0 text-xl">{{ store.selectedPlayer.name }}</h3>
            <p class="mt-1 text-[#b7cfb9] text-xs">Cấp {{ store.selectedPlayer.level }} · {{ store.selectedPlayer.title
              }}</p>
            <div class="grid grid-cols-2 w-full gap-2 mt-[18px]">
              <span
                class="grid gap-1 py-[11px] px-1.5 rounded-[10px] bg-[rgba(7,28,18,0.38)] text-[#b7cfb9] text-[10px]"><b
                  class="text-[#f4f0df] text-[13px]">{{ store.selectedPlayer.caughtCount }}</b>Cá đã câu</span>
              <span
                class="grid gap-1 py-[11px] px-1.5 rounded-[10px] bg-[rgba(7,28,18,0.38)] text-[#b7cfb9] text-[10px]"><b
                  class="text-[#f4f0df] text-[13px]">{{ store.selectedPlayer.bestCatch }}</b>Kỷ lục</span>
            </div>
          </article>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.players-dialog-enter-active,
.players-dialog-leave-active {
  transition: opacity 0.18s ease;
}

.players-dialog-enter-from,
.players-dialog-leave-to {
  opacity: 0;
}
</style>
