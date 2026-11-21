import { defineStore } from "pinia";
import type { InformationModalContent } from "../types/model/informationModal";
export type { InformationModalContent } from "../types/model/informationModal";

export const useInformationModalStore = defineStore("informationModal", {
  state: () => ({
    content: null as InformationModalContent | null,
  }),
  actions: {
    open(content: InformationModalContent) {
      this.content = { ...content };
    },
    close() {
      this.content = null;
    },
  },
});
