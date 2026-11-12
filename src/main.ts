import { createApp } from "vue";
import "./style.css";
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

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
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
