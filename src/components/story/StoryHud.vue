<script setup lang="ts">
import type { StoryPlaybackStore } from "../../stores/player-story-playback-store";
import { t } from "../../i18n";
defineProps<{ player: StoryPlaybackStore; preview?: boolean }>();
const emit = defineEmits<{ exit: [] }>();
</script>
<template>
  <nav class="story-hud" :aria-label="t('Story.controls')" @click.stop>
    <button class="story-hud-button" type="button" @click="emit('exit')">
      ← {{ t(preview ? "Story.editor" : "Story.library") }}
    </button>
    <div class="story-hud-tools">
      <button class="story-hud-button" type="button" :aria-pressed="player.auto" @click="player.auto = !player.auto">
        {{ t("Story.auto")
        }}<span v-if="player.auto" class="story-auto-track"
          ><span :style="{ width: `${player.autoProgress * 100}%` }"
        /></span>
      </button>
      <button class="story-hud-button" type="button" @click="player.overlay = 'skip'">{{ t("Story.skip") }} »</button>
      <button class="story-hud-button" type="button" @click="player.overlay = 'log'">{{ t("Story.log") }}</button>
      <button class="story-hud-button" type="button" :aria-pressed="player.muted" @click="player.muted = !player.muted">
        {{ t(player.muted ? "Story.unmute" : "Story.mute") }}
      </button>
      <button class="story-hud-button" type="button" @click="player.hidden = true">{{ t("Story.hide") }}</button>
      <label class="story-speed"
        >{{ t("Story.speed")
        }}<select v-model.number="player.speed">
          <option :value="50">1×</option>
          <option :value="30">2×</option>
          <option :value="15">3×</option>
        </select></label
      >
    </div>
  </nav>
</template>
