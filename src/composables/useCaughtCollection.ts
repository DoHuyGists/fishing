import { computed, reactive, ref, watch } from "vue";
import { useCaughtStore } from "../stores/player-caught-store";
import type { CaughtFish, CaughtFishFilters, CaughtViewMode } from "../types/model/caughtFish";

const defaultFilters = (): CaughtFishFilters => ({
  search: "", rarity: "ALL", variant: "ALL", shiny: "ALL", origin: "ALL",
  minStars: 0, minWeight: "", maxWeight: "", sort: "newest",
});

export function useCaughtCollection() {
  const caughtStore = useCaughtStore();
  const filters = reactive(defaultFilters());
  const viewMode = ref<CaughtViewMode>("species");
  const currentPage = ref(1);
  const pageSize = 12;
  const expandedSpecies = ref<string | null>(null);
  const rarityOptions = computed(() => [...new Set(caughtStore.caughtFishes.flatMap(
    (fish) => fish.species?.rarity ? [fish.species.rarity] : [],
  ))]);
  const originOptions = computed(() => [...new Map(caughtStore.caughtFishes.flatMap(
    (fish) => fish.origin ? [[fish.origin.id, fish.origin] as const] : [],
  )).values()]);
  const hasActiveFilters = computed(() => filters.search.trim() !== "" || filters.rarity !== "ALL"
    || filters.variant !== "ALL" || filters.shiny !== "ALL" || filters.origin !== "ALL"
    || filters.minStars > 0 || filters.minWeight !== "" || filters.maxWeight !== "");
  const invalidWeightRange = computed(() => filters.minWeight !== "" && filters.maxWeight !== ""
    && filters.minWeight > filters.maxWeight);
  const filteredFishes = computed(() => {
    const query = filters.search.trim().toLocaleLowerCase();
    const fishes = caughtStore.caughtFishes.filter((fish) => {
      return (!query || fish.species?.name?.toLocaleLowerCase().includes(query))
        && (filters.rarity === "ALL" || fish.species?.rarity === filters.rarity)
        && (filters.variant === "ALL" || fish.variant_type === filters.variant)
        && (filters.shiny === "ALL" || fish.is_shiny === (filters.shiny === "shiny"))
        && (filters.origin === "ALL" || (filters.origin === "farm" ? !fish.origin : fish.origin?.id === filters.origin))
        && (fish.star_rating ?? 0) >= filters.minStars
        && (filters.minWeight === "" || fish.weight >= filters.minWeight)
        && (filters.maxWeight === "" || fish.weight <= filters.maxWeight);
    });
    return fishes.sort((a, b) => {
      const recent = () => Date.parse(b.created_at) - Date.parse(a.created_at);
      switch (filters.sort) {
        case "oldest": return -recent();
        case "heaviest": return b.weight - a.weight || recent();
        case "lightest": return a.weight - b.weight || recent();
        case "stars": return (b.star_rating ?? 0) - (a.star_rating ?? 0) || recent();
        default: return recent();
      }
    });
  });
  const fishGroups = computed(() => {
    const groups = new Map<string, CaughtFish[]>();
    for (const fish of filteredFishes.value) {
      const id = fish.species?.id || fish.species?.name || fish.id;
      const group = groups.get(id);
      if (group) group.push(fish);
      else groups.set(id, [fish]);
    }
    return Array.from(groups, ([id, fishes]) => ({ id, fishes }));
  });
  const total = computed(() => viewMode.value === "species" ? fishGroups.value.length : filteredFishes.value.length);
  const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));
  const paginatedFishes = computed(() => filteredFishes.value.slice((currentPage.value - 1) * pageSize, currentPage.value * pageSize));
  const paginatedGroups = computed(() => fishGroups.value.slice((currentPage.value - 1) * pageSize, currentPage.value * pageSize));
  watch([filters, viewMode], () => {
    currentPage.value = 1;
    expandedSpecies.value = null;
  }, { flush: "sync" });
  watch(pageCount, (count) => { currentPage.value = Math.min(currentPage.value, count); }, { flush: "sync" });

  return {
    filters, viewMode, currentPage, pageSize, expandedSpecies, rarityOptions, originOptions,
    hasActiveFilters, invalidWeightRange, filteredFishes, paginatedFishes, paginatedGroups, total,
    resetFilters: () => Object.assign(filters, defaultFilters()),
  };
}
