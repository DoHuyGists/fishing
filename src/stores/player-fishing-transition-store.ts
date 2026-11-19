import { defineStore } from "pinia";
import { nextTick } from "vue";

export const useFishingTransitionStore = defineStore("FishingTransition", {
  state: () => ({ visible: false }),
  actions: {
    show() {
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
      this.visible = false;
    },
  },
});
