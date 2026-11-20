import { onScopeDispose, ref, watch, type MaybeRefOrGetter, toValue } from 'vue';

export function useFishingSceneImage(
  source: MaybeRefOrGetter<string>,
  fallback: MaybeRefOrGetter<string>,
  sceneKey: MaybeRefOrGetter<string>,
) {
  const displayedImage = ref('');
  let requestId = 0;
  watch(() => [toValue(source), toValue(fallback), toValue(sceneKey)] as const,
    async ([src, backup, key], previous) => {
      const request = ++requestId;
      // Keep the old frame only within the same area, where casting geometry is unchanged.
      if (!src || previous?.[2] !== key) displayedImage.value = '';
      for (const candidate of [...new Set([src, backup].filter(Boolean))]) {
        try {
          const image = new Image();
          image.src = candidate;
          await image.decode();
          if (request === requestId) displayedImage.value = candidate;
          return;
        } catch {
          if (request !== requestId) return;
        }
      }
      if (request === requestId) displayedImage.value = '';
    }, { immediate: true });
  onScopeDispose(() => { requestId++; });
  return displayedImage;
}
