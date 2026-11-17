import supabase from '../database/connection';
import { RepositoryError } from './repositoryError';
import type { StoryCatalogItem, StoryProgress, StoryScript } from '../types/model/story';
import type { StoryAsset, StoryDraftRow, StoryDraftSummary, StoryReleaseRow, StorySaveResult } from '../types/table/story';
import { parseStory } from '../utils/story';
import { createUuid } from '../utils/uuid';

const mediaStorage = () => supabase.storage.from('story-media');
const mediaTypes: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/avif': 'avif', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mp4': 'm4a', 'audio/webm': 'webm' };

export const supabaseStoryRepository = {
  async media(): Promise<StoryAsset[]> {
    const { data, error } = await mediaStorage().list('', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) throw new RepositoryError(error);
    return (data ?? []).filter(file => file.id).map(file => ({ name: file.name, url: mediaStorage().getPublicUrl(file.name).data.publicUrl, kind: file.metadata?.mimetype?.startsWith('audio/') ? 'audio' : 'image' }));
  },
  async upload(file: File): Promise<StoryAsset> {
    const extension = mediaTypes[file.type];
    if (!extension || file.size === 0 || file.size > 30 * 1024 * 1024) throw new Error('Ảnh/audio tối đa 30 MB; PNG, JPEG, WebP, AVIF, MP3, OGG, WAV, M4A hoặc WebM.');
    const name = `${createUuid()}-${file.name.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 60)}.${extension}`;
    const { error } = await mediaStorage().upload(name, file, { contentType: file.type, upsert: false });
    if (error) throw new RepositoryError(error);
    return { name: file.name, url: mediaStorage().getPublicUrl(name).data.publicUrl, kind: file.type.startsWith('audio/') ? 'audio' : 'image' };
  },
  async catalog(): Promise<StoryCatalogItem[]> {
    const { data, error } = await supabase.rpc('story_catalog');
    if (error) throw new RepositoryError(error);
    return data ?? [];
  },
  async release(id: string): Promise<StoryReleaseRow> {
    const { data, error } = await supabase.rpc('story_get', { p_id: id });
    if (error) throw new RepositoryError(error);
    return { ...data, script: parseStory(data.script) };
  },
  async progress(id: string, version: number): Promise<StoryProgress | null> {
    const { data, error } = await supabase.from('story_progress').select('story_id,version,node_id,history,completed,skipped').eq('story_id', id).eq('version', version).maybeSingle();
    if (error) throw new RepositoryError(error);
    return data as StoryProgress | null;
  },
  async saveProgress(progress: StoryProgress): Promise<void> {
    const { error } = await supabase.rpc('story_save_progress', { p_story: progress.story_id, p_version: progress.version, p_node: progress.node_id, p_history: progress.history, p_completed: progress.completed, p_skipped: progress.skipped });
    if (error) throw new RepositoryError(error);
  },
  async drafts(): Promise<StoryDraftSummary[]> {
    const { data, error } = await supabase.from('story_scripts').select('id,title:draft->title,revision,published_version,enabled,sort_order,updated_at').order('sort_order').order('id').limit(1000);
    if (error) throw new RepositoryError(error);
    return data as StoryDraftSummary[];
  },
  async draft(id: string): Promise<StoryDraftRow> {
    const { data, error } = await supabase.from('story_scripts').select('*').eq('id', id).single();
    if (error) throw new RepositoryError(error);
    return { ...data, draft: parseStory(data.draft) } as StoryDraftRow;
  },
  async save(script: StoryScript, revision: number, sortOrder: number): Promise<StorySaveResult> {
    const { data, error } = await supabase.rpc('story_save_draft', { p_script: script, p_revision: revision, p_sort_order: sortOrder });
    if (error) throw new RepositoryError(error);
    return data;
  },
  async publish(id: string, revision: number): Promise<number> {
    const { data, error } = await supabase.rpc('story_publish', { p_id: id, p_revision: revision });
    if (error) throw new RepositoryError(error);
    return data;
  },
  async unpublish(id: string): Promise<void> {
    const { error } = await supabase.rpc('story_unpublish', { p_id: id });
    if (error) throw new RepositoryError(error);
  },
};
