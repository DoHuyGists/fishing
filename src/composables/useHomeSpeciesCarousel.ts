import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { homeSpecies } from "../data/home";

export function useHomeSpeciesCarousel() {
  const carousel = ref<HTMLElement | null>(null);
  const page = ref(0);
  const perPage = ref(1);
  const position = ref(3);
  const transitioning = ref(false);
  const animate = ref(true);
  const items = [...homeSpecies.slice(-3), ...homeSpecies, ...homeSpecies.slice(0, 3)];
  const autoplayEnabled = ref(true);
  const reducedMotion = ref(false);
  const inView = ref(false);
  const documentVisible = ref(true);
  const hovered = ref(false);
  const focused = ref(false);
  const pages = computed(() => {
    const result = [];
    for (let index = 0; index < homeSpecies.length; index++) {
      result.push([homeSpecies[index]]);
    }
    return result;
  });
  const isPlaying = computed(() => autoplayEnabled.value && !reducedMotion.value && inView.value && documentVisible.value && !hovered.value && !focused.value && pages.value.length > 1);
  let timer: ReturnType<typeof setInterval> | undefined;
  let observer: IntersectionObserver | undefined;
  let motion: MediaQueryList | undefined;
  let tablet: MediaQueryList | undefined;
  let desktop: MediaQueryList | undefined;

  function select(index: number) {
    autoplayEnabled.value = false;
    move(index);
  }

  function move(index: number) {
    if (transitioning.value) return;
    animate.value = true;
    position.value += index - page.value;
    page.value = ((index % homeSpecies.length) + homeSpecies.length) % homeSpecies.length;
    transitioning.value = !reducedMotion.value;
    if (reducedMotion.value) finishTransition();
  }

  function finishTransition() {
    // Reposition only at the cloned edges; ordinary steps retain their compositor layer.
    if (position.value !== page.value + 3) {
      animate.value = false;
      position.value = page.value + 3;
    }
    transitioning.value = false;
  }

  function isVisible(index: number) {
    return index >= position.value && index < position.value + perPage.value;
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowRight") select(page.value + 1);
    else if (event.key === "ArrowLeft") select(page.value - 1);
    else if (event.key === "Home") select(0);
    else if (event.key === "End") select(pages.value.length - 1);
    else return;
    event.preventDefault();
  }

  function onFocusOut(event: FocusEvent) {
    focused.value = event.relatedTarget instanceof Node && Boolean(carousel.value?.contains(event.relatedTarget));
  }

  function updateLayout() {
    perPage.value = desktop?.matches ? 3 : tablet?.matches ? 2 : 1;
  }

  function updateMotion() {
    reducedMotion.value = motion?.matches ?? false;
    if (reducedMotion.value) finishTransition();
  }

  function updateVisibility() {
    documentVisible.value = document.visibilityState === "visible";
  }

  watch(isPlaying, (playing) => {
    clearInterval(timer);
    if (playing) {
      timer = setInterval(() => {
        move(page.value + 1);
      }, 2500);
    }
  });

  onMounted(() => {
    motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    tablet = window.matchMedia("(min-width: 640px)");
    desktop = window.matchMedia("(min-width: 1024px)");
    updateMotion();
    updateLayout();
    updateVisibility();
    motion.addEventListener("change", updateMotion);
    tablet.addEventListener("change", updateLayout);
    desktop.addEventListener("change", updateLayout);
    document.addEventListener("visibilitychange", updateVisibility);
    observer = new IntersectionObserver(([entry]) => {
      inView.value = Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.25);
    }, { threshold: [0, 0.25] });
    if (carousel.value) observer.observe(carousel.value);
  });

  onBeforeUnmount(() => {
    clearInterval(timer);
    observer?.disconnect();
    motion?.removeEventListener("change", updateMotion);
    tablet?.removeEventListener("change", updateLayout);
    desktop?.removeEventListener("change", updateLayout);
    document.removeEventListener("visibilitychange", updateVisibility);
  });

  return { carousel, page, pages, items, position, perPage, animate, inView, finishTransition, isVisible, autoplayEnabled, reducedMotion, isPlaying, hovered, focused, select, onKeydown, onFocusOut };
}
