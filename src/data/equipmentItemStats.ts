import { getFormattingLocale, t as tr } from "../i18n";
import type { InformationModalField } from "../types/model/informationModal";
import { healthSlots, survivalResources } from "./healthEquipment";

export function equipmentItemStats(item: object): InformationModalField[] {
  const data = item as Record<string, unknown>;
  const rows: InformationModalField[] = [];
  const addNumber = (value: unknown, label: string, percent = false, unit = "") => {
    if (typeof value !== "number" || !Number.isFinite(value)) return;
    rows.push({
      label,
      value: `${value.toLocaleString(getFormattingLocale(), {
        style: percent ? "percent" : "decimal",
        maximumFractionDigits: 2,
      })}${unit}`,
    });
  };

  addNumber(data.quantity, tr("ShopModal.so_luong"));
  addNumber(data.max_weight ?? data.rodMaxWeight ?? data.lineMaxWeight, tr("InventoryItemCard.tai_trong_toi_da"), false, " kg");
  addNumber(data.pull_strength, tr("InventoryItemCard.suc_keo"));
  addNumber(data.durability ?? data.reelDurability, tr("InventoryItemCard.do_ben"));
  addNumber(data.catch_rate, tr("InventoryItemCard.bonus_moc_ca"), true);
  addNumber(data.luck_bonus, tr("InventoryItemCard.may_man"));

  if (healthSlots.some((slot) => slot === data.category)) {
    const bonuses = data.health_bonuses;
    if (bonuses && typeof bonuses === "object") {
      for (const resource of survivalResources) {
        const value = (bonuses as Record<string, unknown>)[resource];
        if (typeof value === "number" && Number.isFinite(value) && value > 0) {
          rows.push({ label: tr(`Health.${resource}`), value: `+${value.toLocaleString(getFormattingLocale())}` });
        }
      }
    }
  }

  if (Array.isArray(data.fish_type)) {
    const value = data.fish_type.filter((type): type is string => typeof type === "string" && type.trim() !== "").join(", ");
    if (value) rows.push({ label: tr("InventoryItemCard.nhom_ca"), value });
  }
  return rows;
}
