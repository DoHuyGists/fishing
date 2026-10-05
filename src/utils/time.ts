import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);

export function formatDateTime(value: string | Date) {
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatTime(value: string) {
  if (!value) return '';

  // 1. Tách lấy chỉ phần giờ (HH:mm:ss hoặc HH:mm), bỏ phần đuôi +00/Z nếu có
  const cleanTime = value.split('+')[0].replace('Z', '').trim();

  // 2. Lấy ngày hiện tại theo chuẩn YYYY-MM-DD
  const todayStr = dayjs().format('YYYY-MM-DD');

  // 3. Ghép thành ISO hoàn chỉnh dạng YYYY-MM-DDTHH:mm:ssZ rồi parse UTC -> chuyển sang Local
  const parsed = dayjs.utc(`${todayStr}T${cleanTime}`);

  // Kiểm tra nếu chuỗi đầu vào bị sai định dạng
  if (!parsed.isValid()) {
    console.error('Invalid time format from Supabase:', value);
    return value;
  }

  return parsed.local().format('HH:mm:ss');
}

// Parse timestamp UTC của Supabase (vd "2026-10-05T15:01:00.034781+00:00" hoặc "2026-10-05 15:01:00+00") thành epoch ms; NaN nếu sai định dạng
export function utcToLocalMs(value: string | null | undefined): number {
  if (!value) return NaN;
  let s = value.trim().replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1');
  if (/[+-]\d{2}$/.test(s) && s.includes('T')) s += ':00';
  else if (!/(Z|[+-]\d{2}:\d{2})$/i.test(s)) s += 'Z';
  return new Date(s).getTime();
}
