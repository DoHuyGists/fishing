import type { DayPhaseKey } from "./fishingScene";

export type HomeScene = {
  id: DayPhaseKey;
  src: string;
  titleKey: string;
  descriptionKey: string;
  altKey: string;
};

export type HomeImageProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  srcset?: string;
  sizes?: string;
  priority?: boolean;
  fit?: "cover" | "contain";
};
