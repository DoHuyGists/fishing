export interface AssetRow {
  id: string;
  path: string;
  folder: string;
  name: string;
  url: string;
  kind: "image" | "video";
  size: number;
  createdAt: string;
}

export interface AssetRecord extends Omit<AssetRow, "url" | "createdAt"> {
  created_at: string;
}
