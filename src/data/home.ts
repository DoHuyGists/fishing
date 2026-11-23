import type { HomeScene } from "../types/model/home";

const asset = (name: string) => `${import.meta.env.BASE_URL}home/${name}.webp`;

export const homeHero = {
  src: asset("harbor"),
  srcset: `${asset("harbor-small")} 800w, ${asset("harbor")} 1600w`,
};

export const homeFeatures = [
  { id: "equipment", titleKey: "HomeView.feature_equipment_title", descriptionKey: "HomeView.feature_equipment_description", icon: "M4 20L18 6M14 4L20 10M8 16L5 13M18 6V17a3 3 0 0 1-6 0v-2" },
  { id: "waters", titleKey: "HomeView.feature_waters_title", descriptionKey: "HomeView.feature_waters_description", icon: "M3 8c3-4 6 4 9 0s6 4 9 0M3 13c3-4 6 4 9 0s6 4 9 0M3 18c3-4 6 4 9 0s6 4 9 0" },
  { id: "collection", titleKey: "HomeView.feature_collection_title", descriptionKey: "HomeView.feature_collection_description", icon: "M12 5C9 3 5 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-2-1-6-1-9 1Zm0 0v15M6 8h3M6 12h3M15 8h3M15 12h3" },
] as const;

export const homeJourney = [
  { id: "prepare", titleKey: "HomeView.step_prepare_title", descriptionKey: "HomeView.step_prepare_description", image: `${import.meta.env.BASE_URL}icons/items/rod.svg` },
  { id: "explore", titleKey: "HomeView.step_explore_title", descriptionKey: "HomeView.step_explore_description", image: `${import.meta.env.BASE_URL}icons/items/map.svg` },
  { id: "catch", titleKey: "HomeView.step_catch_title", descriptionKey: "HomeView.step_catch_description", image: `${import.meta.env.BASE_URL}icons/items/reel.svg` },
  { id: "grow", titleKey: "HomeView.step_grow_title", descriptionKey: "HomeView.step_grow_description", image: `${import.meta.env.BASE_URL}icons/items/bait.svg` },
] as const;

export const homeScenes = [
  { id: "dawn", src: asset("dawn"), titleKey: "HomeView.scene_dawn_title", descriptionKey: "HomeView.scene_dawn_description", altKey: "HomeView.scene_dawn_alt" },
  { id: "day", src: asset("day"), titleKey: "HomeView.scene_day_title", descriptionKey: "HomeView.scene_day_description", altKey: "HomeView.scene_day_alt" },
  { id: "dusk", src: asset("dusk"), titleKey: "HomeView.scene_dusk_title", descriptionKey: "HomeView.scene_dusk_description", altKey: "HomeView.scene_dusk_alt" },
  { id: "night", src: asset("night"), titleKey: "HomeView.scene_night_title", descriptionKey: "HomeView.scene_night_description", altKey: "HomeView.scene_night_alt" },
] as const satisfies readonly HomeScene[];

export const homeSpecies = [
  { id: "carp", nameKey: "HomeView.fish_carp", habitatKey: "HomeView.freshwater", src: asset("carp") },
  { id: "silver-carp", nameKey: "HomeView.fish_silver_carp", habitatKey: "HomeView.freshwater", src: asset("silver-carp") },
  { id: "catfish", nameKey: "HomeView.fish_catfish", habitatKey: "HomeView.freshwater", src: asset("catfish") },
  { id: "grouper", nameKey: "HomeView.fish_grouper", habitatKey: "HomeView.saltwater", src: asset("grouper") },
  { id: "tuna", nameKey: "HomeView.fish_tuna", habitatKey: "HomeView.saltwater", src: asset("tuna") },
  { id: "mackerel", nameKey: "HomeView.fish_mackerel", habitatKey: "HomeView.saltwater", src: asset("mackerel") },
] as const;
