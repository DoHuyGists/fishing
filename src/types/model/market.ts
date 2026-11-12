export interface MarketHistory {
  id: string;
  created_at: string;
  seller_id: string;
  buyer_id: string;
  item: Record<string, unknown>;
  price: number;
}

export interface MarketListing {
  id: string;
  created_at: string;
  caught_id: string;
  user_id: string;
  price: number;
  status: string;
  caught?: {
    id: string;
    user_id: string;
    species_id: string;
    weight: number;
    fish: {
      id: string;
      name: string;
      weight: number;
      image: string | null;
      rarity: string | null;
    } | null;
    created_at: string | null;
  } | null;
}
