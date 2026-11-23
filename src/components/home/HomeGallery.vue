<script setup lang="ts">
import { t as tr } from "../../i18n";
import { useHomeGallery } from "../../composables/useHomeGallery";
import HomeImage from "./HomeImage.vue";

const { scenes, selectedIndex, scene, select, onKeydown } = useHomeGallery();
</script>

<template>
  <section id="khung-canh" class="mx-auto max-w-7xl scroll-mt-6 px-5 py-16 sm:px-8 sm:py-24" aria-labelledby="home-gallery-title">
    <div class="mb-9 flex flex-wrap items-end justify-between gap-5">
      <div id="home-gallery-title" role="heading" aria-level="2" class="max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{{ tr("HomeView.gallery_title") }}</div>
      <span class="text-sm font-semibold text-sky">{{ tr("HomeView.gallery_source") }}</span>
    </div>
    <div role="tablist" :aria-label="tr('HomeView.gallery_controls')" class="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4" @keydown="onKeydown">
      <button v-for="(item, index) in scenes" :id="`scene-tab-${item.id}`" :key="item.id" type="button" role="tab" :aria-selected="index === selectedIndex" :aria-controls="`scene-panel-${item.id}`" :tabindex="index === selectedIndex ? 0 : -1" class="min-h-12 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors motion-reduce:transition-none" :class="index === selectedIndex ? 'border-accent bg-accent text-white' : 'border-border-default bg-surface text-content hover:bg-primary'" @click="select(index)">
        {{ tr(item.titleKey) }}
      </button>
    </div>
    <div v-for="item in scenes" :id="`scene-panel-${item.id}`" :key="item.id" v-show="item.id === scene.id" role="tabpanel" :aria-labelledby="`scene-tab-${item.id}`" tabindex="0" class="overflow-hidden rounded-2xl border border-border-default bg-primary">
      <HomeImage v-if="item.id === scene.id" :src="item.src" :alt="tr(item.altKey)" :width="1200" :height="675" class="slide-fade-in player-content-in from-bottom aspect-video w-full" />
      <div class="grid gap-3 p-5 sm:grid-cols-[1fr_2fr] sm:gap-8 sm:p-7">
        <span class="text-xl font-bold">{{ tr(item.titleKey) }}</span>
        <div class="text-base leading-relaxed">{{ tr(item.descriptionKey) }}</div>
      </div>
    </div>
  </section>
</template>
