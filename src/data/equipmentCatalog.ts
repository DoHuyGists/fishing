import type { FishingTool } from "../stores/fishing";

export interface EquipmentVariant {
  id: string;
  name: string;
  detail: string;
  icon: string;
  image?: string | null;
  is_used?: boolean;
  rodMaxWeight?: number;
  lineMaxWeight?: number;
  reelDurability?: number;
  hookStrength?: number;
  baitName?: string;
  quantity?: number | null;
}

export const equipmentCategories: { id: FishingTool; name: string; icon: string}[] = [
  { id: "rod", name: "Cần câu", icon: "/icons/items/rod.svg"},
  { id: "line", name: "Dây câu", icon: "/icons/items/line.svg"},
  { id: "reel", name: "Cuộn câu", icon: "/icons/items/reel.svg"},
  { id: "hook", name: "Móc câu", icon: "/icons/items/hook.svg"},
  { id: "bait", name: "Mồi câu", icon: "/icons/items/bait.svg"},
];

// Seed data used only to bootstrap a brand-new user's row in Supabase; live data always comes from the DB afterwards.
export const defaultEquipmentVariants: Record<FishingTool, EquipmentVariant[]> = {
  rod: [
    { id: "rod-bamboo", name: "Cần tre", detail: "Chịu tải 4.5 kg", icon: "🎋", rodMaxWeight: 4.5 },
  ],
  line: [
    { id: "line-nylon", name: "Dây nylon", detail: "Chịu tải 4 kg", icon: "🧵", lineMaxWeight: 4 },
  ],
  reel: [
    { id: "reel-basic", name: "Cuộn cơ bản", detail: "Độ bền thường", icon: "⚙️", reelDurability: 1 },
  ],
  hook: [
    { id: "hook-standard", name: "Móc thường", detail: "Độ bén tiêu chuẩn", icon: "🪝", hookStrength: 1 },
  ],
  bait: [
    { id: "bait-worm", name: "Giun đất", detail: "Phổ biến, dễ kiếm", icon: "🪱", baitName: "Giun đất" },
  ],
};
