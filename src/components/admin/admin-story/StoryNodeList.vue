<script setup lang="ts">
import { useStoryEditorStore } from './admin-story-editor-store';
import { localStoryText } from '../../../utils/story';
const editor = useStoryEditorStore();
const emit = defineEmits<{ remove: [] }>();
</script>
<template>
  <aside class="story-node-list">
    <div class="story-panel-heading">TIMELINE <span>{{ editor.draft?.nodes.length }} / 1000</span></div>
    <div class="story-node-actions"><button class="story-button" :disabled="editor.busy" @click="editor.addNode()">＋ Thêm</button><button class="story-button" :disabled="editor.busy" @click="editor.addNode(true)">Nhân bản</button><button class="story-button story-button--danger" :disabled="editor.busy || (editor.draft?.nodes.length ?? 0) < 2" @click="emit('remove')">Xóa</button></div>
    <div class="story-node-scroll">
      <div v-for="(node, index) in editor.draft?.nodes" :key="node.id" class="story-node-card" :class="{ 'story-node-card--active': editor.selectedId === node.id }" :draggable="!editor.busy" @dragstart="editor.dragId = node.id" @dragend="editor.dragId = ''" @dragover.prevent @drop.prevent="editor.reorder(node.id)">
        <button class="story-node-select" :disabled="editor.busy" @click="editor.selectedId = node.id"><span class="story-node-number">{{ String(index + 1).padStart(2, '0') }} {{ editor.draft?.startNodeId === node.id ? '▶' : '' }}</span><span class="story-node-name">{{ localStoryText(node.speaker?.name, 'vi') || 'Người dẫn chuyện' }}</span><span class="story-node-excerpt">{{ node.dialogue.vi.replace(/<[^>]*>/g, '') || 'Chưa có thoại' }}</span><span class="story-muted">{{ node.choices.length ? `${node.choices.length} lựa chọn` : node.nextNodeId ? '→ nối node' : '■ kết thúc' }}</span></button>
        <div class="story-node-reorder"><button :disabled="index === 0 || editor.busy" aria-label="Lên một vị trí" @click="editor.reorder(editor.draft!.nodes[index - 1]!.id, node.id)">↑</button><button :disabled="index === (editor.draft?.nodes.length ?? 0) - 1 || editor.busy" aria-label="Xuống một vị trí" @click="editor.reorder(editor.draft!.nodes[index + 1]!.id, node.id)">↓</button></div>
      </div>
    </div>
    <div class="story-muted story-panel-note">Kéo thả chỉ đổi thứ tự hiển thị. Đường nối được cấu hình trong Inspector.</div>
  </aside>
</template>
