import type { Pond, PondStatus } from '../../../stores/fishfarm'

export const statusLabel: Record<PondStatus, string> = { ok: 'Ổn định', warn: 'Cần theo dõi', alert: 'Cần xử lý' }
export const statusChip: Record<PondStatus, string> = {
  ok: 'bg-emerald-100 text-emerald-800', warn: 'bg-amber-100 text-amber-800', alert: 'bg-red-100 text-red-800',
}
export const progressOf = (p: Pond) => !p.fishCount ? 'Hồ trống' : p.growth >= 100 ? 'Sẵn sàng thu hoạch' : p.fullness <= 0 ? 'Cá đói · Ngừng lớn' : p.fullness < 30 ? 'Cá đói · Lớn chậm' : 'Đang lớn'
