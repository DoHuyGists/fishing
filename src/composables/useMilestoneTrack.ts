import { computed, onBeforeUnmount, ref, watch } from "vue";

export function useMilestoneTrack(thresholds: () => readonly number[], points: () => number) {
  const trackElement = ref<HTMLElement | null>(null);
  const centers = ref<number[]>([]);
  let observer: ResizeObserver | undefined;

  watch([trackElement, thresholds], ([element]) => {
    observer?.disconnect();
    if (!element) {
      centers.value = [];
      return;
    }
    const rows = Array.from(element.querySelectorAll<HTMLElement>(":scope > [data-milestone]"));
    const measure = () => {
      centers.value = rows.map((row) => row.offsetTop + row.offsetHeight / 2);
    };
    observer = new ResizeObserver(measure);
    observer.observe(element);
    rows.forEach((row) => observer!.observe(row));
    measure();
  }, { flush: "post" });

  onBeforeUnmount(() => observer?.disconnect());

  const trackHeight = computed(() => centers.value.at(-1) ?? 0);
  const filledHeight = computed(() => {
    let previousPoints = 0;
    let previousCenter = 0;
    const currentPoints = Math.max(0, points());
    const values = thresholds();
    for (let index = 0; index < values.length; index++) {
      const threshold = values[index]!;
      const center = centers.value[index];
      if (center === undefined) return previousCenter;
      if (currentPoints < threshold) {
        const fraction = (currentPoints - previousPoints) / (threshold - previousPoints);
        return previousCenter + (center - previousCenter) * fraction;
      }
      previousPoints = threshold;
      previousCenter = center;
    }
    return previousCenter;
  });

  return { trackElement, trackHeight, filledHeight };
}
