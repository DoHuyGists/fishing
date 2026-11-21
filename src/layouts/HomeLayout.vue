<script setup lang="ts">
import { watch } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

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
    <router-view></router-view>
</template>