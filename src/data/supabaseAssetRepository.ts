import supabase from "../database/connection";
import { createUuid } from "../utils/uuid";
import { normalizeAssetFolder } from "../utils/assetFolders";

export const ASSET_MAX_BYTES = 50 * 1024 * 1024;
export const ASSET_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif",
  "image/webp": "webp", "image/avif": "avif",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
};
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

interface AssetRecord extends Omit<AssetRow, "url" | "createdAt"> {
  created_at: string;
}

const bucket = "admin-assets";
const columns = "id, path, folder, name, kind, size, created_at";
const storage = () => supabase.storage.from(bucket);
const toRow = (row: AssetRecord): AssetRow => ({
  id: row.id, path: row.path, folder: row.folder, name: row.name,
  kind: row.kind, size: Number(row.size), createdAt: row.created_at,
  url: storage().getPublicUrl(row.path).data.publicUrl,
});

export const supabaseAssetRepository = {
  async fetchAll(): Promise<AssetRow[]> {
    const rows: AssetRow[] = [];
    const limit = 1000;
    for (let offset = 0; ; offset += limit) {
      const { data, error } = await supabase.from("assets").select(columns)
        .order("created_at", { ascending: false }).order("id", { ascending: true })
        .range(offset, offset + limit - 1);
      if (error) throw new Error(error.message);
      rows.push(...((data ?? []) as AssetRecord[]).map(toRow));
      if (!data || data.length < limit) break;
    }
    return rows;
  },
  async upload(file: File, destination = ""): Promise<AssetRow> {
    const folder = normalizeAssetFolder(destination);
    const extension = ASSET_MIME_TYPES[file.type];
    if (!extension) throw new Error("Chỉ hỗ trợ JPG, PNG, GIF, WebP, AVIF, MP4, WebM và MOV.");
    if (!file.size || file.size > ASSET_MAX_BYTES) throw new Error("Tệp phải có dung lượng lớn hơn 0 và tối đa 50 MB.");
    const stem = file.name.replace(/\.[^.]+$/, "").normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d")
      .replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "asset";
    const name = `${stem}.${extension}`;
    const id = createUuid();
    const path = `${id}_${name}`;
    const { error: uploadError } = await storage().upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw new Error(uploadError.message);
    const { data, error } = await supabase.from("assets").insert({
      id, path, folder, name, kind: file.type.startsWith("video/") ? "video" : "image", size: file.size,
    }).select(columns).single();
    if (error) {
      if (!error.code) {
        // A lost response may still have committed the insert. Verify before deleting its file.
        const { data: existing, error: lookupError } = await supabase.from("assets")
          .select(columns).eq("id", id).maybeSingle();
        if (existing) return toRow(existing as AssetRecord);
        if (lookupError) {
          throw new Error(`Chưa xác định được kết quả lưu tệp. Hãy làm mới kho trước khi tải lại. Mã tệp: ${id}. ${error.message}`);
        }
      }
      const { error: cleanupError } = await storage().remove([path]);
      if (cleanupError) {
        throw new Error(`Không thể lưu thông tin hoặc dọn tệp trên Storage (${path}): ${error.message}. ${cleanupError.message}`);
      }
      throw new Error(`Không thể lưu thông tin tệp: ${error.message}`);
    }
    return toRow(data as AssetRecord);
  },
  async move(id: string, destination: string): Promise<AssetRow> {
    const folder = normalizeAssetFolder(destination);
    const { data, error } = await supabase.from("assets").update({ folder })
      .eq("id", id).select(columns).single();
    if (error) throw new Error(error.message);
    return toRow(data as AssetRecord);
  },
  async moveFolder(source: string, destination: string): Promise<void> {
    const { error } = await supabase.rpc("assets_move_folder", {
      source_folder: normalizeAssetFolder(source), target_folder: normalizeAssetFolder(destination),
    });
    if (error) throw new Error(error.message);
  },
  async remove(row: Pick<AssetRow, "id" | "path">): Promise<void> {
    const { error } = await storage().remove([row.path]);
    if (error) throw new Error(error.message);
    // Keep the record on failure so deletion can be retried after an idempotent Storage removal.
    const { error: recordError } = await supabase.from("assets").delete().eq("id", row.id).select("id").single();
    if (recordError) throw new Error(`Tệp đã được xóa khỏi Storage nhưng chưa xóa được thông tin. Hãy thử xóa lại. ${recordError.message}`);
  },
};
