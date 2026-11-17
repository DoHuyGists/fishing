<script setup lang="ts">
import { useStoryEditorStore } from '../../../stores/storyEditor';
import { createUuid } from '../../../utils/uuid';
import { storyExpressions, storyText } from '../../../utils/story';
const editor = useStoryEditorStore();
function upload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0]; if (file) void editor.upload(file); input.value = '';
}
function removeCharacter(id: string) {
  if (!editor.draft) return;
  editor.draft.characters = editor.draft.characters.filter(c => c.id !== id);
  for (const node of editor.draft.nodes) { node.characters = node.characters.filter(c => c.characterId !== id); if (node.speaker?.id === id) node.speaker = null; }
}
async function copy(url: string) {
  try { await navigator.clipboard.writeText(url); editor.notice = 'Đã sao chép URL.'; }
  catch { editor.error = 'Không sao chép được. Chọn URL trong ô bên dưới để sao chép thủ công.'; }
}
</script>
<template>
  <div v-if="editor.draft" class="story-inspector-fields">
    <template v-if="editor.panel === 'script'">
      <div class="story-panel-heading">CHƯƠNG TRUYỆN</div><div class="story-muted story-id">{{ editor.draft.id }}</div>
      <label class="story-field">Tiêu đề · VI<input v-model="editor.draft.title.vi" maxlength="200" /></label><label class="story-field">Tiêu đề · EN<input v-model="editor.draft.title.en" maxlength="200" /></label>
      <label class="story-field">Tóm tắt khi bỏ qua · VI<textarea v-model="editor.draft.summary.vi" rows="4" /></label><label class="story-field">Tóm tắt khi bỏ qua · EN<textarea v-model="editor.draft.summary.en" rows="4" /></label>
      <label class="story-field">Thứ tự chương<input v-model.number="editor.sortOrder" type="number" step="1" /></label>
      <div class="story-muted">Revision {{ editor.revision }} · Published {{ editor.publishedVersion ?? '—' }} · {{ editor.enabled ? 'Đang công khai' : 'Đang ẩn / chưa xuất bản' }}</div>
      <button v-if="editor.enabled" class="story-button story-button--danger" @click="editor.unpublish()">Ẩn chương khỏi người chơi</button>
      <div class="story-panel-heading">KIỂM TRA KỊCH BẢN</div><div v-if="!editor.validation.errors.length" class="story-success">Cấu trúc hợp lệ ✓</div><div v-for="error in editor.validation.errors" :key="error" class="story-error">{{ error }}</div><div v-for="warning in editor.validation.warnings" :key="warning" class="story-warning">{{ warning }}</div>
    </template>
    <template v-else>
      <div class="story-panel-heading">MOCK ASSETS</div>
      <div class="story-node-actions"><button v-for="scene in ['dawn', 'night', 'storm']" :key="scene" class="story-button" @click="editor.node && (editor.node.background.url = `builtin:${scene}`)">{{ scene }}</button></div>
      <div class="story-muted">Ảnh thiếu biểu cảm dùng normal + huy hiệu/tông màu. Ảnh lỗi dùng silhouette. Nền lỗi dùng phong cảnh CSS; âm thanh builtin được tổng hợp trên thiết bị.</div>
      <div class="story-panel-heading">THƯ VIỆN NHÂN VẬT</div>
      <div v-for="character in editor.draft.characters" :key="character.id" class="story-inspector-card">
        <div class="story-muted story-id">{{ character.id }}</div><div class="story-field-pair"><label class="story-field">Tên · VI<input v-model="character.name.vi" /></label><label class="story-field">Tên · EN<input v-model="character.name.en" /></label></div>
        <label v-for="expression in storyExpressions" :key="expression" class="story-field">{{ expression }}<input :value="character.expressions[expression] ?? ''" placeholder="URL ảnh; để trống dùng normal" @input="character.expressions[expression] = ($event.target as HTMLInputElement).value" /></label>
        <button class="story-button story-button--danger" @click="removeCharacter(character.id)">Xóa nhân vật và gỡ khỏi các node</button>
      </div>
      <button class="story-button" :disabled="editor.draft.characters.length >= 100" @click="editor.draft.characters.push({ id: createUuid(), name: storyText('Nhân vật mới', 'New character'), expressions: { normal: '' } })">＋ Nhân vật mới</button>
      <div class="story-panel-heading">MEDIA RIÊNG CHO STORY</div>
      <div class="story-node-actions"><label class="story-button">{{ editor.mediaBusy ? 'Đang xử lý…' : 'Tải ảnh / audio' }}<input type="file" accept="image/png,image/jpeg,image/webp,image/avif,audio/*" hidden :disabled="editor.mediaBusy" @change="upload" /></label><button class="story-button" :disabled="editor.mediaBusy" @click="editor.loadMedia()">Tải thư viện</button></div>
      <div v-for="asset in editor.assets" :key="asset.url" class="story-inspector-card"><img v-if="asset.kind === 'image'" :src="asset.url" alt="" class="story-asset-thumb" loading="lazy" /><audio v-else :src="asset.url" controls preload="none" class="story-asset-audio" /><div class="story-muted">{{ asset.name }}</div><input class="story-url" :value="asset.url" readonly aria-label="URL media" /><div class="story-node-actions"><button class="story-button" @click="copy(asset.url)">Copy URL</button><button v-if="editor.node" class="story-button" @click="asset.kind === 'image' ? editor.node.background.url = asset.url : editor.node.audio.sfx = asset.url">{{ asset.kind === 'image' ? 'Dùng làm nền' : 'Dùng làm SFX' }}</button></div></div>
    </template>
  </div>
</template>
