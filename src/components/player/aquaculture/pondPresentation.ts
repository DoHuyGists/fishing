export function formatDuration(seconds: number): string {
  if (seconds <= 0) return 'Đã đến giờ'
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return `${minutes} phút`
  const hours = Math.floor(minutes / 60), rest = minutes % 60
  if (hours < 24) return `${hours} giờ${rest ? ` ${rest} phút` : ''}`
  return `${Math.floor(hours / 24)} ngày${hours % 24 ? ` ${hours % 24} giờ` : ''}`
}

export function fishImageUrl(image: string | null): string {
  if (!image) return `${import.meta.env.BASE_URL}fish/VN/Carp.png`
  if (/^(https?:|data:|blob:)/i.test(image)) return image
  return `${import.meta.env.BASE_URL}${image.replace(/^\//, '')}`
}
