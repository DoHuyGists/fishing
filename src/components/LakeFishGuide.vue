<script setup lang="ts">
import { useFishingStore } from "../stores/fishing";
const store = useFishingStore();
</script>
<template>
  <Teleport to="body"
    ><Transition name="guide-dialog"
      ><div v-if="store.lakeGuideOpen" class="guide-backdrop" @click.self="store.closeLakeGuide">
        <section class="guide-card" role="dialog" aria-modal="true">
          <header>
            <div>
              <p>Sổ tay bãi câu</p>
              <h2>Cá trong hồ</h2>
            </div>
            <button type="button" @click="store.closeLakeGuide">×</button>
          </header>
          <div class="gear">
            Mồi: <b>{{ store.currentBait }}</b> · Cần {{ store.equipment.rodMaxWeight }} kg · Dây
            {{ store.equipment.lineMaxWeight }} kg · Mòn máy {{ store.equipment.reelWearPercent }}%
          </div>
          <ul>
            <li v-for="entry in store.fishCatchChances" :key="entry.fish.id">
              <img :src="entry.fish.image" :alt="entry.fish.name" />
              <div>
                <strong>{{ entry.fish.name }}</strong
                ><small
                  >{{ entry.fish.weight }} kg · Ưa {{ entry.fish.favoriteBait }} · Kháng cự
                  {{ Math.round(entry.fish.resistance * 100) }}%</small
                >
              </div>
              <div class="rates">
                <b>{{ entry.catch }}%</b><small>Tỉ lệ bắt</small><span>Cắn câu {{ entry.bite }}%</span>
              </div>
            </li>
          </ul>
          <p class="hint">Tỉ lệ bắt đã tính theo tải cần/dây, độ mòn máy và kỹ năng hiện tại.</p>
        </section>
      </div></Transition
    ></Teleport
  >
</template>
<style scoped>
.guide-backdrop {
  position: fixed;
  z-index: 31;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(4, 17, 11, 0.72);
  backdrop-filter: blur(7px);
}
.guide-card {
  width: min(500px, 100%);
  overflow: hidden;
  border: 1px solid rgba(255, 226, 149, 0.68);
  border-radius: 20px;
  background: linear-gradient(145deg, #173d2b, #0e281b);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.48);
  color: #f4f0df;
}
header {
  display: flex;
  justify-content: space-between;
  padding: 19px 20px 12px;
  border-bottom: 1px solid rgba(223, 241, 207, 0.14);
}
header p,
h2,
.hint {
  margin: 0;
}
header p {
  color: #e8bd62;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
h2 {
  margin-top: 5px;
  font-size: 20px;
}
header button {
  width: 29px;
  height: 29px;
  border: 0;
  border-radius: 50%;
  background: rgba(235, 243, 219, 0.13);
  color: #fff;
  cursor: pointer;
  font-size: 22px;
  line-height: 1;
}
.gear {
  margin: 13px;
  padding: 10px;
  border-radius: 10px;
  background: rgba(7, 28, 18, 0.36);
  color: #b7cfb9;
  font-size: 11px;
}
.gear b {
  color: #f3da94;
}
ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0 13px;
  list-style: none;
}
li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border: 1px solid rgba(223, 241, 207, 0.15);
  border-radius: 12px;
  background: rgba(7, 28, 18, 0.35);
}
li img {
  width: 68px;
  height: 44px;
  border-radius: 7px;
  object-fit: cover;
}
li div {
  display: grid;
  gap: 3px;
}
li strong {
  font-size: 13px;
}
li small,
.hint {
  color: #b7cfb9;
  font-size: 10px;
}
.rates {
  margin-left: auto;
  text-align: right;
}
.rates b {
  color: #e8bd62;
  font-size: 18px;
}
.rates span {
  color: #8fc87b;
  font-size: 9px;
}
.hint {
  padding: 13px 20px 18px;
  text-align: center;
}
.guide-dialog-enter-active,
.guide-dialog-leave-active {
  transition: opacity 0.18s ease;
}
.guide-dialog-enter-from,
.guide-dialog-leave-to {
  opacity: 0;
}
</style>
