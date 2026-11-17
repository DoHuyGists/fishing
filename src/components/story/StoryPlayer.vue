<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';
import type { StoryPlaybackStore } from '../../stores/storyPlayback';
import type { StoryProgress } from '../../types/model/story';
import StoryStage from './StoryStage.vue';
import StoryDialogue from './StoryDialogue.vue';
import StoryHud from './StoryHud.vue';
import StoryDialog from './StoryDialog.vue';
import { storyTokens } from '../../utils/storyRichText';
import { localStoryText } from '../../utils/story';
import { useStoryAudio } from '../../composables/useStoryAudio';
import { useStoryPreload } from '../../composables/useStoryPreload';
import { i18n, t } from '../../i18n';
const props = defineProps<{ player: StoryPlaybackStore; version?: number; preview?: boolean }>();
const emit = defineEmits<{ exit: []; checkpoint: [progress: StoryProgress] }>();
const locale = computed(() => i18n.global.locale.value);
const text = computed(() => storyTokens(localStoryText(props.player.node?.dialogue, locale.value)));
watch(() => [props.player.sequence, text.value] as const, () => { props.player.textLength = text.value.length; props.player.revealed = 0; props.player.autoProgress = 0; }, { immediate: true, flush: 'sync' });
useStoryAudio(props.player);
useStoryPreload(props.player);
let timer: ReturnType<typeof setTimeout> | undefined, disposed = false;
let elapsed = 0, previous = 0, lastSequence = -1;
function checkpoint() {
  if (props.preview || !props.player.script || !props.player.started) return;
  emit('checkpoint', { story_id: props.player.script.id, version: props.version ?? 0, node_id: props.player.nodeId, history: [...props.player.history], completed: props.player.completed, skipped: props.player.skipped });
}
watch(() => [props.player.sequence, props.player.completed, props.player.started] as const, checkpoint, { flush: 'post' });
function tick() {
  if (disposed) return;
  const now = performance.now(), delta = Math.min(now - previous, 100); previous = now;
  if (lastSequence !== props.player.sequence) { elapsed = 0; lastSequence = props.player.sequence; }
  if (!props.player.blocked) {
    if (props.player.typing) {
      elapsed += delta;
      const count = Math.floor(elapsed / props.player.speed);
      if (count) { props.player.revealed = Math.min(props.player.textLength, props.player.revealed + count); elapsed %= props.player.speed; }
    } else if (props.player.auto && !props.player.node?.choices.length && !props.player.voicePlaying) {
      props.player.autoProgress += delta / Math.max(1800, props.player.textLength * 35);
      if (props.player.autoProgress >= 1) { props.player.autoProgress = 0; props.player.advance(); }
    } else props.player.autoProgress = 0;
  }
  timer = setTimeout(tick, 25);
}
function keydown(event: KeyboardEvent) {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || props.player.overlay) return;
  const target = event.target as HTMLElement;
  if (target.closest('input,textarea,select,[contenteditable=true]')) return;
  if (event.key.toLowerCase() === 'h' && props.player.started && !props.player.completed) { event.preventDefault(); props.player.hidden = !props.player.hidden; return; }
  if (event.key !== ' ' && event.key !== 'Enter') return;
  // Let focused controls and choices keep native keyboard activation.
  if (target.closest('button,a')) return;
  event.preventDefault();
  if (!props.player.started) props.player.started = true;
  else if (props.player.hidden) props.player.hidden = false;
  else props.player.advance();
}
function visibility() { props.player.paused = document.hidden; }
function clickStage() {
  if (props.player.hidden) props.player.hidden = false;
  else props.player.advance();
}
onMounted(() => { previous = performance.now(); visibility(); tick(); window.addEventListener('keydown', keydown); document.addEventListener('visibilitychange', visibility); });
onUnmounted(() => { checkpoint(); disposed = true; clearTimeout(timer); window.removeEventListener('keydown', keydown); document.removeEventListener('visibilitychange', visibility); });
</script>

<template>
  <div v-if="player.script && player.node" class="story-player" tabindex="0" :aria-label="localStoryText(player.script.title, locale)" @click="clickStage">
    <StoryStage :script="player.script" :node="player.node" :sequence="player.sequence" :inactive="!player.started || player.completed">
      <template v-if="player.started && !player.hidden && !player.completed">
        <StoryHud :player="player" :preview="preview" @exit="emit('exit')" />
        <div class="story-chapter-label">{{ localStoryText(player.script.title, locale) }} <span v-if="preview">/ {{ t('Story.preview') }}</span></div>
        <StoryDialogue :node="player.node" :revealed="player.revealed" @advance="player.advance()" @choose="player.advance($event)" />
      </template>
      <button v-if="player.hidden && !player.completed" type="button" class="story-restore" @click.stop="player.hidden = false">{{ t('Story.show') }} · H</button>
      <div v-if="!player.started || player.completed" class="story-title-screen" @click.stop>
        <div class="story-eyebrow">{{ t(player.completed ? 'Story.chapterComplete' : 'Story.visualNovel') }}</div>
        <div class="story-title">{{ localStoryText(player.script.title, locale) }}</div>
        <div class="story-title-summary">{{ localStoryText(player.script.summary, locale) }}</div>
        <template v-if="player.completed"><div v-if="player.skipped" class="story-muted">{{ t('Story.skipped') }}</div><button class="story-button story-button--primary" @click="emit('exit')">{{ t(preview ? 'Story.editor' : 'Story.library') }} →</button></template>
        <template v-else><button class="story-button story-button--primary" @click="player.started = true">{{ t('Story.begin') }} →</button><button class="story-button" @click="emit('exit')">{{ t('Story.back') }}</button><div class="story-muted">{{ t('Story.shortcuts') }}</div></template>
      </div>
    </StoryStage>
    <StoryDialog v-if="player.overlay === 'log'" :title="t('Story.log')" @close="player.overlay = ''">
      <div v-for="(id, index) in player.history" :key="`${index}:${id}`" class="story-log-entry"><div class="story-log-speaker">{{ localStoryText(player.script.nodes.find(n => n.id === id)?.speaker?.name, locale) || t('Story.narrator') }}</div><div>{{ storyTokens(localStoryText(player.script.nodes.find(n => n.id === id)?.dialogue, locale)).map(token => token.text).join('') }}</div></div>
    </StoryDialog>
    <StoryDialog v-if="player.overlay === 'skip'" :title="t('Story.skipConfirm')" @close="player.overlay = ''"><div class="story-summary">{{ localStoryText(player.script.summary, locale) }}</div><div class="story-muted">{{ t('Story.skipHint') }}</div><div class="story-actions"><button class="story-button" @click="player.overlay = ''">{{ t('Story.cancel') }}</button><button class="story-button story-button--primary" @click="player.skip()">{{ t('Story.skip') }}</button></div></StoryDialog>
  </div>
</template>
