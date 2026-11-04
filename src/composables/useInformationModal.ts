import { storeToRefs } from "pinia";
import { useInformationModalStore } from "../stores/informationModal";

export type { InformationModalContent } from "../stores/informationModal";

export function useInformationModal() {
  const store = useInformationModalStore();
  const { content } = storeToRefs(store);

  return { content, open: store.open, close: store.close };
}
