<script setup lang="ts">
import { t as tr } from "../../../i18n";

import { useFishingStore } from "../../../stores/player-fishing-store";

const store = useFishingStore();
</script>

<template>
  <Teleport to="body">
    <Transition name="player-popup" :duration="{ enter: 220, leave: 150 }">
      <div
        v-if="store.playersOpen"
        class="fixed z-[31] inset-0 grid place-items-center p-5 bg-ocean-deep/75 backdrop-blur-[7px]"
        @click.self="store.closePlayers"
      >
        <section
          class="player-popup-panel w-[min(440px,100%)] overflow-hidden border border-ocean-gold/70 rounded-[20px] bg-linear-to-br from-ocean-panel to-ocean-deep shadow-[0_24px_70px_color-mix(in_srgb,_var(--color-content)_48%,_transparent)] text-ocean-pearl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="players-title"
        >
          <header class="flex justify-between px-5 pt-[19px] pb-3 border-b border-ocean-gold/20 text-ocean-gold">
            <div>
              <div id="players-title" class="m-0 text-xl">
                {{ tr("FishingPlayers.nguoi_choi_dang_cau") }}{{ store.nearbyPlayers.length }})
              </div>
            </div>
            <button
              type="button"
              class="w-[29px] h-[29px] border-0 rounded-full bg-ocean-cyan/15 text-white cursor-pointer text-[22px] leading-none"
              :aria-label="tr('FishingPlayers.dong_danh_sach')"
              @click="store.closePlayers"
            >
              ×
            </button>
          </header>
          <!-- <div class="px-5 pt-3 pb-1.5 text-border-strong text-xs">Chạm vào người chơi để xem thông tin.</div> -->
          <div v-if="store.isLoadingPlayers" class="py-8 text-center text-border-strong text-xs">
            {{ tr("FishingPlayers.dang_cap_nhat_danh_sach_nguoi_cau") }}
          </div>
          <div
            v-else-if="!store.selectedPlayer && !store.nearbyPlayers.length"
            class="py-8 px-4 text-center text-border-strong text-xs"
          >
            <span class="text-2xl mb-1 block">🎣</span>
            <div class="m-0">{{ tr("FishingPlayers.hien_chua_co_nguoi_choi_nao_trong_khu_vuc_nay") }}</div>
          </div>
          <div v-else-if="!store.selectedPlayer" class="grid gap-2 m-0 p-3 list-none">
            <div v-for="player in store.nearbyPlayers" :key="player.id">
              <button
                type="button"
                class="flex items-center w-full gap-[11px] p-2.5 border rounded-xl bg-ocean-deep/40 text-inherit cursor-pointer text-left hover:border-ocean-gold hover:bg-ocean-panel transition-colors"
                :class="
                  player.isCurrentUser
                    ? 'border-ocean-cyan/60 bg-ocean-cyan/10'
                    : 'border-ocean-cyan/20'
                "
                @click="store.selectPlayer(player)"
              >
                <span
                  class="grid flex-none place-items-center w-[39px] h-[39px] border-1 border-[color-mix(in_srgb,_var(--color-white)_35%,_transparent)] rounded-full text-white text-[11px] font-black"
                  :style="{ background: player.color }"
                  >{{ player.avatar }}</span
                >
                <span class="grid gap-[3px]">
                  <strong class="text-sm flex items-center gap-1.5">
                    {{ player.name }}
                  </strong>
                  <small class="text-border-strong text-[10px]"
                    >{{ tr("FishPond.cap") }} {{ player.level }} · {{ player.title }}</small
                  >
                </span>
                <span class="ml-auto text-ocean-gold text-[11px] font-extrabold">{{ tr("FishingPlayers.xem") }}</span>
              </button>
            </div>
          </div>
          <article v-else class="grid justify-items-center px-5 pt-4 pb-[22px] text-center">
            <button
              type="button"
              class="justify-self-start border-0 bg-transparent text-ocean-gold cursor-pointer text-xs font-extrabold"
              @click="store.selectedPlayer = null"
            >
              {{ tr("FishingPlayers.danh_sach") }}
            </button>
            <span
              class="grid place-items-center w-[66px] h-[66px] my-2.5 border-1 border-[color-mix(in_srgb,_var(--color-white)_35%,_transparent)] rounded-full text-white text-lg font-black"
              :style="{ background: store.selectedPlayer.color }"
              >{{ store.selectedPlayer.avatar }}</span
            >
            <div class="m-0 text-xl">{{ store.selectedPlayer.name }}</div>
            <div class="mt-1 text-border-strong text-xs">
              {{ tr("FishPond.cap") }} {{ store.selectedPlayer.level }} · {{ store.selectedPlayer.title }}
            </div>
            <div class="grid grid-cols-2 w-full gap-2 mt-[18px]">
              <span
                class="grid gap-1 py-[11px] px-1.5 rounded-[10px] bg-ocean-deep/40 text-border-strong text-[10px]"
                ><b class="text-ocean-pearl text-[13px]">{{ store.selectedPlayer.caughtCount }}</b
                >{{ tr("FishingPlayers.ca_da_cau") }}</span
              >
              <span
                class="grid gap-1 py-[11px] px-1.5 rounded-[10px] bg-ocean-deep/40 text-border-strong text-[10px]"
                ><b class="text-ocean-pearl text-[13px]">{{ store.selectedPlayer.bestCatch }}</b
                >{{ tr("FishingPlayers.ky_luc") }}</span
              >
            </div>
          </article>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
