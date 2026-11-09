<script setup lang="ts">
import { computed, ref, useId, watch } from "vue";
import { EditorContent, useEditor, type Editor } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Paragraph from "@tiptap/extension-paragraph";
import { sanitizeGuideContent } from "../../../utils/guideContent";

const model = defineModel<string>({ required: true });
const props = withDefaults(defineProps<{ disabled?: boolean; invalid?: boolean; label?: string }>(), {
  disabled: false,
  invalid: false,
  label: "Nội dung hướng dẫn",
});
const editorId = useId();
const linkOpen = ref(false);
const linkUrl = ref("");
const linkError = ref("");
const TextBlock = Paragraph.extend({
  parseHTML() { return [{ tag: "div" }, { tag: "p" }]; },
  renderHTML({ HTMLAttributes }) { return ["div", HTMLAttributes, 0]; },
});

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      paragraph: false,
      heading: false,
      link: { openOnClick: false, defaultProtocol: "https", HTMLAttributes: { target: null, rel: "noopener noreferrer" } },
    }),
    TextBlock,
  ],
  content: sanitizeGuideContent(model.value),
  editable: !props.disabled,
  editorProps: {
    attributes: {
      id: editorId,
      role: "textbox",
      "aria-label": props.label,
      "aria-multiline": "true",
      class: "min-h-72 px-4 py-3 outline-none",
    },
    transformPastedHTML: sanitizeGuideContent,
  },
  onUpdate: ({ editor: current }) => { model.value = current.getHTML(); },
});

const tools: { label: string; text: string; active?: string; run: (value: Editor) => void; enabled?: (value: Editor) => boolean }[] = [
  { label: "In đậm (Ctrl+B)", text: "Đậm", active: "bold", run: (value) => { value.chain().focus().toggleBold().run(); } },
  { label: "In nghiêng (Ctrl+I)", text: "Nghiêng", active: "italic", run: (value) => { value.chain().focus().toggleItalic().run(); } },
  { label: "Gạch chân (Ctrl+U)", text: "Gạch chân", active: "underline", run: (value) => { value.chain().focus().toggleUnderline().run(); } },
  { label: "Gạch ngang", text: "Gạch ngang", active: "strike", run: (value) => { value.chain().focus().toggleStrike().run(); } },
  { label: "Danh sách dấu chấm", text: "• Danh sách", active: "bulletList", run: (value) => { value.chain().focus().toggleBulletList().run(); } },
  { label: "Danh sách đánh số", text: "1. Danh sách", active: "orderedList", run: (value) => { value.chain().focus().toggleOrderedList().run(); } },
  { label: "Trích dẫn", text: "Trích dẫn", active: "blockquote", run: (value) => { value.chain().focus().toggleBlockquote().run(); } },
  { label: "Mã nội dòng", text: "Mã", active: "code", run: (value) => { value.chain().focus().toggleCode().run(); } },
  { label: "Xóa định dạng", text: "Bỏ định dạng", run: (value) => { value.chain().focus().unsetAllMarks().clearNodes().run(); } },
  { label: "Hoàn tác (Ctrl+Z)", text: "↶", run: (value) => { value.chain().focus().undo().run(); }, enabled: (value) => value.can().undo() },
  { label: "Làm lại (Ctrl+Shift+Z)", text: "↷", run: (value) => { value.chain().focus().redo().run(); }, enabled: (value) => value.can().redo() },
];
const characterCount = computed(() => editor.value?.getText().trim().length ?? 0);

watch(model, (value) => {
  if (editor.value && value !== editor.value.getHTML()) {
    editor.value.commands.setContent(sanitizeGuideContent(value), { emitUpdate: false });
  }
});
watch(() => props.disabled, (value) => editor.value?.setEditable(!value));
watch(() => props.invalid, (value) => editor.value?.view.dom.setAttribute("aria-invalid", String(value)));

