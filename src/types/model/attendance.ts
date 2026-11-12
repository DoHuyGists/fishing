export type AttendanceReward = { name: string; icon: string; amount?: number };

export type MonthReward = { day: number; freeReward: AttendanceReward; passReward: AttendanceReward; freeClaimed: boolean; passClaimed: boolean; unlocked: boolean };
