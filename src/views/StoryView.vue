<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import { useStoryStore } from "../stores/player-story-store.ts";
import { useStoryPlaybackStore, useStoryPreviewPlaybackStore } from "../stores/player-story-playback-store.ts";
import { useAuthStore } from "../stores/auth";
import { useFeatureAvailabilityStore } from "../stores/player-feature-availability-store.ts";
import StoryPlayer from "../components/story/StoryPlayer.vue";
import StoryLibrary from "../components/story/StoryLibrary.vue";
import StoryDialog from "../components/story/StoryDialog.vue";
import { t } from "../i18n";
import { STORY_DEMO_ID } from "../data/storyDemo";
import "../styles/story.css";
const route = useRoute(),
  router = useRouter(),
  stories = useStoryStore(),
  auth = useAuthStore(),
  features = useFeatureAvailabilityStore();
const playback = useStoryPlaybackStore(),
  previewPlayback = useStoryPreviewPlaybackStore();
const preview = computed(() => route.query.preview === "1");
const player = computed(() => (preview.value ? previewPlayback : playback));
const id = computed(() => (typeof route.query.id === "string" ? route.query.id : ""));
const localDemo = computed(() => route.query.demo === "1" && id.value === STORY_DEMO_ID);
const choosingResume = ref(false),
  unavailablePreview = ref(false),
  loaded = ref(false);
let request = 0;
function start(resume: boolean) {
  if (!stories.script) return;
  const progress = resume ? stories.progress : null;
  playback.load(stories.script, progress?.node_id, progress?.history.slice(0, -1));
  choosingResume.value = false;
  loaded.value = true;
}
async function load() {
  const sequence = ++request;
  loaded.value = false;
  choosingResume.value = false;
  unavailablePreview.value = false;
  playback.$reset();
  previewPlayback.$reset();
  if (!auth.user) return;
  if (preview.value) {
    if (!auth.isAdmin || !stories.preview) {
      unavailablePreview.value = true;
      return;
    }
    previewPlayback.load(stories.preview.script, stories.preview.nodeId);
    loaded.value = true;
    return;
  }
  if (!id.value || (!features.isAvailable("story") && !localDemo.value)) return;
  await stories.open(id.value, route.query.demo === "1");
  if (sequence !== request || !stories.script) return;
  if (
    stories.progress &&
    !stories.progress.completed &&
    stories.script.nodes.some((n) => n.id === stories.progress!.node_id)
  )
    choosingResume.value = true;
  else start(false);
}
function exit() {
  if (preview.value) void router.push({ name: "admin", query: { module: "story" } });
  else void router.push({ name: "story" });
}
watch(
  () =>
    [
      route.query.id,
      route.query.demo,
      route.query.preview,
      auth.user?.id,
      auth.isAdmin,
      features.isAvailable("story"),
    ] as const,
  load,
  { immediate: true },
);
watch(
  () => features.isAvailable("story"),
  (available) => {
    if (!available) {
      playback.paused = true;
      previewPlayback.paused = true;
    }
  },
);
// Unmount owns all timers/audio. Persisted checkpoints are serialized by the library store.
onBeforeRouteLeave(() => {
  request++;
});
function retryProgress() {
  void stories.retryProgress();
}
onMounted(() => window.addEventListener("online", retryProgress));
onUnmounted(() => {
  request++;
  window.removeEventListener("online", retryProgress);
});
</script>
<template>
  <main class="story-view">
    <template v-if="id && !features.isAvailable('story') && !preview && !localDemo"
      ><div class="story-empty-screen">
        <div>{{ features.reason("story") }}</div>
        <RouterLink class="story-button" :to="{ name: 'story' }">{{ t("Story.library") }}</RouterLink>
      </div></template
    >
    <div v-else-if="unavailablePreview" class="story-empty-screen">
      <div>{{ t("Story.previewMissing") }}</div>
      <RouterLink class="story-button" :to="{ name: 'admin', query: { module: 'story' } }">{{
        t("Story.editor")
      }}</RouterLink>
    </div>
    <template v-else-if="!id && !preview"
      ><header class="story-library-header">
        <RouterLink class="story-button" :to="{ name: 'home' }">← {{ t("Story.backHome") }}</RouterLink>
        <div>{{ t("Story.library") }}</div>
      </header>
      <div class="story-library-page"><StoryLibrary /></div
    ></template>
    <div v-else-if="stories.loading && !preview" class="story-empty-screen" role="status">{{ t("Story.loading") }}</div>
    <div v-else-if="stories.error && !preview" class="story-empty-screen">
      <div role="alert">{{ stories.error }}</div>
      <button class="story-button" @click="load">{{ t("Story.retry") }}</button
      ><button class="story-button" @click="exit">{{ t("Story.library") }}</button>
    </div>
    <StoryPlayer
      v-else-if="loaded && player.script"
      :key="`${preview}:${player.script.id}:${stories.version}`"
      :player="player"
      :version="stories.version"
      :preview="preview"
      @exit="exit"
      @checkpoint="stories.persist($event, auth.user?.id ?? '')"
    />
    <div v-if="stories.progressError && !preview && loaded" class="story-progress-error" role="status">
      {{ stories.progressError }} <button type="button" @click="retryProgress">{{ t("Story.retry") }}</button>
    </div>
    <StoryDialog v-if="choosingResume" :title="t('Story.resumeTitle')" @close="exit"
      ><div class="story-summary">{{ t("Story.resumeHint") }}</div>
      <div class="story-actions">
        <button class="story-button" @click="start(false)">{{ t("Story.restart") }}</button
        ><button class="story-button story-button--primary" @click="start(true)">{{ t("Story.resume") }}</button>
      </div></StoryDialog
    >
  </main>
</template>