function openLink() {
  if (!editor.value || props.disabled) return;
  linkUrl.value = editor.value.getAttributes("link").href ?? "";
  linkError.value = "";
  linkOpen.value = true;
}

function applyLink() {
  if (!editor.value || props.disabled) return;
  const href = linkUrl.value.trim();
  try {
    const url = new URL(href);
    if (!["http:", "https:", "mailto:"].includes(url.protocol)) throw new Error();
  } catch {
    linkError.value = "Nhập liên kết bắt đầu bằng https://, http:// hoặc mailto:.";
    return;
  }
  if (editor.value.state.selection.empty && !editor.value.isActive("link")) {
    editor.value.chain().focus().insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] }).run();
  } else {
    editor.value.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }
  linkOpen.value = false;
}

function removeLink() {
  editor.value?.chain().focus().extendMarkRange("link").unsetLink().run();
  linkOpen.value = false;
}
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-[#cbd9c6] bg-white text-[#24352a] focus-within:ring-2 focus-within:ring-emerald-700/20" :class="{ 'opacity-60': disabled }">
    <div role="group" aria-label="Định dạng nội dung" class="flex flex-wrap gap-1 border-b border-[#cbd9c6] bg-[#f5f9f0] p-2">
      <button
        v-for="tool in tools" :key="tool.label" type="button" :title="tool.label" :aria-label="tool.label"
        :aria-pressed="tool.active ? editor?.isActive(tool.active) : undefined"
        :disabled="disabled || !editor || (tool.enabled ? !tool.enabled(editor) : false)"
        class="rounded-md border px-2.5 py-1.5 text-xs font-semibold hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        :class="tool.active && editor?.isActive(tool.active) ? 'border-emerald-700 bg-emerald-100 text-emerald-900' : 'border-transparent'"
        @mousedown.prevent @click="editor && tool.run(editor)"
      >{{ tool.text }}</button>
      <button type="button" :disabled="disabled || !editor" :aria-expanded="linkOpen" :aria-pressed="editor?.isActive('link')" class="rounded-md border border-[#cbd9c6] px-2.5 py-1.5 text-xs font-semibold hover:bg-emerald-100 disabled:opacity-40" @mousedown.prevent @click="openLink">Liên kết</button>
    </div>
    <div v-if="linkOpen" class="space-y-2 border-b border-[#cbd9c6] bg-[#f5f9f0] p-3">
      <label class="block text-xs font-semibold">Địa chỉ liên kết
        <input v-model="linkUrl" type="url" placeholder="https://..." :disabled="disabled" class="mt-1 w-full rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm" @keydown.enter.prevent="applyLink" />
      </label>
      <div v-if="linkError" role="alert" class="text-xs text-red-700">{{ linkError }}</div>
      <div class="flex flex-wrap gap-2">
        <button type="button" :disabled="disabled" class="rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40" @click="applyLink">Áp dụng</button>
        <button type="button" :disabled="disabled || !editor?.isActive('link')" class="rounded-lg border border-[#cbd9c6] px-3 py-1.5 text-xs disabled:opacity-40" @click="removeLink">Gỡ liên kết</button>
        <button type="button" class="rounded-lg border border-[#cbd9c6] px-3 py-1.5 text-xs" @click="linkOpen = false">Đóng</button>
      </div>
    </div>
    <EditorContent :editor="editor" class="guide-editor max-h-[55dvh] overflow-y-auto text-sm leading-7" />
    <div class="border-t border-[#cbd9c6] px-3 py-2 text-xs text-[#24352a]/65">{{ characterCount }} ký tự · Enter để xuống đoạn, Shift+Enter để xuống dòng.</div>
  </div>
</template>

<style scoped>
.guide-editor :deep(.tiptap > div) { min-height: 1.75em; }
.guide-editor :deep(strong) { font-weight: 700; }
.guide-editor :deep(em) { font-style: italic; }
.guide-editor :deep(pre) { overflow-x: auto; border-radius: 0.5rem; background: #eef2e9; padding: 0.75rem; }
</style>
