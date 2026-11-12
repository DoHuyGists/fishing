<script setup lang="ts">
import Toast from "./components/shared/Toast.vue";
import InformationModal from "./components/shared/InformationModal.vue";
import ModalQuickActions from "./components/shared/ModalQuickActions.vue";
import { onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "./stores/auth";
import { useLocaleStore } from "./stores/locale";
import { useFeatureAvailabilityStore } from "./stores/featureAvailability";
import { useModalStore } from "./stores/modal";
import { modalFeatures } from "./data/featureAvailability";
useLocaleStore();
const auth = useAuthStore();
const router = useRouter();
const features = useFeatureAvailabilityStore();
const modals = useModalStore();
watch(() => auth.user?.id, (userId, _, onCleanup) => {
  features.stop();
  if (!userId) return;
  // Auth callbacks must release their lock before starting database requests.
  const timer = setTimeout(() => { if (auth.user?.id === userId) void features.start(); }, 0);
  onCleanup(() => clearTimeout(timer));
}, { immediate: true });
function refreshFeatures() {
  if (auth.user?.id && document.visibilityState === "visible") void features.load(true);
}
onMounted(() => {
  window.addEventListener("online", refreshFeatures);
  window.addEventListener("focus", refreshFeatures);
  document.addEventListener("visibilitychange", refreshFeatures);
});
onUnmounted(() => {
  features.stop();
  window.removeEventListener("online", refreshFeatures);
  window.removeEventListener("focus", refreshFeatures);
  document.removeEventListener("visibilitychange", refreshFeatures);
});
watch(() => [features.ready, features.flags, modals.modalOpening] as const, () => {
  if (!features.ready || !modals.modalOpening) return;
  const blocked = modalFeatures(modals.modalOpening).find(key => !features.isAvailable(key));
  if (blocked) { modals.close(); features.notify(blocked); }
});
watch(() => auth.recoveringPassword, (recovering) => {
  if (recovering) void router.replace({ name: "resetPassword" });
}, { immediate: true });
</script>

<template>
  <Toast />
  <router-view />
  <InformationModal />
  <ModalQuickActions />
</template>
