export type MockLeaderboardCriterion = "catches" | "largest" | "collection";

export interface MockLeaderboardEntry {
  id: string;
  displayName: string;
  value: number;
}

// Fixtures for criteria without a leaderboard endpoint. IDs do not refer to real users.
export const mockLeaderboards: Record<MockLeaderboardCriterion, MockLeaderboardEntry[]> = {
  catches: [
    { id: "mock-catches-1", displayName: "Cần Thủ Miền Tây", value: 12840 },
    { id: "mock-catches-2", displayName: "Mây Lang Thang", value: 11625 },
    { id: "mock-catches-3", displayName: "Sóng Xanh", value: 10980 },
    { id: "mock-catches-4", displayName: "Chú Cá Nhỏ", value: 9456 },
    { id: "mock-catches-5", displayName: "Gió Biển", value: 8720 },
    { id: "mock-catches-6", displayName: "Bờ Cát Trắng", value: 7985 },
    { id: "mock-catches-7", displayName: "Thuyền Giấy", value: 6432 },
    { id: "mock-catches-8", displayName: "Nắng Sớm", value: 5810 },
  ],
  largest: [
    { id: "mock-largest-1", displayName: "Sóng Xanh", value: 128.6 },
    { id: "mock-largest-2", displayName: "Gió Biển", value: 115.25 },
    { id: "mock-largest-3", displayName: "Cần Thủ Miền Tây", value: 102.8 },
    { id: "mock-largest-4", displayName: "Nắng Sớm", value: 96.4 },
    { id: "mock-largest-5", displayName: "Thuyền Giấy", value: 89.75 },
    { id: "mock-largest-6", displayName: "Mây Lang Thang", value: 84.2 },
    { id: "mock-largest-7", displayName: "Chú Cá Nhỏ", value: 78.9 },
    { id: "mock-largest-8", displayName: "Bờ Cát Trắng", value: 72.35 },
  ],
  collection: [
    { id: "mock-collection-1", displayName: "Mây Lang Thang", value: 186 },
    { id: "mock-collection-2", displayName: "Thuyền Giấy", value: 174 },
    { id: "mock-collection-3", displayName: "Bờ Cát Trắng", value: 168 },
    { id: "mock-collection-4", displayName: "Sóng Xanh", value: 152 },
    { id: "mock-collection-5", displayName: "Cần Thủ Miền Tây", value: 145 },
    { id: "mock-collection-6", displayName: "Nắng Sớm", value: 132 },
    { id: "mock-collection-7", displayName: "Gió Biển", value: 127 },
    { id: "mock-collection-8", displayName: "Chú Cá Nhỏ", value: 118 },
  ],
};
