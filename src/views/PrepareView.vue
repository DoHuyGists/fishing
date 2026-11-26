<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, watch } from "vue";
import { storeToRefs } from "pinia";
import { isNavigationFailure, NavigationFailureType, useRoute, useRouter } from "vue-router";
import { t as tr } from "../i18n";
import { usePrepareStore } from "../stores/player-prepare-store";
import { useAuthStore } from "../stores/auth";
import { useModalStore } from "../stores/player-modal-store";
import { useUserTurnsStore } from "../stores/player-user-turns-store";
import { useFeatureAvailabilityStore } from "../stores/player-feature-availability-store";
import { useFishingTransitionStore } from "../stores/player-fishing-transition-store";
import { useReadCacheStore } from "../stores/player-read-cache";
import { useAreaWeather } from "../composables/useAreaWeather";
import { useModalRefresh } from "../composables/useModalRefresh";
import { useToast } from "../composables/useToast";
import PrepareHeader from "../components/player/player-prepare/PrepareHeader.vue";
import PrepareLakeFish from "../components/player/player-prepare/PrepareLakeFish.vue";
import PrepareEquipmentSets from "../components/player/player-prepare/PrepareEquipmentSets.vue";
import PrepareBodyEquipmentSets from "../components/player/player-prepare/PrepareBodyEquipmentSets.vue";
import WeatherSection from "../components/player/player-fishing/WeatherSection.vue";
import FishingSurvival from "../components/player/player-fishing/FishingSurvival.vue";
import FishingFatigue from "../components/player/player-fishing/FishingFatigue.vue";
import FishingEquipmentOverview from "../components/player/player-inventory/fishing-equipment/FishingEquipmentOverview.vue";
import HealthOverview from "../components/player/player-inventory/body-equipment/HealthOverview.vue";

const EquipmentModal = defineAsyncComponent(() => import("../components/player/player-inventory/EquipmentModal.vue"));
const route = useRoute();
const router = useRouter();
const prepare = usePrepareStore();
const auth = useAuthStore();
const modalStore = useModalStore();
const turns = useUserTurnsStore();
const features = useFeatureAvailabilityStore();
const fishingTransition = useFishingTransitionStore();
const toast = useToast();
const { area, loading, error, switchingSet, selectingItemId, entering, usedSet, canProceed, proceedBlockReason, isUsedSetComplete } = storeToRefs(prepare);
const { isSetComplete, isItemSelected, switchSet, chooseMainItem } = prepare;
const areaId = computed(() => typeof route.params.areaId === "string" ? route.params.areaId : "");
const blockedFeature = computed(() => ["world-map", "enter-area"].find((key) => !features.isAvailable(key)));
useAreaWeather(() => area.value?.id);

async function loadData(force = false) {
  if (entering.value || switchingSet.value || selectingItemId.value) return;
  await prepare.loadData(areaId.value, force);
}

const { isRefreshing, refreshCooldown, refreshError, refreshDisabled, handleRefresh } = useModalRefresh(
  () => () => loadData(true),
  () => useReadCacheStore().invalidate(),
  () => tr("Modal.refresh_error"),
);

modalStore.close();
watch(
  () => [areaId.value, auth.user?.id, auth.sessionGeneration, blockedFeature.value] as const,
  () => {
    if (!auth.user?.id || blockedFeature.value) prepare.cancelLoad();
    else void prepare.loadData(areaId.value);
  },
  { immediate: true },
);
watch(() => modalStore.modalOpening, (name, previous) => {
  if (!name && (previous === "inventory" || previous === "body")) void loadData();
});
onMounted(() => turns.startCountdown());
onUnmounted(() => {
  prepare.cancelLoad();
  turns.stopCountdown();
  if (modalStore.modalOpening === "inventory" || modalStore.modalOpening === "body") modalStore.close();
});

async function confirm() {
  try {
    if (!await prepare.enterArea()) return;
    const failure = await router.push({ name: "fishing" });
    // PlayerLayout may already own a pending redirect after area membership refreshes.
    if (isNavigationFailure(failure, NavigationFailureType.cancelled)) return;
    if (router.currentRoute.value.name !== "fishing") fishingTransition.hide();
  } catch (err) {
    fishingTransition.hide();
    toast.error(err instanceof Error ? err.message : tr("PrepareModal.khong_the_tru_luot_cau_ca"), {
      get title() { return tr("PrepareModal.chua_the_vao_bai_cau"); },
      position: "top",
    });
  } finally {
    entering.value = false;
  }
}
</script>

