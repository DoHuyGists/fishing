export interface Fish {
  id: string;
  name: string;
  baseBiteRate: number;
  weight: number;
  favoriteBait: string;
  image: string;
  rarity: string;
  length: string;
  resistance: number; // 0.0 -> 1.0, sức kháng cự khi kéo
  resistanceRate: number; // cường độ giảm tiến độ kéo mỗi mili giây
  biteDelayRange: readonly [number, number]; // khoảng thời gian chờ cá cắn câu, mili giây
}
export interface Equipment {
  rodMaxWeight: number;
  lineMaxWeight: number;
  reelWearPercent: number;
  reelDurability: number; // hệ số nhân độ hao mòn cuộn dây mỗi lần bắt cá, càng thấp càng bền
  hookStrength: number; // hệ số nhân tỉ lệ móc/giữ cá của móc câu
}
export const lakeFish: Fish[] = [
  {
    id: "rainbow-trout",
    name: "Cá hồi vân",
    baseBiteRate: 0.35,
    weight: 3.4,
    favoriteBait: "Giun đất",
    image: "/fish/VN/fish.jpg",
    rarity: "HIẾM",
    length: "58 cm",
    resistance: 0.4,
    resistanceRate: 0.8,
    biteDelayRange: [5000, 8000],
  },
  {
    id: "northern-pike",
    name: "Cá chó phương bắc",
    baseBiteRate: 0.18,
    weight: 5.8,
    favoriteBait: "Cá nhỏ",
    image: "/fish/VN/fish2.jpg",
    rarity: "SỬ THI",
    length: "82 cm",
    resistance: 0.75,
    resistanceRate: 0.8,
    biteDelayRange: [8000, 12000],
  },
  {
    id: "pond-carp",
    name: "Cá chép hồ",
    baseBiteRate: 0.46,
    weight: 2.1,
    favoriteBait: "Giun đất",
    image: "/fish/VN/fish.jpg",
    rarity: "THƯỜNG",
    length: "46 cm",
    resistance: 0.25,
    resistanceRate: 1.1,
    biteDelayRange: [3000, 6000],
  },
];
export const biteProbability = (fish: Fish, bait: string) => Math.min(1, fish.baseBiteRate * (bait === fish.favoriteBait ? 1.5 : 0.8));
export const catchProbability = (fish: Fish, equip: Equipment, skill = 1) => Math.max(0.05, Math.min(0.95, (Math.min(equip.rodMaxWeight, equip.lineMaxWeight) / fish.weight) * (1 - equip.reelWearPercent / 100) * equip.hookStrength * skill));
export function calculateFishingOutcome(fish: Fish, bait: string, equip: Equipment, skill = 1) {
  if (Math.random() >= biteProbability(fish, bait)) return { status: "NO_BITE" as const, message: "Cá không cắn mồi!" };
  const chance = catchProbability(fish, equip, skill);
  return Math.random() < chance ? { status: "SUCCESS" as const, catchProbability: Math.round(chance * 100) } : { status: "LINE_BROKEN" as const, message: "Cá quá nặng, đứt dây câu!" };
}
