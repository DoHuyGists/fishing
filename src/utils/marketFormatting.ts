import { getFormattingLocale } from "../i18n/index.ts";

export function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString(getFormattingLocale(), {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
export function getRarityBadgeClass(rarity: string | null | undefined) {
  switch (rarity?.toUpperCase()) {
    case "HUYỀN THOẠI":
      return "bg-amber-100 text-amber-800 border-amber-300";
    case "SỬ THI":
      return "bg-purple-100 text-purple-800 border-purple-300";
    case "HIẾM":
      return "bg-blue-100 text-blue-800 border-blue-300";
    default:
      return "bg-gray-100 text-gray-700 border-gray-300";
  }
}
