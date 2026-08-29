<script setup lang="ts">
import { useFishingStore } from "../stores/fishing";

const store = useFishingStore();
</script>

<template>
  <Teleport to="body">
    <Transition name="bag-dialog">
      <div v-if="store.bagOpen" class="bag-backdrop" role="presentation" @click.self="store.closeBag">
        <section class="bag-card" role="dialog" aria-modal="true" aria-labelledby="bag-title">
          <header>
            <div>
              <p>Túi cá</p>
              <h2 id="bag-title">Thành quả câu được</h2>
            </div>
            <button type="button" aria-label="Đóng túi cá" @click="store.closeBag">×</button>
          </header>
          <p v-if="!store.inventory.length" class="empty-bag">Túi còn trống. Hãy ra hồ câu một con cá!</p>
          <ul v-else>
            <li v-for="fish in store.inventory" :key="fish.id">
              <img :src="fish.image" :alt="fish.name" />
              <div>
                <span>{{ fish.rarity }}</span
                ><strong>{{ fish.name }}</strong
                ><small>{{ fish.weight }} · {{ fish.length }}</small>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.bag-backdrop {
  position: fixed;
  z-index: 31;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(4, 17, 11, 0.72);
  backdrop-filter: blur(7px);
}
.bag-card {
  width: min(460px, 100%);
  max-height: min(580px, 80vh);
  overflow: auto;
  border: 1px solid rgba(255, 226, 149, 0.68);
  border-radius: 20px;
  background: linear-gradient(145deg, #173d2b, #0e281b);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.48);
  color: #f4f0df;
}
.bag-card header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 19px 20px 14px;
  border-bottom: 1px solid rgba(223, 241, 207, 0.14);
}
.bag-card p {
  margin: 0;
}
.bag-card header p {
  color: #e8bd62;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.bag-card h2 {
  margin: 5px 0 0;
  font-size: 20px;
}
.bag-card header button {
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
.empty-bag {
  padding: 35px 20px;
  color: #b7cfb9;
  text-align: center;
  font-size: 13px;
}
.bag-card ul {
  display: grid;
  gap: 9px;
  margin: 0;
  padding: 13px;
  list-style: none;
}
.bag-card li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border: 1px solid rgba(223, 241, 207, 0.15);
  border-radius: 12px;
  background: rgba(7, 28, 18, 0.35);
}
.bag-card li img {
  width: 74px;
  height: 48px;
  border-radius: 8px;
  object-fit: cover;
}
.bag-card li div {
  display: grid;
  gap: 2px;
}
.bag-card li span {
  color: #e8bd62;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.09em;
}
.bag-card li strong {
  font-size: 14px;
}
.bag-card li small {
  color: #b7cfb9;
  font-size: 11px;
}
.bag-dialog-enter-active,
.bag-dialog-leave-active {
  transition: opacity 0.18s ease;
}
.bag-dialog-enter-from,
.bag-dialog-leave-to {
  opacity: 0;
}
</style>
