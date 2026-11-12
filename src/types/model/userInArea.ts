export type UserTurnStatus = {
  turns: number;
  max_turns: number;
  last_recharge_at: string | null;
  cooldown_seconds: number;
};
