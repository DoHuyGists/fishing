import { createApp } from "vue";
import "./styles/index.css";
import "./styles/reward.css";
import "./styles/animation.css";
import App from "./App.vue";
import { createPinia } from "pinia";
import router from "./router";
import { useAuthStore } from "./stores/auth";
import { i18n } from "./i18n";
import { useLocaleStore } from "./stores/player-locale-store.ts";
import { setFeatureRequestGuard } from "./database/featureRequestGate";
import { useFeatureAvailabilityStore } from "./stores/player-feature-availability-store.ts";
import { setMutationRefreshHandler, setFeatureIndicatorRefreshHandler } from "./database/mutationRefresh";
import { useFeatureIndicatorStore } from "./stores/player-feature-indicator-store";
import { usePlayerRefreshStore } from "./stores/player-refresh-store.ts";
import { useGameCatalogStore } from "./stores/player-game-catalog-store.ts";
import { setCatalogMutationHandler } from "./database/catalogRequests";
import { setReadCacheHandler } from "./database/readCacheRequests";
import { useReadCacheStore } from "./stores/player-read-cache.ts";
import { resetPlayerSnapshots } from "./stores/player-snapshot-reset-store.ts";

const app = createApp(App);
const pinia = createPinia();
pinia.use(resetPlayerSnapshots);

app.use(pinia);
setFeatureIndicatorRefreshHandler(() => {
  const auth = useAuthStore(pinia);
  const owner = auth.user?.id;
  const generation = auth.sessionGeneration;
  return () => {
    if (owner && auth.user?.id === owner && auth.sessionGeneration === generation)
      useFeatureIndicatorStore(pinia).requestRefresh();
  };
});
setMutationRefreshHandler((snapshots) => {
  const auth = useAuthStore(pinia);
  const owner = auth.user?.id;
  const generation = auth.sessionGeneration;
  return () => {
    if (owner && auth.user?.id === owner && auth.sessionGeneration === generation) {
      // A reconciliation failure must never turn a committed mutation into a
      // failed action. Individual stores retain their errors for retry/focus.
      void usePlayerRefreshStore(pinia)
        .refresh(owner, snapshots, true)
        .catch(() => {});
    }
  };
});
app.use(i18n);
const catalogs = useGameCatalogStore(pinia);
const readCache = useReadCacheStore(pinia);
setReadCacheHandler(() => {
  const context = readCache.capture();
  return context ? { ...context, bypassReads: router.currentRoute.value.name === "admin" } : undefined;
});
if (import.meta.env.DEV) {
  Object.defineProperty(window, "gameCatalogCache", {
    configurable: true,
    value: { inspect: () => catalogs.inspectCache() },
  });
  Object.defineProperty(window, "gameReadCache", { configurable: true, value: { inspect: () => readCache.inspect() } });
}
setCatalogMutationHandler((domains) => {
  const generation = useAuthStore(pinia).sessionGeneration;
  return () => {
    if (useAuthStore(pinia).sessionGeneration === generation) void catalogs.invalidate(domains);
  };
});
window.addEventListener("focus", () => {
  void catalogs.resume();
});
window.addEventListener("online", () => {
  void catalogs.resume();
});
document.addEventListener("visibilitychange", () => {
  void catalogs.resume();
});
useLocaleStore(pinia);
const features = useFeatureAvailabilityStore(pinia);
setFeatureRequestGuard(
  async (keys) => {
    if (router.currentRoute.value.name === "admin" && useAuthStore(pinia).isAdmin) return null;
    return features.checkRequests(keys);
  },
  () => i18n.global.locale.value,
  (key) => features.handleServerDenial(key),
);
app.use(router);
useAuthStore(pinia).initialize();
app.mount("#app");
