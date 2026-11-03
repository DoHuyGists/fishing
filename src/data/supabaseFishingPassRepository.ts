import supabase from "../database/connection";

export interface FishingPassReward {
  id: string;
  day_number: number;
  reward_type: "FREE" | "PREMIUM";
  item_id: string;
  quantity: number;
  claimed_at: string | null;
  item: {
    name: string;
    icon: string | null;
    image: string | null;
  } | null;
}

export interface FishingPass {
  id: string;
  name: string;
  description: string | null;
  price: number;
  total_days: number;
  start_at: string;
  end_at: string;
  rewards: FishingPassReward[];
  purchased: boolean;
}

class SupabaseFishingPassRepository {
  async claimReward(rewardId: string): Promise<void> {
    const { error } = await supabase.rpc("claim_fishing_pass_reward", {
      p_reward_id: rewardId,
    });
    if (error) throw new Error(error.message);
  }

  async fetchCurrentPass(): Promise<FishingPass | null> {
    const now = new Date().toISOString();
    const { data: pass, error } = await supabase
      .from("fishing_passes")
      .select("id,name,description,price,total_days,start_at,end_at")
      .eq("is_active", true)
      .lte("start_at", now)
      .gte("end_at", now)
      .order("start_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!pass) return null;

    const [{ data: rewards, error: rewardsError }, { data: purchase, error: purchaseError }, { data: claims, error: claimsError }] = await Promise.all([
      supabase
        .from("fishing_pass_rewards")
        .select("id,day_number,reward_type,item_id,quantity,item:items(name,icon,image)")
        .eq("pass_id", pass.id)
        .order("day_number"),
      supabase.from("user_fishing_passes").select("id").eq("pass_id", pass.id).maybeSingle(),
      supabase.from("user_fishing_pass_claims").select("reward_id,claimed_at").eq("pass_id", pass.id),
    ]);
    if (rewardsError) throw new Error(rewardsError.message);
    if (purchaseError) throw new Error(purchaseError.message);
    if (claimsError) throw new Error(claimsError.message);
    const claimsByReward = new Map((claims ?? []).map((claim) => [claim.reward_id, claim.claimed_at]));
    return {
      ...pass,
      price: Number(pass.price),
      total_days: Number(pass.total_days),
      rewards: ((rewards ?? []).map((reward) => ({
        ...reward,
        quantity: Number(reward.quantity),
        claimed_at: claimsByReward.get(reward.id) ?? null,
      }))) as unknown as FishingPassReward[],
      purchased: Boolean(purchase),
    };
  }
}

export const supabaseFishingPassRepository = new SupabaseFishingPassRepository();
