import { createRouter, createWebHistory } from "vue-router";
import supabase from "../database/connection";
import { supabaseUserInAreaRepository } from "../data/supabaseUserInAreaRepository.ts";
import ProtectedLayout from "../layouts/ProtectedLayout.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      children: [
        {
          path: "",
          component: ProtectedLayout,
          children: [
            {
              path: "",
              name: "home",
              component: () => import("../views/HomeView.vue"),
              meta: { requiresAuth: true },
            },
            {
              path: "/fishing",
              name: "fishing",
              component: () => import("../views/FishingView.vue"),
              meta: { requiresAuth: true },
            },
          ],
        },
        {
          path: "admin",
          component: import("../views/AdminView.vue")
        }
      ],
    },
    {
      path: "/login",
      name: "login",
      component: () => import("../views/LoginView.vue"),
    },
    {
      path: "/signup",
      name: "signup",
      component: () => import("../views/SignUpView.vue"),
    },
  ],
});

router.beforeEach(async (to) => {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;

  if (to.meta.requiresAuth && !data.session) {
    return { name: "login" };
  } else if (userId != null) {
    const fishingAreaId = await supabaseUserInAreaRepository.getCurrentUserArea(userId);
    if (fishingAreaId == null) {
      if (to.name == "fishing") {
        return { name: "home" };
      }
    } else {
      if (to.name != "fishing") {
        return { name: "fishing" };
      }
    }
  } else {
    if (to.name === "login" && data.session) return { name: "home" };
  }
});

export default router;
