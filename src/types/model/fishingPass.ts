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
