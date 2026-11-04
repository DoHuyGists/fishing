import supabase from "../database/connection";

export type PassRewardType = "FREE" | "PREMIUM";
export interface AdminFishingPass { id: string; name: string; totalDays: number }
export interface AdminFishingPassItem { id: string; name: string; category: string | null; icon: string | null; image: string | null }
export interface FishingPassRewardRow { id: string; passId: string; passName: string; dayNumber: number; rewardType: PassRewardType; itemId: string; itemName: string; itemIcon: string | null; quantity: number; createdAt: string }
export interface FishingPassRewardPayload { passId: string; dayNumber: number; rewardType: PassRewardType; itemId: string; quantity: number }
const mapReward = (row: any): FishingPassRewardRow => ({ id: row.id, passId: row.pass_id, passName: row.pass?.name ?? "(Vé đã xoá)", dayNumber: row.day_number, rewardType: row.reward_type, itemId: row.item_id, itemName: row.item?.name ?? "(Vật phẩm không tồn tại)", itemIcon: row.item?.icon ?? row.item?.image ?? null, quantity: Number(row.quantity), createdAt: row.created_at });
const rewardSelect = "id,pass_id,day_number,reward_type,item_id,quantity,created_at,pass:fishing_passes(name),item:items(name,icon,image)";
export const supabaseFishingPassRewardsAdminRepository = {
  async fetchAll(): Promise<FishingPassRewardRow[]> {
    const { data, error } = await supabase.from("fishing_pass_rewards").select(rewardSelect).order("pass_id").order("day_number").order("reward_type");
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapReward);
  },
  async fetchPasses(): Promise<AdminFishingPass[]> {
    const { data, error } = await supabase.from("fishing_passes").select("id,name,total_days").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({ id: row.id, name: row.name, totalDays: Number(row.total_days) }));
  },
  async fetchItems(): Promise<AdminFishingPassItem[]> {
    const { data, error } = await supabase.from("items").select("id,name,category,icon,image").order("name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({ id: row.id, name: row.name, category: row.category, icon: row.icon, image: row.image }));
  },
  async create(payload: FishingPassRewardPayload): Promise<FishingPassRewardRow> {
    const { data, error } = await supabase.from("fishing_pass_rewards").insert({ pass_id: payload.passId, day_number: payload.dayNumber, reward_type: payload.rewardType, item_id: payload.itemId, quantity: payload.quantity }).select(rewardSelect).single();
    if (error) throw new Error(error.message);
    return mapReward(data);
  },
  async update(id: string, payload: FishingPassRewardPayload): Promise<FishingPassRewardRow> {
    const { data, error } = await supabase.from("fishing_pass_rewards").update({ pass_id: payload.passId, day_number: payload.dayNumber, reward_type: payload.rewardType, item_id: payload.itemId, quantity: payload.quantity }).eq("id", id).select(rewardSelect).single();
    if (error) throw new Error(error.message);
    return mapReward(data);
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("fishing_pass_rewards").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};
