import { storeToRefs } from "pinia";
import { useInformationModalStore } from "../stores/player-information-modal-store";

export type { InformationModalContent } from "../stores/player-information-modal-store";

export function useInformationModal() {
  const store = useInformationModalStore();
  const { content } = storeToRefs(store);

  return { content, open: store.open, close: store.close };
}
