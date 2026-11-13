export interface EquipmentStatDisplay {
  id: string;
  label: string;
  value: string;
}

export interface EquipmentVariant {
  id: string;
  name: string;
  detail: string;
  icon: string;
  image?: string | null;
  is_used?: boolean;
  rodMaxWeight?: number;
  lineMaxWeight?: number;
  reelDurability?: number;
  hookStrength?: number;
  baitName?: string;
  quantity?: number | null;
}
