<script setup lang="ts">
import StoryDialog from './StoryDialog.vue';
import StoryLibrary from './StoryLibrary.vue';
import { useModalStore } from '../../stores/modal';
import { t } from '../../i18n';
import '../../styles/story.css';
const modals = useModalStore();
</script>
<template><StoryDialog :title="t('Story.library')" wide @close="modals.close()"><StoryLibrary @select="modals.close()" /></StoryDialog></template>
