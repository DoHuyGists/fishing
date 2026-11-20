<script lang="ts" setup>
import { t as tr } from "../../../i18n";

import { computed, onMounted, ref } from "vue";
import { storeToRefs } from "pinia";
import { usePagedListFilters } from "../../../composables/usePagedListFilters";
import Pagination from "../../shared/Pagination.vue";
import { useBadgesStore } from "../../../stores/player-badges-store.ts";
import Modal from "../../shared/Modal.vue";
import AchievementOverview from "./AchievementOverview.vue";
import AchievementFilters from "./AchievementFilters.vue";
import AchievementList from "./AchievementList.vue";
import AchievementDetail from "./AchievementDetail.vue";

const badgesStore = useBadgesStore();
const selectedBadgeId = ref<string | null>(null);
const { searchQuery, selectedType, statusFilter } = storeToRefs(badgesStore);

function loadBadges() {
  return badgesStore.fetchBadges();
}

onMounted(loadBadges);
usePagedListFilters(
  [searchQuery, selectedType, statusFilter],
  () => { void badgesStore.fetchBadges(1); },
  () => {
    selectedBadgeId.value = null;
    badgesStore.invalidateRequest();
  },
);

const selectedBadge = computed(() => badgesStore.badges.find((badge) => badge.badge_id === selectedBadgeId.value));

function closeDetail() {
  selectedBadgeId.value = null;
  badgesStore.claimError = "";
}

function clearFilters() {
  searchQuery.value = "";
  selectedType.value = "all";
  statusFilter.value = "all";
}
</script>

<template>
  <Modal :title="tr('Achievement.huy_hieu')" :on-refresh="loadBadges">
    <section aria-labelledby="badges-title">
      <AchievementOverview @refresh="loadBadges" />
      <AchievementFilters />
      <AchievementList @select="selectedBadgeId = $event" @clear-filters="clearFilters" />

      <Pagination
        :page="badgesStore.page"
        :total="badgesStore.total"
        :page-size="badgesStore.pageSize"
        :loading="badgesStore.loading"
        @change="badgesStore.fetchBadges($event)"
      />
      <AchievementDetail
        v-if="selectedBadge"
        :badge="selectedBadge"
        :claiming-id="badgesStore.claimingId"
        :claim-error="badgesStore.claimError"
        @close="closeDetail"
        @claim="badgesStore.claimReward($event)"
      />
    </section>
  </Modal>
</template>
