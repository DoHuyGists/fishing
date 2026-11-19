<script setup lang="ts">
import { computed, onMounted } from "vue";
import { RouterLink } from "vue-router";
import { useStoryStore } from "../../stores/player-story-store";
import { storyDemo, STORY_DEMO_ID } from "../../data/storyDemo";
import { localStoryText } from "../../utils/story";
import { i18n, t } from "../../i18n";
const stories = useStoryStore();
const emit = defineEmits<{ select: [] }>();
const locale = computed(() => i18n.global.locale.value);
onMounted(() => {
  void stories.loadCatalog();
});
</script>
<template>
  <div class="story-library">
    <div class="story-eyebrow">{{ t("Story.visualNovel") }}</div>
    <div class="story-library-intro">{{ t("Story.libraryIntro") }}</div>
    <div v-if="stories.loading" class="story-muted" role="status">{{ t("Story.loading") }}</div>
    <div v-if="stories.error" class="story-error" role="alert">
      {{ t("Story.catalogError") }}
      <div class="story-muted">{{ stories.error }}</div>
      <button class="story-button" @click="stories.loadCatalog()">{{ t("Story.retry") }}</button>
    </div>
    <div v-if="!stories.loading && !stories.error && !stories.items.length" class="story-muted">
      {{ t("Story.empty") }}
    </div>
    <RouterLink
      v-for="(item, index) in stories.items"
      :key="item.id"
      :to="{ name: 'story', query: { id: item.id } }"
      class="story-chapter-card"
      @click="emit('select')"
      ><span class="story-chapter-number">{{ String(index + 1).padStart(2, "0") }}</span>
      <div>
        <div class="story-chapter-title">{{ localStoryText(item.title, locale) }}</div>
        <div class="story-muted">{{ t("Story.publishedVersion", { version: item.version }) }}</div>
      </div>
      <span>→</span></RouterLink
    >
    <div class="story-library-divider">{{ t("Story.demo") }}</div>
    <RouterLink
      :to="{ name: 'story', query: { id: STORY_DEMO_ID, demo: '1' } }"
      class="story-chapter-card story-chapter-card--demo"
      @click="emit('select')"
      ><span class="story-chapter-number">◈</span>
      <div>
        <div class="story-chapter-title">{{ localStoryText(storyDemo.title, locale) }}</div>
        <div class="story-muted">{{ t("Story.demoHint") }}</div>
      </div>
      <span>▶</span></RouterLink
    >
  </div>
</template>
