<script setup lang="ts">
import Toast from "./components/shared/Toast.vue";
import InformationModal from "./components/shared/InformationModal.vue";
import { watch } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "./stores/auth";
import { useLocaleStore } from "./stores/locale";
const localeStore = useLocaleStore();
const auth = useAuthStore();
const router = useRouter();
watch(() => auth.recoveringPassword, (recovering) => {
  if (recovering) void router.replace({ name: "resetPassword" });
}, { immediate: true });
</script>

<template>
  <label class="fixed bottom-2 left-2 z-[10001] rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-2 py-1 text-xs text-[#24352a] shadow-sm">
    <span class="sr-only">{{ $t('language.label') }}</span>
    <select v-model="localeStore.locale" class="cursor-pointer bg-transparent outline-none" :aria-label="$t('language.label')">
      <option value="vi">Tiếng Việt</option>
      <option value="en">English</option>
    </select>
  </label>
  <Toast />
  <router-view />
  <InformationModal />
</template>
