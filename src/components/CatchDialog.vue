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
        class="dialog-backdrop"
        role="presentation"
        @click.self="store.closeCatchDialog"
      >
        <section class="catch-card" role="dialog" aria-modal="true" aria-labelledby="catch-title">
          <p class="eyebrow">Cú câu thành công</p>
          <img :src="caught.image" :alt="caught.name" class="fish-image" />
          <div class="catch-details">
            <span class="rarity">{{ caught.rarity }}</span>
            <h2 id="catch-title">{{ caught.name }}</h2>
            <p>{{ caught.weight }} · {{ caught.length }}</p>
            <small>Tỉ lệ bắt lúc kéo: {{ caught.chance }}%</small>
          </div>
          <button type="button" @click="store.closeCatchDialog">Câu tiếp</button>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  z-index: 30;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(4, 17, 11, 0.72);
  backdrop-filter: blur(7px);
}
.catch-card {
  width: min(360px, 100%);
  overflow: hidden;
  border: 1px solid rgba(255, 226, 149, 0.68);
  border-radius: 22px;
  background: linear-gradient(145deg, #173d2b, #0e281b);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.48);
  text-align: center;
  color: #f4f0df;
}
.eyebrow {
  margin: 19px 0 10px;
  color: #e8bd62;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.fish-image {
  display: block;
  width: calc(100% - 28px);
  height: 178px;
  margin: 0 14px;
  border-radius: 14px;
  object-fit: cover;
}
.catch-details {
  padding: 14px 20px 12px;
}
.rarity {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 999px;
  background: #dcae52;
  color: #254130;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.1em;
}
.catch-details h2 {
  margin: 8px 0 3px;
  font-size: 24px;
}
.catch-details p {
  margin: 0;
  color: #b7cfb9;
  font-size: 13px;
}
.catch-details small {
  display: block;
  margin-top: 6px;
  color: #e8bd62;
  font-size: 11px;
  font-weight: 700;
}
.catch-card button {
  width: calc(100% - 40px);
  margin: 4px 20px 20px;
  padding: 12px;
  border: 0;
  border-radius: 10px;
  background: #e1aa49;
  color: #173223;
  cursor: pointer;
  font-weight: 900;
}
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
