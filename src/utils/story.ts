import type { SceneNode, StoryLocale, StoryScript, StoryText, StoryValidation } from '../types/model/story';
import { createUuid } from './uuid';

export const storyText = (vi = '', en = vi): StoryText => ({ vi, en });
export const localStoryText = (text: StoryText | undefined, locale: string): string => text?.[locale as StoryLocale] || text?.vi || text?.en || '';
export const storyExpressions = ['normal', 'happy', 'angry', 'shocked', 'sad'] as const;
export const storyAnimations = ['none', 'bounce', 'shake', 'slide-in', 'fade-out'] as const;
export const storyEffects = ['none', 'screen-shake', 'flash-white', 'flash-red', 'vignette-pulse'] as const;
export function isStoryUrl(url: unknown): url is string {
  return typeof url === 'string' && (url === '' || /^\/(?!\/)[^\s\\]*$/.test(url) || /^https:\/\/[^\s\\]+$/i.test(url) || /^builtin:(dawn|night|storm|signal|impact)$/.test(url));
}
export function createStoryNode(): SceneNode {
  return { id: createUuid(), speaker: null, dialogue: storyText(), background: { url: 'builtin:dawn', transition: 'fade' }, characters: [], vfx: 'none', audio: {}, choices: [], nextNodeId: null };
}
const object = (v: unknown): v is Record<string, any> => v !== null && typeof v === 'object' && !Array.isArray(v);
const localized = (v: unknown) => object(v) && ['vi', 'en'].every(key => typeof v[key] === 'string' && v[key].length <= 20000);
const uuid = (v: unknown) => typeof v === 'string' && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(v);

/** Runtime boundary for imported JSON and database content. No coercion or executable markup. */
export function validateStory(input: unknown): StoryValidation {
  const errors: string[] = [], warnings: string[] = [];
  if (!object(input)) return { errors: ['Script must be an object.'], warnings };
  if (input.schemaVersion !== 1 || !uuid(input.id)) errors.push('Unsupported schemaVersion or invalid script UUID.');
  if (!localized(input.title) || !localized(input.summary) || !input.title?.vi?.trim() || !input.title?.en?.trim()) errors.push('Title requires vi/en; summary requires vi/en strings.');
  if (!Array.isArray(input.nodes) || !input.nodes.length || input.nodes.length > 1000) return { errors: [...errors, 'Script needs 1–1000 nodes.'], warnings };
  if (!Array.isArray(input.characters) || input.characters.length > 100) return { errors: [...errors, 'Character library must contain at most 100 entries.'], warnings };
  const characterIds = new Set<string>();
  input.characters.forEach((c: any, index: number) => {
    if (!object(c) || typeof c.id !== 'string' || !c.id || characterIds.has(c.id) || !localized(c.name) || !object(c.expressions) || typeof c.expressions.normal !== 'string' || !Object.entries(c.expressions).every(([key, url]) => storyExpressions.includes(key as any) && isStoryUrl(url))) errors.push(`Character ${index + 1}: invalid/duplicate ID, name or expression URL.`);
    if (c?.id) characterIds.add(c.id);
  });
  const ids = new Set<string>();
  input.nodes.forEach((n: any, index: number) => {
    const label = `Node ${index + 1}`;
    if (!object(n)) { errors.push(`${label}: must be an object.`); return; }
    if (!uuid(n.id) || ids.has(n.id)) errors.push(`${label}: invalid/duplicate UUID.`);
    ids.add(n.id);
    if (!localized(n.dialogue)) errors.push(`${label}: dialogue requires vi/en strings.`);
    if (n.speaker !== null && (!object(n.speaker) || !characterIds.has(n.speaker.id) || !localized(n.speaker.name) || (n.speaker.title !== undefined && !localized(n.speaker.title)))) errors.push(`${label}: invalid speaker.`);
    if (!object(n.background) || !isStoryUrl(n.background.url) || !['none', 'fade', 'flash'].includes(n.background.transition)) errors.push(`${label}: invalid background.`);
    if (!storyEffects.includes(n.vfx)) errors.push(`${label}: invalid VFX.`);
    if (!object(n.audio) || !Object.entries(n.audio).every(([key, value]) => ['bgm', 'sfx', 'voice'].includes(key) && isStoryUrl(value))) errors.push(`${label}: invalid audio.`);
    if (!Array.isArray(n.characters) || n.characters.length > 3) errors.push(`${label}: maximum 3 characters.`);
    else {
      const positions = new Set(), actors = new Set();
      for (const c of n.characters) {
        if (!object(c) || !characterIds.has(c.characterId) || !['left', 'center', 'right'].includes(c.position) || positions.has(c.position) || actors.has(c.characterId) || !storyExpressions.includes(c.expression) || !storyAnimations.includes(c.animation) || typeof c.isSpeaking !== 'boolean') errors.push(`${label}: invalid/duplicate character or slot.`);
        positions.add(c?.position); actors.add(c?.characterId);
      }
    }
    if (!(n.nextNodeId === null || uuid(n.nextNodeId))) errors.push(`${label}: nextNodeId must be a UUID or null.`);
    if (!Array.isArray(n.choices) || n.choices.length > 8) errors.push(`${label}: maximum 8 choices.`);
    else {
      const choiceIds = new Set();
      for (const c of n.choices) {
        if (!object(c) || !uuid(c.id) || choiceIds.has(c.id) || !localized(c.text) || !c.text.vi.trim() || !c.text.en.trim() || !uuid(c.nextNodeId)) errors.push(`${label}: invalid choice.`);
        choiceIds.add(c?.id);
      }
    }
  });
  if (!ids.has(input.startNodeId)) errors.push('startNodeId does not exist.');
  for (const n of input.nodes) {
    if (!object(n)) continue;
    for (const edge of [n.nextNodeId, ...(Array.isArray(n.choices) ? n.choices.map((c: any) => c?.nextNodeId) : [])]) {
      if (edge !== null && !ids.has(edge)) errors.push(`Node ${n.id}: dangling target ${edge}.`);
    }
  }
  if (!errors.length) {
    const script = input as StoryScript;
    const visited = new Set<string>(), pending = [script.startNodeId];
    while (pending.length) {
      const id = pending.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const n = script.nodes.find(node => node.id === id)!;
      pending.push(...(n.choices.length ? n.choices.map(c => c.nextNodeId) : n.nextNodeId ? [n.nextNodeId] : []));
    }
    if (visited.size < ids.size) warnings.push(`${ids.size - visited.size} unreachable node(s).`);
    // Reverse reachability detects closed cycles, including cycles with no ending at all.
    const endings = new Set(script.nodes.filter(n => !n.choices.length && n.nextNodeId === null).map(n => n.id));
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of script.nodes) {
        const edges = n.choices.length ? n.choices.map(c => c.nextNodeId) : n.nextNodeId ? [n.nextNodeId] : [];
        if (!endings.has(n.id) && edges.some(id => endings.has(id))) { endings.add(n.id); changed = true; }
      }
    }
    if ([...visited].some(id => !endings.has(id))) errors.push('A reachable branch cannot reach an ending.');
  }
  return { errors, warnings };
}
export function parseStory(value: unknown): StoryScript {
  const result = validateStory(value);
  if (result.errors.length) throw new Error(result.errors.join('\n'));
  return copyStory(value) as StoryScript;
}
export function copyStory<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
