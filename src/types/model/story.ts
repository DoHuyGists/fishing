export type StoryLocale = 'vi' | 'en';
export type StoryText = Record<StoryLocale, string>;
export type StoryExpression = 'normal' | 'happy' | 'angry' | 'shocked' | 'sad';
export type StoryAnimation = 'none' | 'bounce' | 'shake' | 'slide-in' | 'fade-out';
export type VFXAction = 'none' | 'screen-shake' | 'flash-white' | 'flash-red' | 'vignette-pulse';
export interface StoryCharacter {
  id: string;
  name: StoryText;
  expressions: Partial<Record<StoryExpression, string>> & { normal: string };
}
export interface CharacterState {
  characterId: string;
  position: 'left' | 'center' | 'right';
  expression: StoryExpression;
  isSpeaking: boolean;
  animation: StoryAnimation;
}
export interface StoryChoice { id: string; text: StoryText; nextNodeId: string }
export interface SceneNode {
  id: string;
  speaker: { id: string; name: StoryText; title?: StoryText } | null;
  dialogue: StoryText;
  background: { url: string; transition: 'fade' | 'none' | 'flash' };
  characters: CharacterState[];
  vfx: VFXAction;
  /** Omitted BGM keeps the current track; empty BGM stops it. */
  audio: { bgm?: string; sfx?: string; voice?: string };
  choices: StoryChoice[];
  /** Explicit edges are independent of the editor's display order. Null ends the chapter. */
  nextNodeId: string | null;
}
export interface StoryScript {
  schemaVersion: 1;
  id: string;
  title: StoryText;
  summary: StoryText;
  startNodeId: string;
  characters: StoryCharacter[];
  nodes: SceneNode[];
}
export interface StoryCatalogItem {
  id: string;
  title: StoryText;
  summary: StoryText;
  version: number;
  sort_order: number;
}
export interface StoryProgress {
  story_id: string;
  version: number;
  node_id: string;
  history: string[];
  completed: boolean;
  skipped: boolean;
}
export interface StoryRichToken { text: string; bold: boolean; italic: boolean; color: string }
export interface StoryValidation { errors: string[]; warnings: string[] }
