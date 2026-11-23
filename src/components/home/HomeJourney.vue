<script setup lang="ts">
import { t as tr } from "../../i18n";
import { homeJourney } from "../../data/home";
</script>

<template>
  <section id="hanh-trinh" class="scroll-mt-6 border-y border-border-default bg-primary" aria-labelledby="home-journey-title">
    <div class="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
      <div id="home-journey-title" role="heading" aria-level="2" class="max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{{ tr("HomeView.journey_title") }}</div>
      <div role="list" class="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="step in homeJourney" :key="step.id" role="listitem" class="border-t border-accent/40 pt-6">
          <img :src="step.image" alt="" width="48" height="48" loading="lazy" decoding="async" class="mb-6 size-12 object-contain" />
          <div role="heading" aria-level="3" class="text-xl font-bold">{{ tr(step.titleKey) }}</div>
          <div class="mt-3 text-base leading-relaxed">{{ tr(step.descriptionKey) }}</div>
        </div>
      </div>
    </div>
  </section>
</template>
