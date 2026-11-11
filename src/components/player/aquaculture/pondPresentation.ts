import { t as tr } from "../../../i18n";
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return tr('pondPresentation.da_den_gio')
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return tr('pondPresentation.value0_phut', { value0: minutes })
  const hours = Math.floor(minutes / 60), rest = minutes % 60
  if (hours < 24) return tr('pondPresentation.value0_gio_value1', { value0: hours, value1: rest ? ` ${tr('pondPresentation.value0_phut', { value0: rest })}` : '' })
  return tr('pondPresentation.value0_ngay_value1', { value0: Math.floor(hours / 24), value1: hours % 24 ? ` ${tr('pondPresentation.value0_gio', { value0: hours % 24 })}` : '' })
}

export function fishImageUrl(image: string | null): string {
  if (!image) return `${import.meta.env.BASE_URL}fish/VN/Carp.png`
  if (/^(https?:|data:|blob:)/i.test(image)) return image
  return `${import.meta.env.BASE_URL}${image.replace(/^\//, '')}`
}
