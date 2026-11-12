import type { ActivityMilestone } from "../types/model/factionActivityMilestones";
import { t as tr } from "../i18n";

/**
 * 10 mốc phần thưởng năng động với điểm lũy tiến (mốc càng cao càng cần nhiều điểm hơn mốc trước).
 * Delta giữa các mốc: +10, +15, +20, +25, +35, +45, +60, +75, +95, +120
 */
export const FACTION_ACTIVITY_MILESTONES: readonly ActivityMilestone[] = [
  { level: 1,  points: 10,  get title() { return tr('factionActivityMilestones.moi_bat_dau'); },              get reward() { return tr('factionActivityMilestones.1_000_vang_5_moi_thuong'); },           icon: "🪱" },
  { level: 2,  points: 25,  get title() { return tr('factionActivityMilestones.cau_deu_dan'); },              get reward() { return tr('factionActivityMilestones.2_500_vang_10_moi_thuong'); },          icon: "🎣" },
  { level: 3,  points: 45,  get title() { return tr('factionActivityMilestones.ca_can_moi'); },               get reward() { return tr('factionActivityMilestones.5_000_vang_1_hop_moi_cao_cap'); },      icon: "🐟" },
  { level: 4,  points: 70,  get title() { return tr('factionActivityMilestones.keo_ca_len'); },               get reward() { return tr('factionActivityMilestones.8_000_vang_1_can_cau_so_cap'); },       icon: "🪝" },
  { level: 5,  points: 105, get title() { return tr('factionActivityMilestones.cau_cung_hoi'); },             get reward() { return tr('factionActivityMilestones.12_000_vang_1_ruong_do_cau_so'); },     icon: "📦" },
  { level: 6,  points: 150, get title() { return tr('factionActivityMilestones.hoi_vien_tich_cuc'); },        get reward() { return tr('factionActivityMilestones.18_000_vang_2_ve_cau_vip'); },          icon: "🎟️" },
  { level: 7,  points: 210, get title() { return tr('factionActivityMilestones.nguoi_cau_gioi'); },           get reward() { return tr('factionActivityMilestones.25_000_vang_1_can_cau_trung_cap'); },   icon: "🏆" },
  { level: 8,  points: 285, get title() { return tr('factionActivityMilestones.cao_thu_hoi_cau'); },          get reward() { return tr('factionActivityMilestones.35_000_vang_1_ruong_do_cau_tinh_anh'); }, icon: "💎" },
  { level: 9,  points: 380, get title() { return tr('factionActivityMilestones.ngoi_sao_hoi_cau'); },         get reward() { return tr('factionActivityMilestones.50_000_vang_3_hop_moi_hiem'); },        icon: "🔮" },
  { level: 10, points: 500, get title() { return tr('factionActivityMilestones.top_cau_ca'); },               get reward() { return tr('factionActivityMilestones.80_000_vang_1_ve_su_kien'); },    icon: "👑" },
] as const;
