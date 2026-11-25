<script setup lang="ts">
import { watch } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import FishingSplashLoading from "../components/FishingSplashLoading.vue";

const router = useRouter();
const auth = useAuthStore();

watch(
  () => auth.isAuthenticated,
  (isAuthenticated) => {
    if (isAuthenticated) void router.replace({ name: "lobby" });
  },
  { immediate: true },
);
</script>
<template>
  <FishingSplashLoading v-if="!auth.initialized || auth.isAuthenticated" />
  <router-view v-else />
</template>
