import { createApp } from "vue";
import "./style.css";
import "./styles/reward.css";
import App from "./App.vue";
import { createPinia } from "pinia";
import router from "./router";
import { useAuthStore } from "./stores/auth";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router)
useAuthStore(pinia).initialize();
app.mount("#app");
