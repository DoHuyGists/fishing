<script setup lang="ts">
import { t as tr } from "../i18n";

import { computed, type Component } from "vue";
import { useRoute } from "vue-router";
import NewPlayerFishing from "../components/player/tutorial/NewPlayerFishing.vue";

const route = useRoute();
// A published slug selects a local implementation, never executable DB content.
const lessons: Record<string, Component> = { "new-player-fishing": NewPlayerFishing };
const lesson = computed(() => Object.hasOwn(lessons, String(route.params.slug)) ? lessons[String(route.params.slug)] : undefined);
</script>

<template>
  <component :is="lesson" v-if="lesson" :key="String(route.params.slug)" />
  <main v-else class="grid min-h-dvh place-content-center gap-4 bg-[#f5f9f0] p-6 text-center text-[#24352a]">
    <div class="text-xl font-bold">{{ tr('TutorialView.khong_tim_thay_man_huong_dan') }}</div>
    <div>{{ tr('TutorialView.man_choi_nay_chua_co_hoac_chua_duoc_ho_tro') }}</div>
    <RouterLink :to="{ name: 'home' }" class="rounded-lg border border-[#cbd9c6] bg-white px-4 py-2 font-bold">{{ tr('TutorialView.ve_sanh_cau_ca') }}</RouterLink>
  </main>
</template>
