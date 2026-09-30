export interface Fish {
  id: string;
  name: string;
  weight: number;
  favoriteBait: string;
  image: string;
  rarity: string;
  length: string;
}
export interface Equipment {
  rodMaxWeight: number;
  lineMaxWeight: number;
  reelWearPercent: number;
  reelDurability: number; // hệ số nhân độ hao mòn cuộn dây mỗi lần bắt cá, càng thấp càng bền
  hookStrength: number; // hệ số nhân tỉ lệ móc/giữ cá của móc câu
}
