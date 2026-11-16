<script setup lang="ts">
import { watch } from 'vue';
import { t as tr } from '../../../i18n';
import { useAuthStore } from '../../../stores/auth';
import { useLeaderboardStore } from '../../../stores/leaderboard';
import Modal from '../../shared/Modal.vue';
import Tab from '../../shared/Tab.vue';
import LeaderboardScore from './LeaderboardScore.vue';
import LeaderboardCaught from './LeaderboardCaught.vue';
import LeaderboardBestFish from './LeaderboardBestFish.vue';
import LeaderboardSeason from './LeaderboardSeason.vue';

const leaderboardStore = useLeaderboardStore();
const authStore = useAuthStore();

function load() {
  return leaderboardStore.fetchLeaderboard(authStore.user?.id);
}

watch([() => authStore.user?.id, () => leaderboardStore.activeTab], () => leaderboardStore.fetchLeaderboard(authStore.user?.id, 1), { immediate: true });
</script>

<template>
  <Modal :title="tr('LeaderboardModal.bang_xep_hang')" :on-refresh="load" :show-count-data="false">
    <div class="mx-auto max-w-3xl px-1 py-1 text-[#24352a] sm:px-2 sm:py-2">
      <Tab v-model="leaderboardStore.activeTab" class="leaderboard-tabs" :tabs="leaderboardStore.tabs" :aria-label="tr('LeaderboardModal.tieu_chi_xep_hang')" lazy wrap>
        <template #label="{ tab }">
          <span aria-hidden="true">{{ leaderboardStore.tabs.find(category => category.key === tab.key)?.emoji }}</span>
          {{ tab.label }}
        </template>
        <template #score="{ active }">
          <LeaderboardScore v-if="active" />
        </template>
        <template #total_caught="{ active }">
          <LeaderboardCaught v-if="active" />
        </template>
        <template #best_fish="{ active }">
          <LeaderboardBestFish v-if="active" />
        </template>
        <template #hall_of_fame="{ active }">
          <LeaderboardSeason v-if="active" hall-of-fame />
        </template>
      </Tab>
    </div>
  </Modal>
</template>

<style scoped>
.leaderboard-tabs :deep([role='tab']) {
  gap: 0.375rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.75rem;
}

.leaderboard-tabs :deep([role='tabpanel']) {
  padding-block: 0.75rem;
}
</style>
