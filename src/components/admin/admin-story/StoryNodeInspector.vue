<script setup lang="ts">
import { useStoryEditorStore } from './admin-story-editor-store';
import { createUuid } from '../../../utils/uuid';
import { storyAnimations, storyEffects, storyExpressions, storyText } from '../../../utils/story';
import type { CharacterState } from '../../../types/model/story';
const editor = useStoryEditorStore();
function speaker(event: Event) {
  const id = (event.target as HTMLSelectElement).value;
  const character = editor.draft?.characters.find(c => c.id === id);
  if (!editor.node) return;
  editor.node.speaker = character ? { id, name: { ...character.name }, title: storyText() } : null;
  editor.node.characters.forEach(c => { c.isSpeaking = c.characterId === id; });
}
function slot(position: CharacterState['position'], event: Event) {
  const id = (event.target as HTMLSelectElement).value;
  if (!editor.node) return;
  editor.node.characters = editor.node.characters.filter(c => c.position !== position);
  if (id) editor.node.characters.push({ characterId: id, position, expression: 'normal', animation: 'none', isSpeaking: editor.node.speaker?.id === id });
}
function title(locale: 'vi' | 'en', event: Event) {
  if (!editor.node?.speaker) return;
  editor.node.speaker.title ??= storyText();
  editor.node.speaker.title[locale] = (event.target as HTMLInputElement).value;
}
</script>
<template>
  <div v-if="editor.node && editor.draft" class="story-inspector-fields">
    <div class="story-panel-heading">NODE PROPERTIES</div>
    <div class="story-muted story-id">{{ editor.node.id }}</div>
    <button class="story-button" @click="editor.draft.startNodeId = editor.node.id">Đặt làm node mở đầu</button>
    <label class="story-field">Người nói<select :value="editor.node.speaker?.id ?? ''" @change="speaker"><option value="">Người dẫn chuyện</option><option v-for="character in editor.draft.characters" :key="character.id" :value="character.id">{{ character.name.vi }}</option></select></label>
    <template v-if="editor.node.speaker">
      <div class="story-field-pair"><label class="story-field">Tên · VI<input v-model="editor.node.speaker.name.vi" /></label><label class="story-field">Tên · EN<input v-model="editor.node.speaker.name.en" /></label></div>
      <div class="story-field-pair"><label class="story-field">Chức danh · VI<input :value="editor.node.speaker.title?.vi ?? ''" @input="title('vi', $event)" /></label><label class="story-field">Chức danh · EN<input :value="editor.node.speaker.title?.en ?? ''" @input="title('en', $event)" /></label></div>
    </template>
    <label class="story-field">Thoại · VI<textarea v-model="editor.node.dialogue.vi" rows="4" /></label><label class="story-field">Thoại · EN<textarea v-model="editor.node.dialogue.en" rows="4" /></label>
    <div class="story-muted">Định dạng: &lt;strong&gt;, &lt;em&gt;, &lt;br&gt;, &lt;span style="color:#4fc3ff"&gt;.</div>
    <label class="story-field">Phông nền<input v-model="editor.node.background.url" list="story-backgrounds" placeholder="/images/background.webp hoặc https://…" /></label><datalist id="story-backgrounds"><option value="builtin:dawn" /><option value="builtin:night" /><option value="builtin:storm" /></datalist>
    <div class="story-field-pair"><label class="story-field">Chuyển cảnh<select v-model="editor.node.background.transition"><option>none</option><option>fade</option><option>flash</option></select></label><label class="story-field">VFX<select v-model="editor.node.vfx"><option v-for="effect in storyEffects" :key="effect">{{ effect }}</option></select></label></div>
    <div class="story-panel-heading">NHÂN VẬT / TỐI ĐA 3</div>
    <div v-for="position in (['left', 'center', 'right'] as const)" :key="position" class="story-inspector-card">
      <label class="story-field">{{ position }}<select :value="editor.node.characters.find(c => c.position === position)?.characterId ?? ''" @change="slot(position, $event)"><option value="">Trống</option><option v-for="character in editor.draft.characters" :key="character.id" :value="character.id" :disabled="editor.node.characters.some(c => c.characterId === character.id && c.position !== position)">{{ character.name.vi }}</option></select></label>
      <template v-for="actor in editor.node.characters.filter(c => c.position === position)" :key="actor.characterId"><div class="story-field-pair"><label class="story-field">Biểu cảm<select v-model="actor.expression"><option v-for="expression in storyExpressions" :key="expression">{{ expression }}</option></select></label><label class="story-field">Diễn hoạt<select v-model="actor.animation"><option v-for="animation in storyAnimations" :key="animation">{{ animation }}</option></select></label></div><label class="story-check"><input v-model="actor.isSpeaking" type="checkbox" /> Highlight người nói</label></template>
    </div>
    <div class="story-panel-heading">ÂM THANH</div>
    <label class="story-field">BGM<input :value="editor.node.audio.bgm" list="story-bgm" placeholder="Kế thừa BGM node trước" @input="editor.node.audio.bgm = ($event.target as HTMLInputElement).value" /></label>
    <div class="story-node-actions"><button class="story-button" @click="delete editor.node.audio.bgm">Kế thừa</button><button class="story-button" @click="editor.node.audio.bgm = ''">Dừng BGM</button></div>
    <datalist id="story-bgm"><option value="builtin:dawn" /><option value="builtin:storm" /><option value="builtin:night" /></datalist>
    <label class="story-field">SFX<input v-model="editor.node.audio.sfx" list="story-sfx" placeholder="URL âm thanh" /></label><datalist id="story-sfx"><option value="builtin:signal" /><option value="builtin:impact" /></datalist>
    <label class="story-field">Voice<input v-model="editor.node.audio.voice" placeholder="URL âm thanh (thiếu thì im lặng)" /></label>
    <div class="story-panel-heading">ĐƯỜNG NỐI</div>
    <label class="story-field">Node tiếp theo<select v-model="editor.node.nextNodeId" :disabled="editor.node.choices.length > 0"><option :value="null">■ Kết thúc chương</option><option v-for="(node, index) in editor.draft.nodes" :key="node.id" :value="node.id">{{ index + 1 }} · {{ node.dialogue.vi.replace(/<[^>]*>/g, '').slice(0, 35) }}</option></select></label>
    <div v-for="(choice, index) in editor.node.choices" :key="choice.id" class="story-inspector-card"><label class="story-field">Lựa chọn {{ index + 1 }} · VI<input v-model="choice.text.vi" /></label><label class="story-field">Lựa chọn · EN<input v-model="choice.text.en" /></label><label class="story-field">Đi tới<select v-model="choice.nextNodeId"><option v-for="(node, order) in editor.draft.nodes" :key="node.id" :value="node.id">{{ order + 1 }} · {{ node.dialogue.vi.slice(0, 28) }}</option></select></label><button class="story-button story-button--danger" @click="editor.node.choices.splice(index, 1)">Xóa lựa chọn</button></div>
    <button class="story-button" :disabled="editor.node.choices.length >= 8" @click="editor.node.choices.push({ id: createUuid(), text: storyText('Lựa chọn mới', 'New choice'), nextNodeId: editor.node.nextNodeId ?? editor.node.id })">＋ Thêm lựa chọn</button>
  </div>
</template>
