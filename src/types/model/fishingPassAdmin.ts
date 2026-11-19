export interface FishingPass {
  id: string; name: string; description: string | null; price: number; totalDays: number;
  startAt: string; endAt: string; isActive: boolean; createdAt: string;
}
export type FishingPassPayload = Omit<FishingPass, "id" | "createdAt">;
