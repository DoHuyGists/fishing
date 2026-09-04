import { defineStore } from "pinia";

export const useWorldStore = defineStore("world", {
  state: () => ({
    selectedArea: {} as any,
  }),
  actions: {
    selectArea(anchor: any) {
      this.selectedArea = anchor;
    },
  },
});
