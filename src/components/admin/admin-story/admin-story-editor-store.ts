import { defineStore } from 'pinia';
import { supabaseStoryRepository as repository } from '../../../data/supabaseStoryRepository';
import { storyDemo } from '../../../data/storyDemo';
import { copyStory, createStoryNode, parseStory, storyText, validateStory } from '../../../utils/story';
import { createUuid } from '../../../utils/uuid';
import type { StoryScript } from '../../../types/model/story';
import type { StoryAsset, StoryDraftRow, StoryDraftSummary } from '../../../types/table/story';

export const useStoryEditorStore = defineStore('storyEditor', {
  state: () => ({ draft: null as StoryScript | null, rows: [] as StoryDraftSummary[], assets: [] as StoryAsset[], mediaBusy: false, selectedId: '', revision: 0, publishedVersion: null as number | null, enabled: false, sortOrder: 0, busy: false, error: '', notice: '', baseline: '', owner: '', dragId: '', panel: 'node' as 'node' | 'script' | 'assets', restored: false }),
  getters: {
    node: s => s.draft?.nodes.find(n => n.id === s.selectedId) ?? null,
    dirty: s => Boolean(s.draft && JSON.stringify({ draft: s.draft, sortOrder: s.sortOrder }) !== s.baseline),
    validation: s => s.draft ? validateStory(s.draft) : { errors: [], warnings: [] },
  },
  actions: {
    async loadMedia() {
      const owner = this.owner;
      this.mediaBusy = true;
      try { const assets = await repository.media(); if (this.owner === owner) this.assets = assets; }
      catch (e) { if (this.owner === owner) this.error = e instanceof Error ? e.message : 'Không tải được media.'; }
      finally { if (this.owner === owner) this.mediaBusy = false; }
    },
    async upload(file: File) {
      const owner = this.owner;
      this.mediaBusy = true; this.error = '';
      try { const asset = await repository.upload(file); if (this.owner === owner) { this.assets.unshift(asset); this.notice = 'Đã tải media lên kho story.'; } }
      catch (e) { if (this.owner === owner) this.error = e instanceof Error ? e.message : 'Không tải lên được media.'; }
      finally { if (this.owner === owner) this.mediaBusy = false; }
    },
    key() { return `story.editor.v1.${this.owner}`; },
    initialize(owner: string) {
      if (this.owner === owner && this.draft) return;
      this.$reset(); this.owner = owner;
      try {
        const saved = JSON.parse(localStorage.getItem(this.key()) ?? 'null');
        if (saved?.draft) {
          // Local drafts may be temporarily invalid while being edited.
          if (saved.draft.schemaVersion === 1 && Array.isArray(saved.draft.nodes) && Array.isArray(saved.draft.characters)) {
            this.draft = saved.draft; this.selectedId = saved.selectedId; this.revision = saved.revision ?? 0;
            this.sortOrder = saved.sortOrder ?? 0; this.baseline = saved.baseline ?? ''; this.publishedVersion = saved.publishedVersion ?? null; this.enabled = saved.enabled === true; this.restored = true;
          }
        }
      } catch { this.notice = 'Không đọc được bản nháp cục bộ.'; }
      if (!this.draft) this.newScript();
    },
    cache() {
      if (!this.owner || !this.draft) return;
      try { localStorage.setItem(this.key(), JSON.stringify({ draft: this.draft, selectedId: this.selectedId, revision: this.revision, sortOrder: this.sortOrder, baseline: this.baseline, publishedVersion: this.publishedVersion, enabled: this.enabled })); }
      catch { this.error = 'Không lưu được bản nháp cục bộ. Hãy xuất JSON để giữ nội dung.'; }
    },
    newScript(sample = false) {
      const node = createStoryNode();
      this.draft = sample ? copyStory(storyDemo) : { schemaVersion: 1, id: createUuid(), title: storyText('Chương mới', 'New chapter'), summary: storyText(), startNodeId: node.id, characters: copyStory(storyDemo.characters), nodes: [node] };
      if (sample) this.draft.id = createUuid();
      this.selectedId = this.draft.startNodeId; this.revision = 0; this.publishedVersion = null; this.enabled = false; this.baseline = ''; this.sortOrder = 0; this.error = ''; this.notice = ''; this.cache();
    },
    applyDraft(row: StoryDraftRow) {
      this.draft = copyStory(row.draft); this.selectedId = this.draft.startNodeId; this.revision = row.revision; this.publishedVersion = row.published_version; this.enabled = row.enabled; this.sortOrder = row.sort_order;
      this.baseline = JSON.stringify({ draft: this.draft, sortOrder: this.sortOrder }); this.error = ''; this.notice = ''; this.cache();
    },
    async select(id: string) {
      if (this.busy) return;
      const owner = this.owner; this.busy = true; this.error = '';
      try { const row = await repository.draft(id); if (this.owner === owner) this.applyDraft(row); }
      catch (e) { if (this.owner === owner) this.error = e instanceof Error ? e.message : 'Không mở được bản nháp.'; }
      finally { if (this.owner === owner) this.busy = false; }
    },
    importJson(content: string) {
      if (content.length > 2_000_000) throw new Error('JSON tối đa 2 MB.');
      const draft = parseStory(JSON.parse(content));
      // An import is a new chapter; it never silently overwrites an existing published chapter.
      draft.id = createUuid(); this.draft = draft; this.revision = 0; this.publishedVersion = null; this.enabled = false; this.baseline = ''; this.sortOrder = 0; this.error = ''; this.notice = 'Đã nhập JSON thành chương mới.'; this.selectedId = draft.startNodeId; this.cache();
    },
    addNode(duplicate = false) {
      if (!this.draft || this.draft.nodes.length >= 1000) return;
      const current = this.node;
      const node = duplicate && current ? copyStory(current) : createStoryNode();
      node.id = createUuid(); node.choices.forEach(c => { c.id = createUuid(); });
      const index = this.draft.nodes.findIndex(n => n.id === this.selectedId);
      this.draft.nodes.splice(index + 1, 0, node);
      if (!duplicate && current && !current.choices.length) { node.nextNodeId = current.nextNodeId; current.nextNodeId = node.id; }
      this.selectedId = node.id;
    },
    removeNode() {
      if (!this.draft || !this.node || this.draft.nodes.length < 2) return;
      const id = this.node.id, next = this.node.nextNodeId === id ? null : this.node.nextNodeId;
      for (const n of this.draft.nodes) { if (n.nextNodeId === id) n.nextNodeId = next; n.choices = n.choices.filter(c => c.nextNodeId !== id); }
      this.draft.nodes = this.draft.nodes.filter(n => n.id !== id);
      if (this.draft.startNodeId === id) this.draft.startNodeId = next ?? this.draft.nodes[0]!.id;
      this.selectedId = next ?? this.draft.nodes[0]!.id;
    },
    reorder(targetId: string, movingId?: string) {
      movingId ??= this.dragId;
      if (!this.draft || movingId === targetId) return;
      const from = this.draft.nodes.findIndex(n => n.id === movingId), to = this.draft.nodes.findIndex(n => n.id === targetId);
      if (from < 0 || to < 0) return;
      const [node] = this.draft.nodes.splice(from, 1); this.draft.nodes.splice(to, 0, node!); this.dragId = '';
    },
    async fetchDrafts() {
      const owner = this.owner;
      try { const rows = await repository.drafts(); if (this.owner === owner) this.rows = rows; }
      catch (e) { if (this.owner === owner) this.error = e instanceof Error ? e.message : 'Không tải được bản nháp.'; }
    },
    async save(publish = false) {
      if (!this.draft || this.busy) return;
      this.error = ''; this.notice = '';
      const validation = this.validation;
      if (validation.errors.length) { this.error = validation.errors.join('\n'); return; }
      this.busy = true;
      const snapshot = copyStory(this.draft), sortOrder = this.sortOrder, owner = this.owner;
      try {
        const result = await repository.save(snapshot, this.revision, sortOrder);
        if (this.owner !== owner) return;
        this.revision = result.revision; this.publishedVersion = result.published_version; this.baseline = JSON.stringify({ draft: snapshot, sortOrder });
        if (publish) { const version = await repository.publish(result.id, result.revision); if (this.owner !== owner) return; this.publishedVersion = version; this.enabled = true; }
        this.notice = publish ? 'Đã lưu và xuất bản phiên bản mới.' : 'Đã lưu bản nháp lên Supabase.';
        this.cache(); await this.fetchDrafts();
      } catch (e) { if (this.owner === owner) this.error = e instanceof Error ? e.message : 'Không lưu được. Bản nháp cục bộ vẫn còn.'; }
      finally { if (this.owner === owner) this.busy = false; }
    },
    async unpublish() {
      if (!this.draft || this.busy || !this.revision) return;
      const owner = this.owner;
      this.busy = true; this.error = '';
      try { await repository.unpublish(this.draft.id); if (this.owner !== owner) return; this.enabled = false; this.notice = 'Đã ẩn chương khỏi danh sách người chơi.'; this.cache(); await this.fetchDrafts(); }
      catch (e) { if (this.owner === owner) this.error = e instanceof Error ? e.message : 'Không ẩn được chương.'; }
      finally { if (this.owner === owner) this.busy = false; }
    },
  },
});
