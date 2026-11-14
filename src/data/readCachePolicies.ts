import type { ReadCachePolicy } from '../types/model/readCache';

const second = 1000, minute = 60 * second, hour = 60 * minute;
// Personal snapshots deliberately stay in RAM and never fall back to stale.
export const readCachePolicies: Record<string, ReadCachePolicy> = {
  caught: { ttl: 30 * second }, inventory: { ttl: 30 * second }, equipment: { ttl: 30 * second },
  diaryOwned: { ttl: minute }, unlocked: { ttl: minute }, skillsOwned: { ttl: 30 * second },
  wallet: { ttl: 10 * second }, profile: { ttl: 30 * second },
  notifications: { ttl: 15 * second, feature: 'notifications' }, team: { ttl: 15 * second }, friends: { ttl: 30 * second },
  market: { ttl: 5 * second }, history: { ttl: 15 * second },
  missions: { ttl: 30 * second, hourBoundary: true }, pass: { ttl: 30 * second, hourBoundary: true },
  badges: { ttl: 30 * second }, factionState: { ttl: 30 * second },
  leaderboard: { ttl: 30 * second }, feedback: { ttl: 30 * second }, farmRecords: { ttl: 30 * second },
  spinRewards: { ttl: minute, feature: 'gacha' },
  tutorials: { ttl: 6 * hour, persist: true, feature: 'tutorial' },
  events: { ttl: minute, persist: true, feature: 'event' },
  dailyRewards: { ttl: hour, persist: true, feature: 'attendance' },
  factions: { ttl: hour, persist: true, feature: 'faction' },
};

export const cachedReadTables: Record<string, string> = {
  caught: 'caught', user_inventory: 'inventory', user_equipments: 'equipment', user_body_equipments: 'equipment',
  caught_diary: 'diaryOwned', player_unlocked_countries: 'unlocked', user_skills: 'skillsOwned',
  currency: 'wallet', user_profile: 'profile', personal_notifications: 'notifications',
  system_notifications: 'notifications', system_notification_reads: 'notifications',
  user_teams: 'team', user_team_members: 'team', user_team_invite: 'team', user_friends: 'friends',
  species_market: 'market', market_history: 'history', leaderboard: 'leaderboard',
  error_feedback: 'feedback', aquaculture_records: 'farmRecords',
  user_factions: 'factionState', user_fishing_passes: 'pass', user_fishing_pass_claims: 'pass', fishing_pass_rewards: 'pass',
  tutorials: 'tutorials', event_schedule: 'events', event: 'events', daily_rewards: 'dailyRewards', factions: 'factions',
};
// Only audited read-only RPCs. Session/area/fishing/farm authority reads remain fresh.
export const cachedReadRpcs: Record<string, string> = {
  get_caught_in_home: 'caught', get_all_user_equipment_sets: 'equipment', get_my_currency: 'wallet',
  get_daily_missions: 'missions', get_current_hour_missions: 'missions', get_user_badges_status: 'badges',
  get_current_faction_effects: 'factionState', get_my_faction_daily_activity: 'factionState',
  get_spin_wheel_rewards: 'spinRewards',
};

// A successful gameplay mutation can affect several personal snapshots through
// server triggers. Clear RAM snapshots together; leave static disk catalogs alone.
export const personalReadDomains = Object.keys(readCachePolicies).filter(key => !readCachePolicies[key]!.persist);
export const catalogReadDomains = Object.keys(readCachePolicies).filter(key => readCachePolicies[key]!.persist);
export const uncachedReadRpcs = new Set([
  'get_game_catalog_versions', 'get_game_catalog_snapshot', 'get_currency_conversion_rates',
  'get_user_status', 'get_user_equipment_set_using', 'get_caught_in_area', 'get_area_species_diary',
  'preview_fish_by_depth', 'get_aquaculture_farm', 'get_dispatch_state',
  'get_friend_list_page', 'get_admin_list_page',
]);
