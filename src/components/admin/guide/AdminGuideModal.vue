<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import AdminModal from "../AdminModal.vue";
import Tab from "../../shared/Tab.vue";
import { useAdminGuideStore } from "../../../stores/adminGuide";
import EquipmentGuide from "./EquipmentGuide.vue";
import TensionChallengeIdexGuilde from "./TensionChallengeIdexGuilde.vue";

const emit = defineEmits<{ close: [] }>();
const guide = useAdminGuideStore();
const tabs = [
  { key: "tension", label: "Tension challenge" },
  { key: "equipment", label: "Trang bị và chỉ số cá" },
];
const content = ref<HTMLElement | null>(null);
let previousFocus: HTMLElement | null = null;

onMounted(() => {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  content.value?.focus();
});
onBeforeUnmount(() => previousFocus?.focus());
</script>

<template>
  <AdminModal title="Hướng dẫn quản trị" subtitle="Trang bị · Chỉ số cá · Tension challenge" icon="📘" :z-index="10000" @close="emit('close')" @keydown.esc.stop.prevent="emit('close')">
    <div ref="content" tabindex="-1" class="min-h-0 flex-1 overflow-y-auto overscroll-contain focus:outline-none">
      <Tab v-model="guide.topic" :tabs="tabs" lazy aria-label="Chủ đề hướng dẫn quản trị">
        <template #tension><TensionChallengeIdexGuilde /></template>
        <template #equipment><EquipmentGuide /></template>
      </Tab>
    </div>
  </AdminModal>
</template>
