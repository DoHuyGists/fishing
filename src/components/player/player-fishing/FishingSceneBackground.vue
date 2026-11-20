<script setup lang="ts">
import { t as tr } from '../../../i18n';
import { useFishingSceneImage } from '../../../composables/useFishingSceneImage';

const props = defineProps<{ src: string; fallback: string; sceneKey: string }>();
const displayedImage = useFishingSceneImage(() => props.src, () => props.fallback, () => props.sceneKey);
</script>

<template>
  <Transition name="fishing-scene-background">
    <img
      v-if="displayedImage"
      :key="displayedImage"
      :src="displayedImage"
      :alt="tr('FishingScene.khung_canh_bai_cau')"
      class="fishing-scene-background"
      draggable="false"
    />
  </Transition>
</template>

<style scoped>
.fishing-scene-background {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  pointer-events: none;
  user-select: none;
}
</style>
