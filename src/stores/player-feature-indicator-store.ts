import { computed, onScopeDispose, ref } from "vue";
import { defineStore } from "pinia";
import { useAuthStore } from "./auth";
import { useFeatureAvailabilityStore } from "./player-feature-availability-store";
import { useNotificationStore } from "./player-notification-store";
import { useTeamStore } from "./player-team-store";
import { supabaseFeatureIndicatorRepository as repository } from "../data/supabaseFeatureIndicatorRepository";
import { createKeyedRefreshTask } from "../utils/refreshTask";
import { startVisibleRefresh } from "../utils/visibleRefresh";
import { indicatorFeatures } from "../types/model/featureIndicator";
import type { FeatureIndicator, FeatureIndicatorSnapshot, LobbyModal } from "../types/model/featureIndicator";

export const useFeatureIndicatorStore = defineStore("FeatureIndicators", () => {
  const auth = useAuthStore();
  const features = useFeatureAvailabilityStore();
  const notifications = useNotificationStore();
  const team = useTeamStore();
  const indicators = ref<FeatureIndicatorSnapshot["indicators"]>({});
  const ownerId = ref("");
  const error = ref("");
  const loading = ref(false);
  const enabledFeatures = computed(() => indicatorFeatures.filter((key) => features.canOpen(key)));
  const read = createKeyedRefreshTask<FeatureIndicatorSnapshot>();
  let stopRefresh: (() => void) | undefined;
  let boundaryTimer: ReturnType<typeof setTimeout> | undefined;
  let queuedTimer: ReturnType<typeof setTimeout> | undefined;
  let requestId = 0;
  let epoch = 0;
  let dirty = false;
  let nextBoundaryAt = Infinity;

  function getIndicator(modal: LobbyModal): FeatureIndicator | undefined {
    if (auth.user?.id !== ownerId.value || !features.canOpen(modal)) return;
    if (modal === "notifications") return {
      rewardCount: 0, attentionCount: notifications.ownerId === ownerId.value ? notifications.unreadCount : 0, nextChangeAt: null,
    };
    if (modal === "team") return {
      rewardCount: 0, attentionCount: team.ownerId === ownerId.value ? team.inviteTotal : 0, nextChangeAt: null,
    };
    return indicators.value[modal as keyof typeof indicators.value];
  }

  function hasAttention(modal: LobbyModal): boolean {
    const indicator = getIndicator(modal);
    return Boolean(indicator && (indicator.rewardCount > 0 || indicator.attentionCount > 0));
  }

  function resetSession() {
    epoch++;
    requestId++;
    stopRefresh?.();
    stopRefresh = undefined;
    clearTimeout(boundaryTimer);
    clearTimeout(queuedTimer);
    queuedTimer = undefined;
    dirty = false;
    nextBoundaryAt = Infinity;
    indicators.value = {};
    ownerId.value = "";
    error.value = "";
    loading.value = false;
  }

  async function refresh(force = false) {
    const owner = auth.user?.id;
    if (!owner || owner !== ownerId.value) return;
    const generation = auth.sessionGeneration;
    const lifecycle = epoch;
    const keys = [...enabledFeatures.value];
    const key = `${owner}:${generation}:${lifecycle}:${keys.join(",")}`;
    const request = ++requestId;
    const current = () => request === requestId && epoch === lifecycle && auth.user?.id === owner
      && auth.sessionGeneration === generation && ownerId.value === owner;
    loading.value = true;
    try {
      const result = keys.length ? await read(key, () => repository.fetchSummary(keys), force)
        : { serverTime: new Date().toISOString(), indicators: {} };
      if (!current()) return;
      indicators.value = result.indicators;
      error.value = "";
      dirty = false;
      clearTimeout(boundaryTimer);
      // Schedule against server time, so a skewed device clock cannot reveal rewards early.
      const next = Math.min(...Object.values(result.indicators).map((entry) =>
        entry?.nextChangeAt ? Date.parse(entry.nextChangeAt) : Infinity));
      const delay = Math.max(1000, next - Date.parse(result.serverTime) + 100);
      nextBoundaryAt = performance.now() + delay;
      if (Number.isFinite(next)) boundaryTimer = setTimeout(requestRefresh, Math.min(delay, 2_147_483_647));
    } catch (cause) {
      // Keep the last successful snapshot on transient errors.
      if (current()) error.value = cause instanceof Error ? cause.message : String(cause);
    } finally {
      if (current()) loading.value = false;
    }
  }

  function requestRefresh() {
    dirty = true;
    if (!stopRefresh || queuedTimer) return;
    queuedTimer = setTimeout(() => {
      queuedTimer = undefined;
      if (document.visibilityState !== "hidden" && navigator.onLine !== false) void refresh(true);
    }, 150);
  }

  function start() {
    resetSession();
    if (!auth.user?.id) return;
    ownerId.value = auth.user.id;
    const stopVisible = startVisibleRefresh(async () => {
      await refresh();
      if (error.value) throw new Error(error.value);
    }, 60_000);
    const resume = () => {
      if (dirty || performance.now() >= nextBoundaryAt) requestRefresh();
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    stopRefresh = () => {
      stopVisible();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
    };
  }

  onScopeDispose(resetSession);

  return { indicators, ownerId, error, loading, enabledFeatures, getIndicator, hasAttention,
    refresh, requestRefresh, start, resetSession };
});
