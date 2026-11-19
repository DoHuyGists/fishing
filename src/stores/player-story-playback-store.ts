import { defineStore } from 'pinia';
import type { SceneNode, StoryScript } from '../types/model/story';
import { copyStory } from '../utils/story';

function playbackStore(id: string) {
  return defineStore(id, {
    state: () => ({ script: null as StoryScript | null, nodeId: '', history: [] as string[], sequence: 0, revealed: 0, textLength: 0, auto: false, autoProgress: 0, hidden: false, overlay: '' as '' | 'log' | 'skip', completed: false, skipped: false, muted: false, paused: false, started: false, voicePlaying: false, initialBgm: '', speed: 30 }),
    getters: {
      node: (s): SceneNode | null => s.script?.nodes.find(n => n.id === s.nodeId) ?? null,
      typing: s => s.revealed < s.textLength,
      blocked: s => Boolean(s.overlay || s.hidden || s.paused || !s.started || s.completed),
    },
    actions: {
      load(script: StoryScript, nodeId = script.startNodeId, history: string[] = []) {
        this.$reset(); this.script = copyStory(script);
        this.history = history.filter(id => script.nodes.some(n => n.id === id)).slice(-999);
        const previous = history.length ? history.map(id => script.nodes.find(n => n.id === id)).filter(Boolean) : script.nodes.slice(0, script.nodes.findIndex(n => n.id === nodeId));
        this.initialBgm = [...previous].reverse().find(n => n?.audio.bgm !== undefined)?.audio.bgm ?? '';
        this.go(script.nodes.some(n => n.id === nodeId) ? nodeId : script.startNodeId);
      },
      go(id: string) {
        if (!this.script?.nodes.some(n => n.id === id)) return;
        this.revealed = 0; this.textLength = 0; this.autoProgress = 0;
        this.nodeId = id; this.sequence++;
        this.history.push(id); this.history = this.history.slice(-1000);
      },
      advance(choiceId?: string) {
        if (this.blocked || !this.node) return;
        if (this.typing) { this.revealed = this.textLength; return; }
        if (this.node.choices.length) {
          const choice = this.node.choices.find(c => c.id === choiceId);
          if (choice) this.go(choice.nextNodeId);
          return;
        }
        if (this.node.nextNodeId) this.go(this.node.nextNodeId);
        else { this.completed = true; this.auto = false; }
      },
      skip() { this.skipped = true; this.completed = true; this.auto = false; this.overlay = ''; },
    },
  });
}
export const useStoryPlaybackStore = playbackStore('storyPlayback');
export const useStoryPreviewPlaybackStore = playbackStore('storyPreviewPlayback');
export type StoryPlaybackStore = ReturnType<typeof useStoryPlaybackStore>;
