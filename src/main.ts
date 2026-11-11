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

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(i18n);
useLocaleStore(pinia);
app.use(router);
useAuthStore(pinia).initialize();
app.mount("#app");
