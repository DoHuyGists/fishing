<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useStoryEditorStore } from '../../../stores/storyEditor';
import { useStoryStore } from '../../../stores/story';
import { useAuthStore } from '../../../stores/auth';
import { copyStory, localStoryText, parseStory } from '../../../utils/story';
import StoryNodeList from './StoryNodeList.vue';
import StoryNodeInspector from './StoryNodeInspector.vue';
import StoryLibraryInspector from './StoryLibraryInspector.vue';
import StoryStage from '../../story/StoryStage.vue';
import StoryDialogue from '../../story/StoryDialogue.vue';
import StoryDialog from '../../story/StoryDialog.vue';
import '../../../styles/story.css';
import { useStoryDialogFocus } from '../../../composables/useStoryDialogFocus';

const emit = defineEmits<{ close: [] }>();
const editor = useStoryEditorStore(), stories = useStoryStore(), auth = useAuthStore(), router = useRouter();
editor.initialize(auth.user?.id ?? '');
const confirmAction = ref<null | (() => void)>(null), confirmMessage = ref('');
const previewCount = ref(0);
const panel = ref<HTMLElement>();
useStoryDialogFocus(panel, () => { if (!editor.busy) emit('close'); });
const valid = computed(() => !editor.validation.errors.length);
let cacheTimer: ReturnType<typeof setTimeout> | undefined;
watch(() => [editor.draft, editor.selectedId, editor.sortOrder], () => { clearTimeout(cacheTimer); cacheTimer = setTimeout(() => editor.cache(), 400); }, { deep: true });
function confirm(message: string, action: () => void) { confirmMessage.value = message; confirmAction.value = action; }
function executeConfirmation() {
  const action = confirmAction.value;
  confirmAction.value = null;
  action?.();
}
function replace(action: () => void) { if (editor.dirty) confirm('Bản đang sửa sẽ được thay thế. Hãy xuất JSON hoặc lưu trước nếu cần giữ lại.', action); else action(); }
function selectDraft(event: Event) {
  const row = editor.rows.find(r => r.id === (event.target as HTMLSelectElement).value);
  if (row) replace(() => { void editor.select(row.id); });
}
async function reloadDraft() {
  await editor.fetchDrafts();
  const row = editor.rows.find(r => r.id === editor.draft?.id);
  if (row) replace(() => { void editor.select(row.id); });
}
async function importFile(event: Event) {
  const input = event.target as HTMLInputElement, file = input.files?.[0]; input.value = '';
  if (!file) return;
  if (file.size > 2_000_000) { editor.error = 'JSON tối đa 2 MB.'; return; }
  try { const text = await file.text(); replace(() => { try { editor.importJson(text); } catch (e) { editor.error = String(e); } }); }
  catch (e) { editor.error = String(e); }
}
function exportJson() {
  if (!editor.draft) return;
  const blob = new Blob([JSON.stringify(copyStory(editor.draft), null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = `story-${editor.draft.id}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function play() {
  if (!editor.draft || !editor.node) return;
  try { stories.preview = { script: parseStory(copyStory(editor.draft)), nodeId: editor.node.id }; editor.cache(); void router.push({ name: 'story', query: { preview: '1' } }); }
  catch (e) { editor.error = String(e); }
}
function beforeUnload(event: BeforeUnloadEvent) { editor.cache(); if (editor.dirty) { event.preventDefault(); event.returnValue = ''; } }
function keydown(event: KeyboardEvent) { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); if (!confirmAction.value) void editor.save(); } }
onMounted(() => { void editor.fetchDrafts(); window.addEventListener('beforeunload', beforeUnload); window.addEventListener('keydown', keydown); });
onUnmounted(() => { clearTimeout(cacheTimer); editor.cache(); window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('keydown', keydown); });
</script>

<template>
  <Teleport to="body">
    <div ref="panel" class="story-editor" role="dialog" aria-modal="true" aria-label="Scenario Builder" tabindex="-1">
      <header class="story-editor-toolbar"><div class="story-editor-brand"><span>◈</span><div>SCENARIO BUILDER<div class="story-muted">{{ editor.dirty ? 'Có thay đổi · tự lưu cục bộ' : 'Đã lưu trên Supabase' }}</div></div></div><div class="story-toolbar-actions"><button class="story-button" :disabled="editor.busy" @click="replace(() => editor.newScript())">Tạo mới</button><button class="story-button" :disabled="editor.busy" @click="replace(() => editor.newScript(true))">Truyện mẫu</button><label class="story-button">Import JSON<input hidden type="file" accept=".json,application/json" :disabled="editor.busy" @change="importFile" /></label><button class="story-button" @click="exportJson">Export JSON</button><button class="story-button" :disabled="!valid || editor.busy" @click="play">▶ Play Test</button><button class="story-button" :disabled="!valid || editor.busy" @click="editor.save()">Lưu nháp</button><button class="story-button story-button--primary" :disabled="!valid || editor.busy" @click="confirm('Xuất bản bản nháp hiện tại thành một phiên bản mới cho người chơi?', () => { void editor.save(true); })">{{ editor.busy ? 'Đang lưu…' : 'Xuất bản' }}</button><button class="story-button" :disabled="editor.busy" @click="editor.cache(); emit('close')">✕ Đóng</button></div></header>
      <div v-if="editor.error" class="story-banner story-error" role="alert">{{ editor.error }}<button class="story-button" @click="editor.error = ''">✕</button></div><div v-if="editor.notice" class="story-banner story-success" role="status">{{ editor.notice }}<button class="story-button" @click="editor.notice = ''">✕</button></div>
      <div class="story-editor-library"><label>Chương trên Supabase <select :value="editor.draft?.id" :disabled="editor.busy" @change="selectDraft"><option :value="editor.draft?.id">{{ editor.revision ? localStoryText(editor.draft?.title, 'vi') : 'Bản nháp cục bộ' }}</option><option v-for="row in editor.rows.filter(r => r.id !== editor.draft?.id)" :key="row.id" :value="row.id">{{ localStoryText(row.title, 'vi') }} · r{{ row.revision }} {{ row.enabled ? '●' : '○' }}</option></select></label><button class="story-button" :disabled="editor.busy" @click="editor.fetchDrafts()">Làm mới danh sách</button><button v-if="editor.revision" class="story-button" :disabled="editor.busy" @click="reloadDraft">Nạp lại bản máy chủ</button><span class="story-muted">{{ editor.restored ? 'Đã khôi phục bản nháp trên thiết bị.' : 'Ctrl/Cmd + S để lưu nháp.' }}</span></div>
      <div v-if="editor.draft" class="story-editor-columns">
        <StoryNodeList @remove="confirm('Xóa node này? Liên kết thường sẽ nối qua node kế tiếp; lựa chọn trỏ tới node này sẽ bị gỡ.', () => editor.removeNode())" />
        <main class="story-editor-preview"><div class="story-panel-heading">LIVE PREVIEW <button class="story-button" @click="previewCount++">↻ Hiệu ứng</button></div><div class="story-preview-frame"><StoryStage v-if="editor.node" :key="previewCount" :script="editor.draft" :node="editor.node" :sequence="previewCount" mini><StoryDialogue :node="editor.node" mini /></StoryStage></div><div class="story-preview-caption">16:9 · Bố cục dùng cùng bộ render với Story Player</div><div class="story-preview-notes"><div>01 / Chọn hoặc thêm node ở Timeline.</div><div>02 / Chỉnh thoại, nhân vật và đường nối ở Inspector.</div><div>03 / Play Test từ node đang chọn, sau đó xuất bản.</div></div><div v-if="editor.validation.errors.length" class="story-warning">Có {{ editor.validation.errors.length }} lỗi cần sửa trước khi Play Test hoặc xuất bản.<button class="story-button" @click="editor.panel = 'script'">Xem lỗi</button></div></main>
        <aside class="story-inspector"><div class="story-inspector-tabs"><button v-for="tab in (['node', 'script', 'assets'] as const)" :key="tab" :aria-pressed="editor.panel === tab" @click="editor.panel = tab">{{ tab === 'node' ? 'Inspector' : tab === 'script' ? 'Chương' : 'Assets' }}</button></div><fieldset :disabled="editor.busy" class="story-inspector-body"><StoryNodeInspector v-if="editor.panel === 'node'" /><StoryLibraryInspector v-else /></fieldset></aside>
      </div>
      <StoryDialog v-if="confirmAction" title="Xác nhận thao tác" @close="confirmAction = null"><div class="story-summary">{{ confirmMessage }}</div><div class="story-actions"><button class="story-button" @click="confirmAction = null">Hủy</button><button class="story-button story-button--primary" @click="executeConfirmation">Tiếp tục</button></div></StoryDialog>
    </div>
  </Teleport>
</template>
