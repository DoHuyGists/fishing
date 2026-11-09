import supabase from "../database/connection";
import { createUuid } from "../utils/uuid";

export const ASSET_MAX_BYTES = 50 * 1024 * 1024;
export const ASSET_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif",
  "image/webp": "webp", "image/avif": "avif",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
};
export interface AssetRow {
  path: string;
  name: string;
  url: string;
  kind: "image" | "video";
  size: number;
  createdAt: string;
}

const bucket = "admin-assets";
const storage = () => supabase.storage.from(bucket);

export const supabaseAssetRepository = {
  async fetchAll(): Promise<AssetRow[]> {
    const rows: AssetRow[] = [];
    const limit = 1000;
    for (let offset = 0; ; offset += limit) {
      const { data, error } = await storage().list("", {
        limit, offset, sortBy: { column: "name", order: "asc" },
      });
      if (error) throw new Error(error.message);
      for (const item of data ?? []) {
        if (!item.id) continue;
        const mime = String(item.metadata?.mimetype ?? "");
        if (!mime.startsWith("image/") && !mime.startsWith("video/")) continue;
        rows.push({
          path: item.name,
          name: item.name.replace(/^[0-9a-f-]{36}_/i, ""),
          url: storage().getPublicUrl(item.name).data.publicUrl,
          kind: mime.startsWith("video/") ? "video" : "image",
          size: Number(item.metadata?.size ?? 0),
          createdAt: item.created_at ?? "",
        });
      }
      if (!data || data.length < limit) break;
    }
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.path.localeCompare(b.path));
  },
  async upload(file: File): Promise<AssetRow> {
    const extension = ASSET_MIME_TYPES[file.type];
    if (!extension) throw new Error("Chỉ hỗ trợ JPG, PNG, GIF, WebP, AVIF, MP4, WebM và MOV.");
    if (!file.size || file.size > ASSET_MAX_BYTES) throw new Error("Tệp phải có dung lượng lớn hơn 0 và tối đa 50 MB.");
    const stem = file.name.replace(/\.[^.]+$/, "").normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d")
      .replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "asset";
    const name = `${stem}.${extension}`;
    const path = `${createUuid()}_${name}`;
    const { error } = await storage().upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new Error(error.message);
    return {
      path, name, url: storage().getPublicUrl(path).data.publicUrl,
      kind: file.type.startsWith("video/") ? "video" : "image",
      size: file.size, createdAt: new Date().toISOString(),
    };
  },
  async remove(path: string): Promise<void> {
    const { data, error } = await storage().remove([path]);
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error("Tệp không còn tồn tại hoặc bạn không có quyền xóa.");
  },
};
