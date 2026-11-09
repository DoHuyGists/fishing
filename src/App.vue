<script setup lang="ts">
import Toast from "./components/shared/Toast.vue";
import InformationModal from "./components/shared/InformationModal.vue";
import { watch } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "./stores/auth";
const auth = useAuthStore();
const router = useRouter();
watch(() => auth.recoveringPassword, (recovering) => {
  if (recovering) void router.replace({ name: "resetPassword" });
}, { immediate: true });
</script>

<template>
  <Toast />
  <router-view />
  <InformationModal />
</template>
