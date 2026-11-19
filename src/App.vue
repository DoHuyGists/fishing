<script setup lang="ts">
import Toast from "./components/shared/Toast.vue";
import InformationModal from "./components/shared/InformationModal.vue";
import ModalQuickActions from "./components/shared/ModalQuickActions.vue";
import { onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "./stores/auth";
import { useLocaleStore } from "./stores/player-locale-store.ts";
import { useFeatureAvailabilityStore } from "./stores/player-feature-availability-store.ts";
import { useModalStore } from "./stores/player-modal-store.ts";
import { modalFeatures } from "./data/featureAvailability";
import ConfettiCannon from "./components/shared/ConfettiCannon.vue";
import { useStoryStore } from "./stores/player-story-store.ts";
import { useStoryEditorStore } from "./components/admin/admin-story/admin-story-editor-store";
import FishingSplashLoading from "./components/FishingSplashLoading.vue";
import { useFishingTransitionStore } from "./stores/player-fishing-transition-store";

useLocaleStore();
const auth = useAuthStore();
const router = useRouter();
const features = useFeatureAvailabilityStore();
const modals = useModalStore();
const stories = useStoryStore();
const fishingTransition = useFishingTransitionStore();
watch(
  () => router.currentRoute.value.name,
  (name) => {
    if (name === "fishing") {
      if (modals.isOpening("prepare")) modals.close();
    } else if (fishingTransition.visible) {
      // A completed redirect away from fishing must not leave the screen covered.
      fishingTransition.hide();
    }
  },
);
watch(
  () => auth.user?.id,
  (userId) => {
    stories.reset(userId ?? "");
    const editor = useStoryEditorStore();
    if (editor.owner && editor.owner !== userId) {
      editor.cache();
      editor.$reset();
    }
  },
  { immediate: true },
);
watch(
  () => auth.user?.id,
  (userId, _, onCleanup) => {
    features.stop();
    if (!userId) return;
    // Auth callbacks must release their lock before starting database requests.
    const timer = setTimeout(() => {
      if (auth.user?.id === userId) void features.start();
    }, 0);
    onCleanup(() => clearTimeout(timer));
  },
  { immediate: true },
);
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
watch(
  () => [features.ready, features.flags, modals.modalOpening] as const,
  () => {
    if (!features.ready || !modals.modalOpening) return;
    const blocked = modalFeatures(modals.modalOpening).find((key) => !features.isAvailable(key));
    if (blocked) {
      modals.close();
      features.notify(blocked);
    }
  },
);
watch(
  () => auth.recoveringPassword,
  (recovering) => {
    if (recovering) void router.replace({ name: "resetPassword" });
  },
  { immediate: true },
);
</script>

<template>
  <ConfettiCannon ref="confetti" />
  <Toast />
  <router-view />
  <InformationModal />
  <ModalQuickActions />
  <Teleport to="body">
    <Transition name="fishing-splash">
      <FishingSplashLoading v-if="fishingTransition.visible" />
    </Transition>
  </Teleport>
</template>
