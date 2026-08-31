import { createRouter, createWebHistory } from "vue-router";
import supabase from "../database/connection";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: () => import("../views/HomeView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/login",
      name: "login",
      component: () => import("../views/LoginView.vue"),
    },
    {
      path: "/fishing/:areaId",
      name: "fishing",
      component: () => import("../views/FishingView.vue"),
      meta: { requiresAuth: true },
    },
  ],
});

router.beforeEach(async (to) => {
  const { data } = await supabase.auth.getSession();
  if (to.meta.requiresAuth && !data.session) return { name: "login" };
  if (to.name === "login" && data.session) return { name: "home" };
});

export default router;
