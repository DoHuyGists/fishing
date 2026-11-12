export type ItemCategory = (typeof import("../../data/items").items)[number]["category"];

export interface Blueprint {
  id: string;
  name: string;
  result: { category: ItemCategory; name: string; quantity: number };
  // Lưới công thức theo từng hàng; null là ô trống. Vị trí tuyệt đối không quan trọng, chỉ cần đúng hình dạng.
  pattern: (ItemCategory | null)[][];
}
