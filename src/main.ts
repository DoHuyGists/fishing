import { createApp } from "vue";
import "./styles/index.css";
import "./styles/reward.css";
import "./styles/animation.css";
import App from "./App.vue";
import { createPinia } from "pinia";
import router from "./router";
import { useAuthStore } from "./stores/auth";
import { i18n } from "./i18n";
import { useLocaleStore } from "./stores/locale";
import { setFeatureRequestGuard } from "./database/featureRequestGate";
import { useFeatureAvailabilityStore } from "./stores/featureAvailability";
import { setMutationRefreshHandler } from './database/mutationRefresh';
import { usePlayerRefreshStore } from './stores/playerRefresh';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
setMutationRefreshHandler(snapshots => {
  const auth = useAuthStore(pinia);
  const owner = auth.user?.id;
  const generation = auth.sessionGeneration;
  return () => {
    if (owner && auth.user?.id === owner && auth.sessionGeneration === generation) {
      // A reconciliation failure must never turn a committed mutation into a
      // failed action. Individual stores retain their errors for retry/focus.
      void usePlayerRefreshStore(pinia).refresh(owner, snapshots, true).catch(() => {});
    }
  };
});
app.use(i18n);
useLocaleStore(pinia);
const features = useFeatureAvailabilityStore(pinia);
setFeatureRequestGuard(async keys => {
  if (router.currentRoute.value.name === "admin" && useAuthStore(pinia).isAdmin) return null;
  return features.checkRequests(keys);
}, () => i18n.global.locale.value, key => features.handleServerDenial(key));
app.use(router);
useAuthStore(pinia).initialize();
app.mount("#app");
