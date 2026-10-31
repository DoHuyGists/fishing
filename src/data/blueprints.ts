export type ItemCategory = (typeof import("./items.ts").items)[number]["category"];

export interface Blueprint {
  id: string;
  name: string;
  result: { category: ItemCategory; name: string; quantity: number };
  // Lưới công thức theo từng hàng; null là ô trống. Vị trí tuyệt đối không quan trọng, chỉ cần đúng hình dạng.
  pattern: (ItemCategory | null)[][];
}

// Mock tạm, sẽ thay bằng dữ liệu thật sau.
export const blueprints: Blueprint[] = [
  {
    id: "bp-basic-rod",
    name: "Cần câu cơ bản",
    result: { category: "Rod", name: "Cần câu cơ bản", quantity: 1 },
    pattern: [
      [null, null, "Line"],
      [null, "Line", "Hook"],
      ["Line", null, "Sinker"],
    ],
  },
  {
    id: "bp-lure",
    name: "Mồi giả",
    result: { category: "Lure", name: "Mồi giả", quantity: 2 },
    pattern: [
      ["Hook", "Bait"],
      ["Swivel", "Bait"],
    ],
  },
  {
    id: "bp-float",
    name: "Phao câu",
    result: { category: "Float", name: "Phao câu", quantity: 1 },
    pattern: [["Line"], ["Float"], ["Sinker"]],
  },
  {
    id: "bp-box",
    name: "Hộp đồ câu",
    result: { category: "Box", name: "Hộp đồ câu lớn", quantity: 1 },
    pattern: [
      ["Box", "Box"],
      ["Bag", "Tool"],
    ],
  },
];
