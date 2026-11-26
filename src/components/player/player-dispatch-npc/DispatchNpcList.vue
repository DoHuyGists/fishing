<script setup lang="ts">
import { t as tr } from "../../../i18n/index.ts";
import { useDispatchStore } from "../../../stores/player-dispatch-store.ts";
import DispatchNpcCard from "./DispatchNpcCard.vue";

const store = useDispatchStore();
</script>

<template>
  <div v-if="!store.npcs.length" class="py-8 text-center text-sm">{{ tr("Dispatch.emptyNpcs") }}</div>
  <div class="dispatch-grid">
    <DispatchNpcCard
      v-for="(npc, index) in store.npcs"
      :key="npc.id"
      :npc="npc"
      class="slide-fade-in from-bottom player-content-in"
      :style="{ '--delay': `${index * 45}ms` }"
    />
  </div>
</template>
