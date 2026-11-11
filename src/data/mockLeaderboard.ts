import { t as tr } from "../i18n";
export type MockLeaderboardCriterion = "catches" | "largest" | "collection";

export interface MockLeaderboardEntry {
  id: string;
  displayName: string;
  value: number;
}

// Fixtures for criteria without a leaderboard endpoint. IDs do not refer to real users.
export const mockLeaderboards: Record<MockLeaderboardCriterion, MockLeaderboardEntry[]> = {
  catches: [
    { id: "mock-catches-1", get displayName() { return tr('mockLeaderboard.can_thu_mien_tay'); }, value: 12840 },
    { id: "mock-catches-2", get displayName() { return tr('mockLeaderboard.may_lang_thang'); }, value: 11625 },
    { id: "mock-catches-3", get displayName() { return tr('mockLeaderboard.song_xanh'); }, value: 10980 },
    { id: "mock-catches-4", get displayName() { return tr('mockLeaderboard.chu_ca_nho'); }, value: 9456 },
    { id: "mock-catches-5", get displayName() { return tr('mockLeaderboard.gio_bien'); }, value: 8720 },
    { id: "mock-catches-6", get displayName() { return tr('mockLeaderboard.bo_cat_trang'); }, value: 7985 },
    { id: "mock-catches-7", get displayName() { return tr('mockLeaderboard.thuyen_giay'); }, value: 6432 },
    { id: "mock-catches-8", get displayName() { return tr('mockLeaderboard.nang_som'); }, value: 5810 },
  ],
  largest: [
    { id: "mock-largest-1", get displayName() { return tr('mockLeaderboard.song_xanh'); }, value: 128.6 },
    { id: "mock-largest-2", get displayName() { return tr('mockLeaderboard.gio_bien'); }, value: 115.25 },
    { id: "mock-largest-3", get displayName() { return tr('mockLeaderboard.can_thu_mien_tay'); }, value: 102.8 },
    { id: "mock-largest-4", get displayName() { return tr('mockLeaderboard.nang_som'); }, value: 96.4 },
    { id: "mock-largest-5", get displayName() { return tr('mockLeaderboard.thuyen_giay'); }, value: 89.75 },
    { id: "mock-largest-6", get displayName() { return tr('mockLeaderboard.may_lang_thang'); }, value: 84.2 },
    { id: "mock-largest-7", get displayName() { return tr('mockLeaderboard.chu_ca_nho'); }, value: 78.9 },
    { id: "mock-largest-8", get displayName() { return tr('mockLeaderboard.bo_cat_trang'); }, value: 72.35 },
  ],
  collection: [
    { id: "mock-collection-1", get displayName() { return tr('mockLeaderboard.may_lang_thang'); }, value: 186 },
    { id: "mock-collection-2", get displayName() { return tr('mockLeaderboard.thuyen_giay'); }, value: 174 },
    { id: "mock-collection-3", get displayName() { return tr('mockLeaderboard.bo_cat_trang'); }, value: 168 },
    { id: "mock-collection-4", get displayName() { return tr('mockLeaderboard.song_xanh'); }, value: 152 },
    { id: "mock-collection-5", get displayName() { return tr('mockLeaderboard.can_thu_mien_tay'); }, value: 145 },
    { id: "mock-collection-6", get displayName() { return tr('mockLeaderboard.nang_som'); }, value: 132 },
    { id: "mock-collection-7", get displayName() { return tr('mockLeaderboard.gio_bien'); }, value: 127 },
    { id: "mock-collection-8", get displayName() { return tr('mockLeaderboard.chu_ca_nho'); }, value: 118 },
  ],
};
