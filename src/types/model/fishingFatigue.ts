export interface FishingFatigueEffect {
  code: string;
  name: string;
  target: 'weight_cap' | 'rare_spawn' | 'score';
  value: number;
}

export interface FishingFatigue {
  area_id: string;
  fatigue_score: number;
  effects: FishingFatigueEffect[];
}
