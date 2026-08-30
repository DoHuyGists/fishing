import type { FishingTool } from "../stores/fishing";

export interface EquipmentVariant {
  id: string;
  name: string;
  detail: string;
  icon: string;
  rodMaxWeight?: number;
  lineMaxWeight?: number;
  reelDurability?: number;
  hookStrength?: number;
  baitName?: string;
}

export const equipmentCategories: { id: FishingTool; name: string; icon: string }[] = [
  { id: "rod", name: "Cần câu", icon: "🎣" },
  { id: "line", name: "Dây câu", icon: "🧵" },
  { id: "reel", name: "Cuộn câu", icon: "🎡" },
  { id: "hook", name: "Móc câu", icon: "🪝" },
  { id: "bait", name: "Mồi câu", icon: "🪱" },
];

export const equipmentVariants: Record<FishingTool, EquipmentVariant[]> = {
  rod: [
    { id: "rod-bamboo", name: "Cần tre", detail: "Chịu tải 4.5 kg", icon: "🎋", rodMaxWeight: 4.5 },
    { id: "rod-carbon", name: "Cần carbon", detail: "Chịu tải 6.2 kg", icon: "🛠", rodMaxWeight: 6.2 },
    { id: "rod-pro", name: "Cần thi đấu", detail: "Chịu tải 8 kg", icon: "🏆", rodMaxWeight: 8 },
  ],
  line: [
    { id: "line-nylon", name: "Dây nylon", detail: "Chịu tải 4 kg", icon: "🧵", lineMaxWeight: 4 },
    { id: "line-braided", name: "Dây dù bện", detail: "Chịu tải 5.5 kg", icon: "🕸", lineMaxWeight: 5.5 },
    { id: "line-fluoro", name: "Dây fluorocarbon", detail: "Chịu tải 7 kg", icon: "💎", lineMaxWeight: 7 },
  ],
  reel: [
    { id: "reel-basic", name: "Cuộn cơ bản", detail: "Độ bền thường", icon: "⚙️", reelDurability: 1 },
    { id: "reel-smooth", name: "Cuộn trơn", detail: "Độ bền tốt hơn", icon: "🌀", reelDurability: 0.7 },
    { id: "reel-pro", name: "Cuộn thi đấu", detail: "Độ bền cao cấp", icon: "🔧", reelDurability: 0.45 },
  ],
  hook: [
    { id: "hook-standard", name: "Móc thường", detail: "Độ bén tiêu chuẩn", icon: "🪝", hookStrength: 1 },
    { id: "hook-sharp", name: "Móc siêu bén", detail: "Tăng tỉ lệ móc cá", icon: "⚡", hookStrength: 1.15 },
    { id: "hook-barbed", name: "Móc ngạnh kép", detail: "Giữ cá chắc chắn", icon: "🔱", hookStrength: 1.3 },
  ],
  bait: [
    { id: "bait-worm", name: "Giun đất", detail: "Phổ biến, dễ kiếm", icon: "🪱", baitName: "Giun đất" },
    { id: "bait-cricket", name: "Dế mèn", detail: "Hấp dẫn cá nhỏ", icon: "🦗", baitName: "Dế mèn" },
    { id: "bait-shrimp", name: "Tôm tươi", detail: "Mồi cao cấp", icon: "🦐", baitName: "Tôm tươi" },
    { id: "bait-minnow", name: "Cá nhỏ giả", detail: "Nhử cá dữ", icon: "🐟", baitName: "Cá nhỏ" },
    { id: "bait-frog", name: "Nhái giả", detail: "Nhử cá mặt nước", icon: "🐸", baitName: "Nhái giả" },
    { id: "bait-spoon", name: "Mồi muỗng", detail: "Ánh kim thu hút", icon: "🥄", baitName: "Mồi muỗng" },
  ],
};
