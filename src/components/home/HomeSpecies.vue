<script setup lang="ts">
import { t as tr } from "../../i18n";
import { useHomeSpeciesCarousel } from "../../composables/useHomeSpeciesCarousel";
import HomeImage from "./HomeImage.vue";

const { carousel, page, pages, items, position, perPage, animate, inView, finishTransition, isVisible, autoplayEnabled, reducedMotion, isPlaying, hovered, focused, select, onKeydown, onFocusOut } = useHomeSpeciesCarousel();
</script>

<template>
  <section
    id="bo-suu-tap"
    ref="carousel"
    class="scroll-mt-6 border-t border-border-default"
    aria-labelledby="home-species-title"
    :aria-roledescription="tr('HomeView.species_carousel')"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
    @focusin="focused = true"
    @focusout="onFocusOut"
    @keydown="onKeydown"
  >
    <div class="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
      <div class="flex flex-wrap items-end justify-between gap-5">
        <div id="home-species-title" role="heading" aria-level="2" class="max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{{ tr("HomeView.species_title") }}</div>
        <span class="rounded-full border border-border-default px-4 py-2 text-sm font-semibold text-sky">{{ tr("HomeView.species_sample") }}</span>
      </div>
      <div id="home-species-slides" class="mt-10 overflow-hidden rounded-2xl">
        <div class="home-species-track flex" :style="{ transform: `translate3d(-${position * 100 / perPage}%, 0, 0)`, transition: animate ? undefined : 'none' }" @transitionend.self="finishTransition">
          <div
            v-for="(fish, index) in items"
            :key="`${fish.id}-${index}`"
            role="group"
            :aria-roledescription="tr('HomeView.species_slide')"
            :aria-label="tr(fish.nameKey)"
            :aria-hidden="!isVisible(index)"
            :inert="!isVisible(index)"
            :style="{ width: `${100 / perPage}%` }"
            class="shrink-0 px-2 lg:px-3"
          >
            <div class="h-full overflow-hidden rounded-2xl border border-border-default bg-white">
              <HomeImage :src="fish.src" :alt="tr(fish.nameKey)" :width="480" :height="270" :priority="inView" fit="contain" class="aspect-video w-full bg-white" />
              <div class="grid gap-2 border-t border-border-default px-4 py-5 sm:px-6">
                <div class="text-base font-bold sm:text-lg">{{ tr(fish.nameKey) }}</div>
                <span class="text-sm text-sky">{{ tr(fish.habitatKey) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div role="group" :aria-label="tr('HomeView.species_controls')" class="flex flex-wrap gap-2">
          <button type="button" aria-controls="home-species-slides" class="min-h-11 rounded-full border border-border-default bg-surface px-4 py-2 text-sm font-semibold hover:bg-primary" @click="select(page - 1)">{{ tr("HomeView.species_previous") }}</button>
          <button type="button" aria-controls="home-species-slides" class="min-h-11 rounded-full border border-border-default bg-surface px-4 py-2 text-sm font-semibold hover:bg-primary" @click="select(page + 1)">{{ tr("HomeView.species_next") }}</button>
          <button type="button" aria-controls="home-species-slides" :disabled="reducedMotion" class="min-h-11 rounded-full border border-border-default bg-surface px-4 py-2 text-sm font-semibold hover:bg-primary disabled:cursor-default disabled:opacity-70" @click="autoplayEnabled = !autoplayEnabled">
            {{ reducedMotion ? tr("HomeView.species_motion_disabled") : autoplayEnabled ? tr("HomeView.species_pause") : tr("HomeView.species_resume") }}
          </button>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <span class="text-sm" :aria-live="isPlaying ? 'off' : 'polite'" aria-atomic="true">{{ tr("HomeView.species_position", { current: page + 1, total: pages.length }) }}</span>
          <div role="group" :aria-label="tr('HomeView.species_pages')" class="flex">
            <button v-for="(_, index) in pages" :key="index" type="button" :aria-label="tr('HomeView.species_go_to', { page: index + 1 })" :aria-current="index === page ? 'true' : undefined" aria-controls="home-species-slides" class="grid size-11 place-items-center rounded-full" @click="select(index)">
              <span class="h-2 rounded-full" :class="index === page ? 'w-5 bg-accent' : 'w-2 bg-sky'" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
