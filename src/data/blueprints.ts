import type { Blueprint } from "../types/model/blueprintCatalog";
import { t as tr } from "../i18n";

// Mock tạm, sẽ thay bằng dữ liệu thật sau.
export const blueprints: Blueprint[] = [
  {
    id: "bp-basic-rod",
    get name() { return tr('blueprints.can_cau_co_ban'); },
    result: { category: "Rod", get name() { return tr('blueprints.can_cau_co_ban'); }, quantity: 1 },
    pattern: [
      [null, null, "Line"],
      [null, "Line", "Hook"],
      ["Line", null, "Sinker"],
    ],
  },
  {
    id: "bp-lure",
    get name() { return tr('blueprints.moi_gia'); },
    result: { category: "Lure", get name() { return tr('blueprints.moi_gia'); }, quantity: 2 },
    pattern: [
      ["Hook", "Bait"],
      ["Swivel", "Bait"],
    ],
  },
  {
    id: "bp-float",
    get name() { return tr('blueprints.phao_cau'); },
    result: { category: "Float", get name() { return tr('blueprints.phao_cau'); }, quantity: 1 },
    pattern: [["Line"], ["Float"], ["Sinker"]],
  },
  {
    id: "bp-box",
    get name() { return tr('blueprints.hop_do_cau'); },
    result: { category: "Box", get name() { return tr('blueprints.hop_do_cau_lon'); }, quantity: 1 },
    pattern: [
      ["Box", "Box"],
      ["Bag", "Tool"],
    ],
  },
];
