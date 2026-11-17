import { onUnmounted, watch } from 'vue';
import type { StoryPlaybackStore } from '../stores/storyPlayback';

export function useStoryPreload(player: StoryPlaybackStore) {
  const images = new Map<string, HTMLImageElement>();
  watch(() => player.sequence, () => {
    if (!player.script || !player.node) return;
    const nextIds = new Set([player.nodeId, player.node.nextNodeId, ...player.node.choices.map(choice => choice.nextNodeId)]);
    const urls = new Set<string>();
    for (const node of player.script.nodes.filter(n => nextIds.has(n.id))) {
      urls.add(node.background.url);
      for (const actor of node.characters) {
        const character = player.script.characters.find(c => c.id === actor.characterId);
        urls.add(character?.expressions[actor.expression] || character?.expressions.normal || '');
      }
    }
    for (const url of urls) {
      if (!url || url.startsWith('builtin:') || images.has(url)) continue;
      const image = new Image(); image.decoding = 'async'; image.src = url; images.set(url, image);
    }
    while (images.size > 40) images.delete(images.keys().next().value!);
  }, { immediate: true });
  onUnmounted(() => { images.clear(); });
}
