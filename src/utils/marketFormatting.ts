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
      return "bg-surface text-gold border-gold";
    case "SỬ THI":
      return "bg-surface text-special border-special";
    case "HIẾM":
      return "bg-surface text-primary border-primary";
    default:
      return "bg-surface text-content border-content";
  }
}
