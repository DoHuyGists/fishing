import type { StoryScript, StoryText } from '../model/story';

export interface StoryDraftRow {
  id: string;
  draft: StoryScript;
  revision: number;
  published_version: number | null;
  enabled: boolean;
  sort_order: number;
  updated_at: string;
}
export interface StoryReleaseRow {
  story_id: string;
  version: number;
  script: StoryScript;
  created_at: string;
}
export interface StoryDraftSummary extends Omit<StoryDraftRow, 'draft'> { title: StoryText }
export interface StorySaveResult { id: string; revision: number; published_version: number | null }
export interface StoryAsset { name: string; url: string; kind: 'image' | 'audio' }
