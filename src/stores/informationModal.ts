import { defineStore } from "pinia";

export interface InformationModalContent {
  name: string;
  image: string;
  description: string;
}

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
