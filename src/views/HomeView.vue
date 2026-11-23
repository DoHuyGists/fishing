<script setup lang="ts">
import { t as tr } from "../i18n";
import LanguageSelector from "../components/shared/LanguageSelector.vue";
import HomeHero from "../components/home/HomeHero.vue";
import HomeJourney from "../components/home/HomeJourney.vue";
import HomeGallery from "../components/home/HomeGallery.vue";
import HomeSpecies from "../components/home/HomeSpecies.vue";
import { homeFeatures } from "../data/home";

const year = new Date().getFullYear();
</script>

<template>
  <div class="home-page min-h-screen bg-surface text-content">
    <a href="#home-content" class="home-skip-link">{{ tr("HomeView.skip_content") }}</a>
    <header class="border-b border-border-default bg-surface">
      <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-5 gap-y-3 px-5 py-4 sm:px-8">
        <RouterLink :to="{ name: 'home' }" class="inline-flex min-h-11 items-center gap-2.5 text-xl font-bold tracking-tight text-content no-underline hover:text-accent" :aria-label="tr('HomeView.home_link')">
          <svg viewBox="0 0 40 32" class="size-9 text-accent" fill="none" aria-hidden="true">
            <path d="M5 16C10 7 22 6 30 16C22 26 10 25 5 16Z" stroke="currentColor" stroke-width="2" />
            <path d="M29 16L37 9V23L29 16Z" fill="currentColor" />
            <circle cx="13" cy="14" r="1.5" fill="currentColor" />
          </svg>
          <span>{{ tr("HomeView.brand") }}</span>
        </RouterLink>
        <nav :aria-label="tr('HomeView.navigation')" class="order-last flex w-full flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm lg:order-none lg:w-auto">
          <a href="#gioi-thieu" class="inline-flex min-h-11 items-center font-semibold text-content no-underline hover:text-accent">{{ tr("HomeView.nav_intro") }}</a>
          <a href="#hanh-trinh" class="inline-flex min-h-11 items-center font-semibold text-content no-underline hover:text-accent">{{ tr("HomeView.nav_journey") }}</a>
          <a href="#bo-suu-tap" class="inline-flex min-h-11 items-center font-semibold text-content no-underline hover:text-accent">{{ tr("HomeView.nav_species") }}</a>
        </nav>
        <LanguageSelector class="w-[12.5rem] max-w-full" />
      </div>
    </header>
    <main id="home-content" tabindex="-1">
      <HomeHero />
      <section id="gioi-thieu" class="mx-auto max-w-7xl scroll-mt-6 px-5 py-16 sm:px-8 sm:py-24" aria-labelledby="home-intro-title">
        <div class="flex flex-wrap items-end justify-between gap-5 border-b border-border-default pb-8">
          <div id="home-intro-title" role="heading" aria-level="2" class="max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{{ tr("HomeView.intro_title") }}</div>
          <span class="rounded-full border border-border-default px-4 py-2 text-sm font-semibold text-sky">{{ tr("HomeView.browser_play") }}</span>
        </div>
        <div class="mt-9 grid gap-8 md:grid-cols-3 md:gap-10">
          <article v-for="feature in homeFeatures" :key="feature.id" :aria-labelledby="`home-feature-${feature.id}`" class="grid content-start gap-4">
            <span class="grid size-12 place-items-center rounded-2xl bg-primary" aria-hidden="true">
              <svg viewBox="0 0 24 24" class="size-6 text-accent" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path :d="feature.icon" />
              </svg>
            </span>
            <div :id="`home-feature-${feature.id}`" role="heading" aria-level="3" class="text-xl font-bold">{{ tr(feature.titleKey) }}</div>
            <div class="text-base leading-relaxed">{{ tr(feature.descriptionKey) }}</div>
          </article>
        </div>
      </section>
      <HomeJourney />
      <HomeGallery />
      <HomeSpecies />
      <section class="border-y border-border-default bg-primary" aria-labelledby="home-join-title">
        <div class="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-5 py-14 sm:px-8 lg:flex-row lg:items-center lg:py-20">
          <div id="home-join-title" role="heading" aria-level="2" class="max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{{ tr("HomeView.join_title") }}</div>
          <RouterLink :to="{ name: 'login' }" class="home-play-link shrink-0">{{ tr("HomeView.play_now") }}</RouterLink>
        </div>
      </section>
    </main>
    <footer class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-7 text-sm sm:px-8">
      <span>© {{ year }} {{ tr("HomeView.brand") }}</span>
      <a href="#home-content" class="inline-flex min-h-11 items-center font-semibold text-content underline-offset-4 hover:text-accent">{{ tr("HomeView.back_top") }}</a>
    </footer>
  </div>
</template>

<style scoped>
.home-page :deep(.font-bold) {
  font-weight: 700;
}
.home-page :deep(.font-semibold) {
  font-weight: 600;
}
.home-page :deep(.home-play-link) {
  display: inline-flex;
  min-height: 3.25rem;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-gold);
  border-radius: 999px;
  padding: 0.875rem 1.75rem;
  background: var(--color-gold);
  color: var(--color-content);
  font-size: 1rem;
  font-weight: 700;
  text-decoration: none;
  transition: background-color 0.2s, border-color 0.2s;
}
.home-page :deep(.home-play-link:hover) {
  border-color: var(--color-content);
  background: var(--color-white);
}
.home-skip-link {
  position: fixed;
  left: 1rem;
  top: 1rem;
  z-index: 50;
  transform: translateY(calc(-100% - 2rem));
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--color-white);
  color: var(--color-content);
}
.home-skip-link:focus {
  transform: none;
}
@media (prefers-reduced-motion: reduce) {
  .home-page :deep(.home-play-link) {
    transition: none;
  }
}
</style>