<template>
  <main class="flex h-dvh w-full flex-col overflow-hidden bg-surface text-content">
    <PrepareHeader
      :title="area?.title || tr('PrepareModal.title')"
      :busy="entering"
      :refresh-disabled="refreshDisabled || loading || switchingSet || !!selectingItemId"
      :refreshing="isRefreshing"
      :cooldown="refreshCooldown"
      @refresh="handleRefresh"
    />
    <div v-if="refreshError" role="alert" class="border-b border-danger p-3 text-sm text-danger">{{ refreshError }}</div>
    <div class="min-h-0 flex-1 overflow-y-auto p-2">
      <div v-if="blockedFeature" class="grid gap-3 p-6 text-center" role="status">
        <div>{{ features.reason(blockedFeature) }}</div>
        <button type="button" class="underline" @click="features.showDetails(blockedFeature)">{{ tr('FeatureAvailability.maintenanceBadge') }}</button>
      </div>
      <div v-else-if="loading" class="flex h-full items-center justify-center gap-3 text-sm text-content-subtle" role="status">
        <div class="h-9 w-9 animate-spin rounded-full border-[3px] border-border-default border-t-content"></div>
        <span>{{ tr("PrepareModal.dang_tai_trang_bi") }}</span>
      </div>
      <div v-else-if="error" class="grid gap-3 p-6 text-center text-sm text-danger" role="alert">
        <div>{{ error }}</div>
        <button type="button" class="underline" @click="handleRefresh">{{ tr("Maintenance.thu_lai") }}</button>
      </div>
      <div v-else-if="area" class="slide-fade-in from-bottom flex flex-col gap-4">
        <WeatherSection inline />
        <FishingSurvival v-if="area.survivalMode" preview />
        <FishingFatigue v-else variant="default" :area-id="area.id" />
        <PrepareLakeFish />
        <FishingEquipmentOverview />
        <PrepareEquipmentSets
          :used-set="usedSet"
          :switching-set="switchingSet"
          :selecting-item-id="selectingItemId"
          :is-used-set-complete="isUsedSetComplete"
          :is-set-complete="isSetComplete"
          :is-item-selected="isItemSelected"
          @switch-set="switchSet"
          @choose-main-item="chooseMainItem"
        />
        <HealthOverview />
        <PrepareBodyEquipmentSets />
      </div>
    </div>
      <!-- Footer -->
      <footer
        class="flex items-center justify-between flex-wrap gap-4 px-3 py-3.5 sm:px-7 bg-surface-hover border-t border-border-default"
      >
        <div
          v-if="proceedBlockReason"
          class="flex items-center gap-2 px-3.5 py-2 bg-surface border border-gold rounded-lg text-gold text-sm leading-snug w-full sm:w-auto sm:max-w-[65%]"
        >
          <span class="text-base shrink-0">⚠️</span>
          <span class="font-medium">{{ proceedBlockReason }}</span>
        </div>
        <div v-else class="flex-1"></div>

        <div class="flex items-center gap-3 ml-auto">
          <button
            type="button"
            class="inline-flex items-center justify-center gap-2 px-4 py-2 border border-content-secondary rounded-xl text-sm font-bold cursor-pointer transition-all duration-150 active:scale-95 bg-content-secondary text-surface shadow-md hover:not-disabled:bg-content disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!canProceed"
            :title="proceedBlockReason || tr('PrepareModal.san_sang_tiep_tuc')"
            @click="confirm"
          >
            <span class="text-base">🚀</span>
            {{ tr("TeamModal.tiep_tuc") }}
          </button>
        </div>
      </footer>

  </main>
  <Teleport to="body">
    <Transition name="player-window" :duration="{ enter: 220, leave: 220 }">
      <EquipmentModal
        v-if="modalStore.isOpening('inventory') || modalStore.isOpening('body')"
        :key="modalStore.modalOpening ?? 'inventory'"
        :initial-tab="modalStore.isOpening('body') ? 'health' : 'fishing'"
      />
    </Transition>
  </Teleport>
</template>
