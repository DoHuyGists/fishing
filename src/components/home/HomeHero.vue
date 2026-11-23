<script setup lang="ts">
import { t as tr } from "../../i18n";
import { homeHero } from "../../data/home";
import HomeImage from "./HomeImage.vue";
</script>

<template>
  <section class="home-hero relative isolate overflow-hidden bg-content text-white" aria-labelledby="home-title">
    <HomeImage :src="homeHero.src" :srcset="homeHero.srcset" sizes="100vw" :alt="tr('HomeView.hero_alt')" :width="1600" :height="731" priority class="absolute inset-0 -z-20 h-full w-full" />
    <div class="home-hero-shade absolute inset-0 -z-10" aria-hidden="true" />
    <div class="mx-auto flex min-h-[34rem] max-w-7xl flex-col items-start justify-center px-5 py-16 sm:min-h-[38rem] sm:px-8 sm:py-24">
      <span class="slide-fade-in player-content-in from-bottom mb-7 inline-flex items-center gap-2 text-sm font-semibold tracking-wide">
        <span class="h-px w-8 bg-gold" aria-hidden="true" />
        {{ tr("HomeView.hero_eyebrow") }}
      </span>
      <div id="home-title" role="heading" aria-level="1" class="slide-fade-in player-content-in from-bottom max-w-2xl whitespace-pre-line text-[clamp(2.5rem,5.5vw,4.75rem)] font-bold leading-[1.12] tracking-tight">{{ tr("HomeView.hero_title") }}</div>
      <div class="mt-9 flex flex-wrap items-center gap-4">
        <RouterLink :to="{ name: 'login' }" class="home-play-link">{{ tr("HomeView.play_now") }}</RouterLink>
        <a href="#hanh-trinh" class="home-hero-explore inline-flex min-h-13 items-center justify-center rounded-full border border-white/70 px-7 py-3.5 font-semibold text-white no-underline transition-colors hover:bg-content motion-reduce:transition-none">{{ tr("HomeView.explore_game") }}</a>
      </div>
    </div>
    <div class="border-t border-white/20 bg-content/90">
      <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-5 text-sm sm:px-8">
        <span>{{ tr("HomeView.hero_note") }}</span>
        <a href="#khung-canh" class="home-hero-explore inline-flex min-h-11 items-center font-semibold text-white underline-offset-4 hover:text-white">{{ tr("HomeView.see_scenes") }}</a>
      </div>
    </div>
  </section>
</template>

<style scoped>
.home-hero-shade {
  background: linear-gradient(90deg, color-mix(in srgb, var(--color-content) 96%, transparent) 0%, color-mix(in srgb, var(--color-content) 88%, transparent) 52%, color-mix(in srgb, var(--color-content) 15%, transparent) 100%);
}
.home-hero :focus-visible {
  outline-color: var(--color-white);
}
@media (max-width: 639px) {
  .home-hero-shade {
    background: color-mix(in srgb, var(--color-content) 88%, transparent);
  }
}
</style>
