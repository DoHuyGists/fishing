import { computed, ref } from "vue";
import { homeScenes } from "../data/home";

export function useHomeGallery() {
  const selectedIndex = ref(1);
  const scene = computed(() => homeScenes[selectedIndex.value]!);

  function select(index: number) {
    selectedIndex.value = (index + homeScenes.length) % homeScenes.length;
  }

  function onKeydown(event: KeyboardEvent) {
    let index = selectedIndex.value;
    if (event.key === "ArrowRight") index++;
    else if (event.key === "ArrowLeft") index--;
    else if (event.key === "Home") index = 0;
    else if (event.key === "End") index = homeScenes.length - 1;
    else return;

    event.preventDefault();
    select(index);
    const tabs = (event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs[selectedIndex.value]?.focus();
  }

  return { scenes: homeScenes, selectedIndex, scene, select, onKeydown };
}
