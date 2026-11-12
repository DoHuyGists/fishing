import type { PassRewardType } from "../model/fishingPassRewardsAdmin";

export interface FishingPassRewardRow { id: string; passId: string; passName: string; dayNumber: number; rewardType: PassRewardType; itemId: string; itemName: string; itemIcon: string | null; quantity: number; createdAt: string }

export interface FishingPassRewardPayload { passId: string; dayNumber: number; rewardType: PassRewardType; itemId: string; quantity: number }
