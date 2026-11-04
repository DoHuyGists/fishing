<script setup lang="ts">
import Toast from "./components/shared/Toast.vue";
import InformationModal from "./components/shared/InformationModal.vue";
</script>

<template>
  <Toast />
  <router-view />
  <InformationModal />
</template>
