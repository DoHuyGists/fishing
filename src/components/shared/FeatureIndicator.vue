<script setup lang="ts">
import { computed } from "vue";
import { t as tr } from "../../i18n";
import { useFeatureIndicatorStore } from "../../stores/player-feature-indicator-store";
import type { LobbyModal } from "../../types/model/featureIndicator";

const props = defineProps<{ modal: LobbyModal; disabled?: boolean }>();
const store = useFeatureIndicatorStore();
const indicator = computed(() => store.getIndicator(props.modal));
const label = computed(() => indicator.value?.rewardCount
  ? tr("FeatureTable.claimableRewards", { count: indicator.value.rewardCount })
  : tr("FeatureTable.pendingAttention"));
</script>

<template>
  <span
    v-if="!disabled && store.hasAttention(modal)"
    class="slide-fade-in from-top [--slide-distance:2px]! pointer-events-none absolute -right-1 -top-1 z-10 size-2.5 rounded-full bg-danger ring-2 ring-surface"
    role="img"
    :aria-label="label"
    :title="label"
  ></span>
</template>
