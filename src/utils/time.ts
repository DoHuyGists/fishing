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