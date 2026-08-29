<script setup lang="ts">
import { useFishingStore } from "../stores/fishing";

const store = useFishingStore();
</script>

<template>
  <Teleport to="body">
    <Transition name="players-dialog">
      <div v-if="store.playersOpen" class="players-backdrop" @click.self="store.closePlayers">
        <section class="players-card" role="dialog" aria-modal="true" aria-labelledby="players-title">
          <header>
            <div><p>Cùng bãi câu</p><h2 id="players-title">Người chơi đang câu</h2></div>
            <button type="button" aria-label="Đóng danh sách" @click="store.closePlayers">×</button>
          </header>
          <p class="players-note">Chạm vào người chơi để xem thông tin.</p>
          <ul v-if="!store.selectedPlayer">
            <li v-for="player in store.nearbyPlayers" :key="player.id">
              <button type="button" @click="store.selectPlayer(player)">
                <span class="avatar" :style="{ background: player.color }">{{ player.avatar }}</span>
                <span class="identity"><strong>{{ player.name }}</strong><small>Cấp {{ player.level }} · {{ player.title }}</small></span>
                <span class="view">Xem ›</span>
              </button>
            </li>
          </ul>
          <article v-else class="player-profile">
            <button type="button" class="back" @click="store.selectedPlayer = null">‹ Danh sách</button>
            <span class="avatar large" :style="{ background: store.selectedPlayer.color }">{{ store.selectedPlayer.avatar }}</span>
            <h3>{{ store.selectedPlayer.name }}</h3><p>Cấp {{ store.selectedPlayer.level }} · {{ store.selectedPlayer.title }}</p>
            <div class="stats"><span><b>{{ store.selectedPlayer.caughtCount }}</b>Cá đã câu</span><span><b>{{ store.selectedPlayer.bestCatch }}</b>Kỷ lục</span></div>
          </article>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.players-backdrop { position: fixed; z-index: 31; inset: 0; display: grid; place-items: center; padding: 20px; background: rgba(4, 17, 11, .72); backdrop-filter: blur(7px); }
.players-card { width: min(440px, 100%); overflow: hidden; border: 1px solid rgba(255, 226, 149, .68); border-radius: 20px; background: linear-gradient(145deg, #173d2b, #0e281b); box-shadow: 0 24px 70px rgba(0, 0, 0, .48); color: #f4f0df; }
header { display: flex; justify-content: space-between; padding: 19px 20px 12px; border-bottom: 1px solid rgba(223, 241, 207, .14); } header p, h2, .players-note, .player-profile p { margin: 0; } header p { color: #e8bd62; font-size: 10px; font-weight: 900; letter-spacing: .16em; text-transform: uppercase; } h2 { margin-top: 5px; font-size: 20px; } header button { width: 29px; height: 29px; border: 0; border-radius: 50%; background: rgba(235,243,219,.13); color: #fff; cursor: pointer; font-size: 22px; line-height: 1; }
.players-note { padding: 13px 20px 5px; color: #b7cfb9; font-size: 12px; } ul { display: grid; gap: 8px; margin: 0; padding: 12px; list-style: none; } li button { display: flex; align-items: center; width: 100%; gap: 11px; padding: 9px; border: 1px solid rgba(223,241,207,.15); border-radius: 12px; background: rgba(7,28,18,.35); color: inherit; cursor: pointer; text-align: left; } li button:hover { border-color: #d8b866; background: rgba(55, 91, 57, .5); }.avatar { display: grid; flex: 0 0 auto; place-items: center; width: 39px; height: 39px; border: 2px solid rgba(255,255,255,.35); border-radius: 50%; color: white; font-size: 11px; font-weight: 900; }.identity { display: grid; gap: 3px; }.identity strong { font-size: 14px; }.identity small { color: #b7cfb9; font-size: 10px; }.view { margin-left: auto; color: #e8bd62; font-size: 11px; font-weight: 800; }.player-profile { display: grid; justify-items: center; padding: 16px 20px 22px; text-align: center; }.back { justify-self: start; border: 0; background: transparent; color: #e8bd62; cursor: pointer; font-size: 12px; font-weight: 800; }.large { width: 66px; height: 66px; margin: 10px 0; font-size: 18px; }.player-profile h3 { margin: 0; font-size: 20px; }.player-profile p { margin-top: 4px; color: #b7cfb9; font-size: 12px; }.stats { display: grid; grid-template-columns: 1fr 1fr; width: 100%; gap: 8px; margin-top: 18px; }.stats span { display: grid; gap: 4px; padding: 11px 7px; border-radius: 10px; background: rgba(7,28,18,.38); color: #b7cfb9; font-size: 10px; }.stats b { color: #f4f0df; font-size: 13px; }.players-dialog-enter-active, .players-dialog-leave-active { transition: opacity .18s ease; }.players-dialog-enter-from, .players-dialog-leave-to { opacity: 0; }
</style>
