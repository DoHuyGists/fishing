import { defineStore } from 'pinia';
import { supabaseStoryRepository as repository } from '../data/supabaseStoryRepository';
import { storyDemo, STORY_DEMO_ID } from '../data/storyDemo';
import type { StoryCatalogItem, StoryProgress, StoryScript } from '../types/model/story';
import { copyStory } from '../utils/story';
import { t } from '../i18n';

// Keep node checkpoints ordered even when the network is slower than the reader.
let progressQueue: Promise<void> = Promise.resolve();

export const useStoryStore = defineStore('storyLibrary', {
  state: () => ({ items: [] as StoryCatalogItem[], script: null as StoryScript | null, version: 0, progress: null as StoryProgress | null, pendingProgress: {} as Record<string, StoryProgress>, sessionGeneration: 0, loading: false, error: '', progressError: '', demo: false, sequence: 0, owner: '', preview: null as { script: StoryScript; nodeId: string } | null }),
  actions: {
    reset(owner: string) {
      this.sequence++; this.sessionGeneration++; this.owner = owner; this.items = []; this.script = null; this.progress = null; this.pendingProgress = {}; this.preview = null; this.error = ''; this.progressError = ''; this.loading = false;
    },
    async loadCatalog() {
      const sequence = ++this.sequence;
      this.loading = true; this.error = '';
      try { const items = await repository.catalog(); if (sequence === this.sequence) this.items = items; }
      catch (e) { if (sequence === this.sequence) { this.items = []; this.error = e instanceof Error ? e.message : t('Story.loadError'); } }
      finally { if (sequence === this.sequence) this.loading = false; }
    },
    async open(id: string, demo = false) {
      const sequence = ++this.sequence;
      this.loading = true; this.error = ''; this.progressError = ''; this.script = null; this.progress = null; this.demo = demo; this.version = 0;
      try {
        if (demo && id === STORY_DEMO_ID) { this.script = copyStory(storyDemo); return; }
        const result = await repository.release(id);
        if (sequence !== this.sequence) return;
        this.version = result.version;
        this.script = result.script;
        try {
          const progress = await repository.progress(id, result.version);
          if (sequence === this.sequence) this.progress = this.pendingProgress[`${id}:${result.version}`] ?? progress;
        } catch { if (sequence === this.sequence) { this.progress = this.pendingProgress[`${id}:${result.version}`] ?? null; this.progressError = t('Story.progressError'); } }
      } catch (e) { if (sequence === this.sequence) this.error = e instanceof Error ? e.message : t('Story.loadError'); }
      finally { if (sequence === this.sequence) this.loading = false; }
    },
    async persist(progress: StoryProgress, owner: string) {
      if (!progress.version || this.owner !== owner) return;
      const generation = this.sessionGeneration;
      const key = `${progress.story_id}:${progress.version}`;
      this.pendingProgress[key] = copyStory(progress);
      const snapshot = JSON.stringify(progress);
      progressQueue = progressQueue.then(async () => {
        if (this.owner !== owner || this.sessionGeneration !== generation) return;
        try {
          await repository.saveProgress(progress);
          if (this.owner === owner && this.sessionGeneration === generation) {
            if (JSON.stringify(this.pendingProgress[key]) === snapshot) delete this.pendingProgress[key];
            if (!Object.keys(this.pendingProgress).length) this.progressError = '';
          }
        }
        catch { if (this.owner === owner && this.sessionGeneration === generation) this.progressError = t('Story.progressError'); }
      });
      await progressQueue;
    },
    async retryProgress() {
      const owner = this.owner;
      for (const progress of Object.values(copyStory(this.pendingProgress))) await this.persist(progress, owner);
    },
  },
});
