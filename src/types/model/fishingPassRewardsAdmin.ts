export type PassRewardType = "FREE" | "PREMIUM";

export interface AdminFishingPass { id: string; name: string; totalDays: number }

export interface AdminFishingPassItem { id: string; name: string; category: string | null; icon: string | null; image: string | null }
