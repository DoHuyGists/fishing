import { createRouter, createWebHistory } from "vue-router";
import supabase from "../database/connection";
import { supabaseUserInAreaRepository } from "../data/supabaseUserInAreaRepository.ts";
import PlayerLayout from "../layouts/PlayerLayout.vue";
import AdminLayout from "../layouts/AdminLayout.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      children: [
        {
          path: "",
          component: PlayerLayout,
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
          component: AdminLayout,
          children: [
            {
              path: "",
              name: "admin",
              component: () => import("../views/AdminView.vue"),
              meta: { requiresAuth: true },
            },
          ],
        },
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
    // ĐẶT Ở CUỐI CÙNG: Bắt tất cả các route không tồn tại
    {
      path: "/:pathMatch(.*)*",
      name: "notFound",
      component: () => import("../components/NotFound.vue"),
    },
  ],
});

router.beforeEach(async (to) => {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;

  if (to.meta.requiresAuth && !data.session) {
    return { name: "login" };
  } else if (userId != null) {
    const fishingArea = await supabaseUserInAreaRepository.getCurrentUserArea(userId);
    if (fishingArea.status == null) {
      if (to.name == "fishing") {
        return { name: "home" };
      }
    } else if (fishingArea.status == "enter") {
      if (to.name != "fishing" && to.name != "admin") {
        return { name: "fishing" };
      }
    }
  } else {
    if (to.name === "login" && data.session) return { name: "home" };
  }
});

export default router;
