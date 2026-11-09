import supabase from "../database/connection";
import { createUuid } from "../utils/uuid";
const bucket = 'player-profile-avatars';
export const supabaseAvatarRepository = {
  async upload(userId: string, file: File) {
    const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as Record<string, string>)[file.type];
    if (!extension || file.size > 2 * 1024 * 1024) throw new Error("Chọn ảnh JPG, PNG hoặc WebP tối đa 2 MB.");
    const path = `${userId}/${createUuid()}.${extension}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type });
    if (error) throw new Error(error.message);
    return path;
  },
  async remove(path: string) { await supabase.storage.from(bucket).remove([path]); },
  async resolveProfiles<T extends { avatar_path?: string | null; avatar_url: string | null }>(profiles: T[]): Promise<T[]> {
    const paths = [...new Set(profiles.flatMap(p => p.avatar_path ? [p.avatar_path] : []))];
    if (!paths.length) return profiles;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, 86400);
    const urls = new Map(error ? [] : (data ?? []).map(item => [item.path, item.signedUrl]));
    return profiles.map(profile => ({ ...profile, avatar_url: profile.avatar_path ? urls.get(profile.avatar_path) || null : profile.avatar_url }));
  },
};
