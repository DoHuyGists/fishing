<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { SceneNode, StoryScript } from '../../types/model/story';
import { localStoryText } from '../../utils/story';
import { i18n, t } from '../../i18n';
const props = defineProps<{ script: StoryScript; node: SceneNode; sequence?: number; mini?: boolean; inactive?: boolean }>();
const failed = ref(new Set<string>());
const motion = ref<HTMLElement>();
const backgroundFailed = ref(false);
watch(() => props.node.background.url, () => { backgroundFailed.value = false; });
const locale = computed(() => i18n.global.locale.value);
const background = computed(() => !backgroundFailed.value && props.node.background.url && !props.node.background.url.startsWith('builtin:') ? props.node.background.url : '');
const scene = computed(() => props.node.background.url.startsWith('builtin:') ? props.node.background.url.slice(8) : 'dawn');
function image(characterId: string, expression: string) {
  const asset = props.script.characters.find(c => c.id === characterId);
  const expressions = asset?.expressions as Record<string, string> | undefined;
  const url = expressions?.[expression];
  if (url && !failed.value.has(url)) return url;
  const normal = expressions?.normal;
  return normal && !failed.value.has(normal) ? normal : '';
}
function fail(url: string) { failed.value = new Set([...failed.value, url]); }
function hasExpression(characterId: string, expression: string) {
  const url = (props.script.characters.find(c => c.id === characterId)?.expressions as Record<string, string> | undefined)?.[expression];
  return Boolean(url && !failed.value.has(url));
}
watch(() => [props.node.id, props.sequence, props.node.vfx], async (_, __, onCleanup) => {
  let cancelled = false; onCleanup(() => { cancelled = true; });
  await nextTick();
  if (cancelled || !motion.value) return;
  motion.value.style.animation = 'none';
  void motion.value.offsetWidth;
  motion.value.style.animation = '';
}, { immediate: true });
</script>

<template>
  <div class="story-stage" :class="[{ 'story-stage--mini': mini, 'story-stage--inactive': inactive }, `story-scene-${scene}`]">
    <div ref="motion" class="story-stage-motion" :class="`story-vfx-${node.vfx}`">
      <Transition :name="node.background.transition === 'none' ? '' : 'story-background'">
        <div :key="node.background.url" class="story-background" :class="[{ 'story-background--flash': node.background.transition === 'flash' }, `story-background-${scene}`]">
          <img v-if="background" :src="background" alt="" class="story-background-image" @error="backgroundFailed = true" />
          <template v-else><div class="story-moon" /><div class="story-mountains" /><div class="story-lake" /><div class="story-beacon" /><div class="story-grain" /></template>
        </div>
      </Transition>
      <div class="story-stage-shade" />
      <div class="story-cast">
        <div v-for="actor in node.characters" :key="actor.characterId" class="story-actor" :class="[`story-slot-${actor.position}`, { 'story-actor--speaking': actor.isSpeaking }]">
          <div :key="`${sequence}:${node.id}:${actor.animation}`" class="story-actor-motion" :class="[`story-actor-${actor.animation}`, `story-expression-${actor.expression}`]">
            <img v-if="image(actor.characterId, actor.expression)" :src="image(actor.characterId, actor.expression)" :alt="localStoryText(script.characters.find(c => c.id === actor.characterId)?.name, locale)" draggable="false" @error="fail(image(actor.characterId, actor.expression))" />
            <div v-else class="story-silhouette"><span>◈</span><div>{{ localStoryText(script.characters.find(c => c.id === actor.characterId)?.name, locale) }}</div></div>
            <span v-if="actor.expression !== 'normal' && !hasExpression(actor.characterId, actor.expression)" class="story-expression-badge">{{ t(`Story.expression_${actor.expression}`) }}</span>
          </div>
        </div>
      </div>
      <div :key="`${node.id}:${sequence}:${node.vfx}`" class="story-effect-overlay" :class="`story-overlay-${node.vfx}`" />
    </div>
    <slot />
  </div>
</template>
