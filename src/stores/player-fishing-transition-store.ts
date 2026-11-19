import { defineStore } from "pinia";
import { nextTick } from "vue";

export const useFishingTransitionStore = defineStore("FishingTransition", {
  state: () => ({ visible: false, requestId: 0 }),
  actions: {
    show() {
      this.requestId++;
      this.visible = true;
    },
    async coverScreen() {
      this.show();
      await nextTick();
      // Let the browser paint the cover before closing the modal or navigating.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    },
    hide() {
      this.requestId++;
      this.visible = false;
    },
    async revealScene(imageSources: string[]) {
      const requestId = ++this.requestId;
      // Data readiness does not imply that the scene's images are decoded yet.
      await Promise.allSettled(
        [...new Set(imageSources.filter(Boolean))].map(async (src) => {
          const image = new Image();
          image.src = src;
          await image.decode();
        }),
      );
      await nextTick();
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      if (requestId === this.requestId) this.hide();
    },
  },
});
