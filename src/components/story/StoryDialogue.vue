<script setup lang="ts">
import { computed } from 'vue';
import { storyTokens } from '../../utils/storyRichText';
import { localStoryText } from '../../utils/story';
import type { SceneNode } from '../../types/model/story';
import { i18n, t } from '../../i18n';
const props = defineProps<{ node: SceneNode; revealed?: number; mini?: boolean }>();
const emit = defineEmits<{ advance: []; choose: [id: string] }>();
const locale = computed(() => i18n.global.locale.value);
const tokens = computed(() => storyTokens(localStoryText(props.node.dialogue, locale.value)));
const complete = computed(() => props.revealed === undefined || props.revealed >= tokens.value.length);
</script>

<template>
  <div class="story-dialogue-wrap" :class="{ 'story-dialogue-wrap--mini': mini }">
    <div v-if="node.choices.length && complete && !mini" class="story-choices" :aria-label="t('Story.choose')">
      <button v-for="choice in node.choices" :key="choice.id" type="button" class="story-choice" @click.stop="emit('choose', choice.id)"><span>◇</span>{{ localStoryText(choice.text, locale) }}</button>
    </div>
    <button type="button" class="story-dialogue" :disabled="mini" :aria-label="t(complete ? 'Story.next' : 'Story.reveal')" @click.stop="emit('advance')">
      <span class="story-speaker">{{ node.speaker ? localStoryText(node.speaker.name, locale) : t('Story.narrator') }}<span v-if="node.speaker?.title" class="story-speaker-title">{{ localStoryText(node.speaker.title, locale) }}</span></span>
      <span class="story-dialogue-text" :aria-label="tokens.map(token => token.text).join('')"><span v-for="(token, index) in tokens" :key="index" :style="{ visibility: index < (revealed ?? tokens.length) ? 'visible' : 'hidden', color: token.color || undefined, fontWeight: token.bold ? '700' : undefined, fontStyle: token.italic ? 'italic' : undefined }" aria-hidden="true">{{ token.text }}</span></span>
      <span v-if="complete && !node.choices.length && !mini" class="story-next-marker" aria-hidden="true">◇</span>
    </button>
  </div>
</template>
