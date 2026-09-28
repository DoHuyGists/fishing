import { createRouter, createWebHistory } from "vue-router";
import supabase from "../database/connection";
import { supabaseUserInAreaRepository } from "../data/supabaseUserInAreaRepository.ts";

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
      path: "/fishing",
      name: "fishing",
      component: () => import("../views/FishingView.vue"),
      meta: { requiresAuth: true },
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
    if(fishingAreaId == null){
      if (to.name == "fishing") {
        return { name: "home" };
      } 
    }else{
      if (to.name != "fishing"){
        return { name: "fishing" };
      }
    }
  } else {
    if (to.name === "login" && data.session) return { name: "home" };
  }
});

export default router;
