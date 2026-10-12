export interface ActivityMilestone {
  readonly level: number;
  readonly points: number;
  readonly title: string;
  readonly reward: string;
  readonly icon: string;
}

/**
 * 10 mốc phần thưởng năng động với điểm lũy tiến (mốc càng cao càng cần nhiều điểm hơn mốc trước).
 * Delta giữa các mốc: +10, +15, +20, +25, +35, +45, +60, +75, +95, +120
 */
export const FACTION_ACTIVITY_MILESTONES: readonly ActivityMilestone[] = [
  { level: 1,  points: 10,  title: "Mới Bắt Đầu",              reward: "1.000 Vàng + 5 Mồi Thường",           icon: "🪱" },
  { level: 2,  points: 25,  title: "Câu Đều Đặn",              reward: "2.500 Vàng + 10 Mồi Thường",          icon: "🎣" },
  { level: 3,  points: 45,  title: "Cá Cắn Mồi",               reward: "5.000 Vàng + 1 Hộp Mồi Cao Cấp",      icon: "🐟" },
  { level: 4,  points: 70,  title: "Kéo Cá Lên",               reward: "8.000 Vàng + 1 Cần Câu Sơ Cấp",       icon: "🪝" },
  { level: 5,  points: 105, title: "Câu Cùng Hội",             reward: "12.000 Vàng + 1 Rương Đồ Câu Sơ",     icon: "📦" },
  { level: 6,  points: 150, title: "Hội Viên Tích Cực",        reward: "18.000 Vàng + 2 Vé Câu VIP",          icon: "🎟️" },
  { level: 7,  points: 210, title: "Người Câu Giỏi",           reward: "25.000 Vàng + 1 Cần Câu Trung Cấp",   icon: "🏆" },
  { level: 8,  points: 285, title: "Cao Thủ Hội Câu",          reward: "35.000 Vàng + 1 Rương Đồ Câu Tinh Anh", icon: "💎" },
  { level: 9,  points: 380, title: "Ngôi Sao Hội Câu",         reward: "50.000 Vàng + 3 Hộp Mồi Hiếm",        icon: "🔮" },
  { level: 10, points: 500, title: "Top Câu Cá",               reward: "80.000 Vàng + 1 vé sự kiện",    icon: "👑" },
] as const;
