<script setup lang="ts">
import type { AssetRow } from "../../types/table/asset";
import { t as tr } from "../../i18n";

import { computed, defineAsyncComponent, nextTick, ref, useId, watch } from "vue";
import { EditorContent, mergeAttributes, useEditor, type Editor } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Paragraph from "@tiptap/extension-paragraph";
import { BulletList, OrderedList, ListItem } from "@tiptap/extension-list";
import Image from "@tiptap/extension-image";
import { isGuideMediaUrl, sanitizeGuideContent } from "../../utils/guideContent";
import { GuideVideo } from "./guideVideo";


const AssetsManagementModal = defineAsyncComponent(() => import("../admin/assets/AssetsManagementModal.vue"));

const model = defineModel<string>({ required: true });
const props = withDefaults(defineProps<{ disabled?: boolean; invalid?: boolean; label?: string }>(), {
  disabled: false,
  invalid: false,
  label: undefined,
});
const editorLabel = computed(() => props.label ?? tr('RichEditor.noi_dung_huong_dan'));
const editorId = useId();
const linkOpen = ref(false);
const linkUrl = ref("");
const linkText = ref("");
const linkError = ref("");
const mediaOpen = ref(false);
const mediaUrl = ref("");
const mediaDescription = ref("");
type MediaKind = "image" | "video";
const knownMedia = ref<{ url: string; kind: MediaKind } | null>(null);
const manualMediaKind = ref<MediaKind | "">("");
const detectedMediaKind = computed<MediaKind | null>(() => {
  const url = mediaUrl.value.trim();
  if (knownMedia.value?.url === url) return knownMedia.value.kind;
  try {
    const path = new URL(url).pathname;
    if (/\.(mp4|webm|mov|m4v|ogv)$/i.test(path)) return "video";
    if (/\.(jpe?g|png|gif|webp|avif|svg|bmp|ico)$/i.test(path)) return "image";
  } catch { /* Wait for a valid URL before asking for a type. */ }
  return null;
});
const mediaKind = computed(() => detectedMediaKind.value ?? (manualMediaKind.value || null));
const needsMediaKind = computed(() => isGuideMediaUrl(mediaUrl.value) && !detectedMediaKind.value);
const mediaError = ref("");
const assetTarget = ref<"link" | "media" | null>(null);
const linkInput = ref<HTMLInputElement | null>(null);
const mediaInput = ref<HTMLInputElement | null>(null);
const mediaPanelId = `${editorId}-media`;
const TextBlock = Paragraph.extend({
  parseHTML() {
    return [
      { tag: "div", getAttrs: (element) => element.hasAttribute("data-guide-list") || element.hasAttribute("data-guide-list-item") ? false : null },
      { tag: "p" },
    ];
  },
  renderHTML({ HTMLAttributes }) { return ["div", HTMLAttributes, 0]; },
});
const DivBulletList = BulletList.extend({
  parseHTML() { return [{ tag: 'div[data-guide-list="bullet"]' }, { tag: "ul" }]; },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { "data-guide-list": "bullet" }), 0];
  },
});
const DivOrderedList = OrderedList.extend({
  parseHTML() { return [{ tag: 'div[data-guide-list="ordered"]' }, { tag: "ol" }]; },
  renderHTML({ HTMLAttributes }) {
    const start = Number(HTMLAttributes.start ?? 1);
    return ["div", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      "data-guide-list": "ordered",
      style: `--guide-list-start: ${Number.isSafeInteger(start) ? start - 1 : 0}`,
    }), 0];
  },
});
const DivListItem = ListItem.extend({
  parseHTML() { return [{ tag: "div[data-guide-list-item]" }, { tag: "li" }]; },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { "data-guide-list-item": "" }), 0];
  },
});

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      paragraph: false,
      heading: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      link: { openOnClick: false, defaultProtocol: "https", HTMLAttributes: { target: null, rel: "noopener noreferrer" } },
    }),
    TextBlock,
    DivBulletList,
    DivOrderedList,
    DivListItem,
    Image.configure({ allowBase64: false }),
    GuideVideo,
  ],
  content: sanitizeGuideContent(model.value),
  editable: !props.disabled,
  editorProps: {
    attributes: {
      id: editorId,
      role: "textbox",
      "aria-label": editorLabel.value,
      "aria-multiline": "true",
      class: "min-h-72 px-4 py-3 outline-none",
    },
    transformPastedHTML: sanitizeGuideContent,
  },
  onUpdate: ({ editor: current }) => { model.value = current.getHTML(); },
});

const tools: { label: string; text: string; active?: string; run: (value: Editor) => void; enabled?: (value: Editor) => boolean }[] = [
  { get label() { return tr('RichEditor.in_dam_ctrl_b'); }, get text() { return tr('RichEditor.dam'); }, active: "bold", run: (value) => { value.chain().focus().toggleBold().run(); } },
  { get label() { return tr('RichEditor.in_nghieng_ctrl_i'); }, get text() { return tr('RichEditor.nghieng'); }, active: "italic", run: (value) => { value.chain().focus().toggleItalic().run(); } },
  { get label() { return tr('RichEditor.gach_chan_ctrl_u'); }, get text() { return tr('RichEditor.gach_chan'); }, active: "underline", run: (value) => { value.chain().focus().toggleUnderline().run(); } },
  { get label() { return tr('RichEditor.gach_ngang'); }, get text() { return tr('RichEditor.gach_ngang'); }, active: "strike", run: (value) => { value.chain().focus().toggleStrike().run(); } },
  { get label() { return tr('RichEditor.danh_sach_dau_cham'); }, get text() { return tr('RichEditor.danh_sach'); }, active: "bulletList", run: (value) => { value.chain().focus().toggleBulletList().run(); } },
  { get label() { return tr('RichEditor.danh_sach_danh_so'); }, get text() { return tr('RichEditor.1_danh_sach'); }, active: "orderedList", run: (value) => { value.chain().focus().toggleOrderedList().run(); } },
  { get label() { return tr('RichEditor.trich_dan'); }, get text() { return tr('RichEditor.trich_dan'); }, active: "blockquote", run: (value) => { value.chain().focus().toggleBlockquote().run(); } },
  { get label() { return tr('RichEditor.ma_noi_dong'); }, get text() { return tr('RichEditor.ma'); }, active: "code", run: (value) => { value.chain().focus().toggleCode().run(); } },
  { get label() { return tr('RichEditor.xoa_dinh_dang'); }, get text() { return tr('RichEditor.bo_dinh_dang'); }, run: (value) => { value.chain().focus().unsetAllMarks().clearNodes().run(); } },
  { get label() { return tr('RichEditor.hoan_tac_ctrl_z'); }, text: "↶", run: (value) => { value.chain().focus().undo().run(); }, enabled: (value) => value.can().undo() },
  { get label() { return tr('RichEditor.lam_lai_ctrl_shift_z'); }, text: "↷", run: (value) => { value.chain().focus().redo().run(); }, enabled: (value) => value.can().redo() },
];
const characterCount = computed(() => editor.value?.getText().trim().length ?? 0);

watch(model, (value) => {
  if (editor.value && value !== editor.value.getHTML()) {
    editor.value.commands.setContent(sanitizeGuideContent(value), { emitUpdate: false });
  }
});
watch(() => props.disabled, (value) => editor.value?.setEditable(!value));
watch(editorLabel, (value) => editor.value?.view.dom.setAttribute("aria-label", value));
watch(() => props.invalid, (value) => editor.value?.view.dom.setAttribute("aria-invalid", String(value)));
watch(mediaUrl, () => {
  knownMedia.value = null;
  manualMediaKind.value = "";
  mediaError.value = "";
}, { flush: "sync" });

function openLink() {
  if (!editor.value || props.disabled) return;
  mediaOpen.value = false;
  if (editor.value.state.selection.empty && editor.value.isActive("link")) {
    editor.value.commands.extendMarkRange("link");
  }
  const { from, to } = editor.value.state.selection;
  linkText.value = editor.value.state.doc.textBetween(from, to, " ");
  linkUrl.value = editor.value.getAttributes("link").href ?? "";
  linkError.value = "";
  linkOpen.value = true;
}

function openAssets(target: "link" | "media") {
  if (!editor.value || props.disabled) return;
  assetTarget.value = target;
}

async function closeAssets() {
  const target = assetTarget.value;
  assetTarget.value = null;
  await nextTick();
  (target === "media" ? mediaInput.value : linkInput.value)?.focus();
}

function selectAsset(asset: AssetRow) {
  if (props.disabled || !assetTarget.value) return;
  if (assetTarget.value === "media") {
    mediaUrl.value = asset.url;
    knownMedia.value = { url: asset.url.trim(), kind: asset.kind };
    mediaError.value = "";
  } else {
    linkUrl.value = asset.url;
    if (!linkText.value.trim()) linkText.value = asset.name;
    linkError.value = "";
  }
  void closeAssets();
}

function applyLink() {
  if (!editor.value || props.disabled) return;
  const href = linkUrl.value.trim();
  const text = linkText.value.trim();
  try {
    const url = new URL(href);
    if (!["http:", "https:", "mailto:"].includes(url.protocol)) throw new Error();
  } catch {
    linkError.value = tr('RichEditor.nhap_lien_ket_bat_dau_bang_https_http_hoac_mailto');
    return;
  }
  if (!text) {
    linkError.value = tr('RichEditor.nhap_van_ban_hien_thi_cho_lien_ket');
    return;
  }
  const { from, to } = editor.value.state.selection;
  if (text === editor.value.state.doc.textBetween(from, to, " ")) {
    editor.value.chain().focus().extendMarkRange("link").setLink({ href }).run();
  } else {
    const marks = editor.value.state.selection.$from.marks()
      .filter(mark => mark.type.name !== "link")
      .map(mark => mark.toJSON());
    editor.value.chain().focus().insertContent({
      type: "text", text, marks: [...marks, { type: "link", attrs: { href } }],
    }).unsetMark("link").setMeta("preventAutolink", true).run();
  }
  linkOpen.value = false;
}

function removeLink() {
  editor.value?.chain().focus().extendMarkRange("link").unsetLink().run();
  linkOpen.value = false;
}

function openMedia() {
  if (!editor.value || props.disabled) return;
  const kind = editor.value.isActive("video") ? "video" : "image";
  const attributes = editor.value.getAttributes(kind);
  mediaUrl.value = attributes.src ?? "";
  knownMedia.value = attributes.src ? { url: mediaUrl.value.trim(), kind } : null;
  manualMediaKind.value = "";
  mediaDescription.value = (kind === "video" ? attributes.title : attributes.alt) ?? "";
  mediaError.value = "";
  linkOpen.value = false;
  mediaOpen.value = true;
}

function applyMedia() {
  if (!editor.value || props.disabled) return;
  const src = mediaUrl.value.trim();
  if (!isGuideMediaUrl(src)) {
    mediaError.value = tr('RichEditor.nhap_lien_ket_anh_video_hop_le_bat_dau_bang_https_hoac_http');
    return;
  }
  if (!mediaKind.value) {
    mediaError.value = tr('RichEditor.chua_nhan_dien_duoc_loai_tep_hay_chon_anh_hoac_video');
    return;
  }
  const description = mediaDescription.value.trim();
  const chain = editor.value.chain().focus();
  const inserted = mediaKind.value === "image"
    ? chain.setImage({ src, alt: description }).run()
    : editor.value.isActive("video")
      ? chain.updateAttributes("video", { src, title: description }).run()
      : chain.insertContent({ type: "video", attrs: { src, title: description } }).run();
  if (!inserted) {
    mediaError.value = tr('RichEditor.khong_the_chen_anh_video_tai_vi_tri_nay_hay_dat_con_tro_vao_mot_');
    return;
  }
  mediaOpen.value = false;
}
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-[#cbd9c6] bg-white text-[#24352a] focus-within:ring-2 focus-within:ring-emerald-700/20" :class="{ 'opacity-60': disabled }">
    <div role="group" :aria-label="tr('RichEditor.dinh_dang_noi_dung')" class="flex flex-wrap gap-1 border-b border-[#cbd9c6] bg-[#f5f9f0] p-2">
      <button
        v-for="tool in tools" :key="tool.label" type="button" :title="tool.label" :aria-label="tool.label"
        :aria-pressed="tool.active ? editor?.isActive(tool.active) : undefined"
        :disabled="disabled || !editor || (tool.enabled ? !tool.enabled(editor) : false)"
        class="rounded-md border px-2.5 py-1.5 text-xs font-semibold hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        :class="tool.active && editor?.isActive(tool.active) ? 'border-emerald-700 bg-emerald-100 text-emerald-900' : 'border-transparent'"
        @mousedown.prevent @click="editor && tool.run(editor)"
      >{{ tool.text }}</button>
      <button type="button" :disabled="disabled || !editor" :aria-expanded="linkOpen" :aria-pressed="editor?.isActive('link')" class="rounded-md border border-[#cbd9c6] px-2.5 py-1.5 text-xs font-semibold hover:bg-emerald-100 disabled:opacity-40" @mousedown.prevent @click="openLink">{{ tr('RichEditor.lien_ket') }}</button>
      <button type="button" :disabled="disabled || !editor" :aria-expanded="mediaOpen" :aria-controls="mediaPanelId" class="rounded-md border border-[#cbd9c6] px-2.5 py-1.5 text-xs font-semibold hover:bg-emerald-100 disabled:opacity-40" @mousedown.prevent @click="openMedia">{{ tr('RichEditor.chen_anh_video') }}</button>
    </div>
    <div v-if="linkOpen" class="space-y-2 border-b border-[#cbd9c6] bg-[#f5f9f0] p-3">
      <label class="block text-xs font-semibold">{{ tr('RichEditor.van_ban_hien_thi') }}
        <input v-model="linkText" type="text" :placeholder="tr('RichEditor.vi_du_xem_huong_dan')" :disabled="disabled" class="mt-1 w-full rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm" @keydown.enter.prevent="applyLink" />
      </label>
      <label class="block text-xs font-semibold">{{ tr('RichEditor.dia_chi_lien_ket') }}
        <input ref="linkInput" v-model="linkUrl" type="url" placeholder="https://..." :disabled="disabled" class="mt-1 w-full rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm" @keydown.enter.prevent="applyLink" />
      </label>
      <div v-if="linkError" role="alert" class="text-xs text-red-700">{{ linkError }}</div>
      <div class="flex flex-wrap gap-2">
        <button type="button" :disabled="disabled || !editor" class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-1.5 text-xs font-semibold hover:bg-emerald-100 disabled:opacity-40" @click="openAssets('link')">{{ tr('RichEditor.chon_tu_kho_anh_video') }}</button>
        <button type="button" :disabled="disabled" class="rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40" @click="applyLink">{{ tr('RichEditor.ap_dung') }}</button>
        <button type="button" :disabled="disabled || !editor?.isActive('link')" class="rounded-lg border border-[#cbd9c6] px-3 py-1.5 text-xs disabled:opacity-40" @click="removeLink">{{ tr('RichEditor.go_lien_ket') }}</button>
        <button type="button" class="rounded-lg border border-[#cbd9c6] px-3 py-1.5 text-xs" @click="linkOpen = false">{{ tr('ChangePasswordModal.dong') }}</button>
      </div>
    </div>
    <div v-if="mediaOpen" :id="mediaPanelId" class="space-y-2 border-b border-[#cbd9c6] bg-[#f5f9f0] p-3" @keydown.esc.stop.prevent="mediaOpen = false">
      <label class="block text-xs font-semibold">{{ tr('RichEditor.lien_ket_anh_video') }}
        <input ref="mediaInput" v-model="mediaUrl" type="url" :placeholder="tr('RichEditor.https_example_com_anh_jpg_hoac_video_mp4')" :disabled="disabled" :aria-invalid="!!mediaError" class="mt-1 w-full rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm" @keydown.enter.prevent="applyMedia" />
      </label>
      <label v-if="needsMediaKind" class="block text-xs font-semibold">{{ tr('RichEditor.chua_nhan_dien_duoc_loai_tep_chon_loai_noi_dung') }}
        <select v-model="manualMediaKind" :disabled="disabled" class="mt-1 block rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm">
          <option disabled value="">{{ tr('RichEditor.chon_anh_hoac_video') }}</option>
          <option value="image">{{ tr('RichEditor.anh') }}</option>
          <option value="video">Video</option>
        </select>
      </label>
      <div class="text-xs text-[#24352a]/70">{{ tr('RichEditor.video_dung_link_truc_tiep_den_tep_vi_du_mp4_hoac_webm_chon_tu_kh') }}</div>
      <label class="block text-xs font-semibold">{{ tr('RichEditor.mo_ta_anh_video_tuy_chon') }}
        <input v-model="mediaDescription" type="text" :placeholder="tr('RichEditor.mo_ta_noi_dung_anh_video')" :disabled="disabled" class="mt-1 w-full rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm" @keydown.enter.prevent="applyMedia" />
      </label>
      <div v-if="mediaError" role="alert" class="text-xs text-red-700">{{ mediaError }}</div>
      <div class="flex flex-wrap gap-2">
        <button type="button" :disabled="disabled || !editor" class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-1.5 text-xs font-semibold hover:bg-emerald-100 disabled:opacity-40" @click="openAssets('media')">{{ tr('RichEditor.chon_anh_video_tu_kho') }}</button>
        <button type="button" :disabled="disabled" class="rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40" @click="applyMedia">{{ editor?.isActive('image') || editor?.isActive('video') ? tr('RichEditor.cap_nhat_anh_video') : tr('RichEditor.chen_vao_noi_dung') }}</button>
        <button type="button" class="rounded-lg border border-[#cbd9c6] px-3 py-1.5 text-xs" @click="mediaOpen = false">{{ tr('ChangePasswordModal.dong') }}</button>
      </div>
    </div>
    <EditorContent :editor="editor" class="guide-editor max-h-[55dvh] overflow-y-auto text-sm leading-7" />
    <div class="border-t border-[#cbd9c6] px-3 py-2 text-xs text-[#24352a]/65">{{ characterCount }} {{ tr('RichEditor.ky_tu_enter_de_xuong_doan_shift_enter_de_xuong_dong') }}</div>
    <Teleport to="body">
      <AssetsManagementModal v-if="assetTarget" selection-mode :z-index="60" @select="selectAsset" @close="closeAssets" />
    </Teleport>
  </div>
</template>

<style scoped>
.guide-editor :deep(.tiptap > div) { min-height: 1.75em; }
.guide-editor :deep(strong) { font-weight: 700; }
.guide-editor :deep(em) { font-style: italic; }
.guide-editor :deep(pre) { overflow-x: auto; border-radius: 0.5rem; background: #eef2e9; padding: 0.75rem; }
.guide-editor :deep(img) { display: block; max-width: 100%; height: auto; margin: 0.75rem 0; border-radius: 0.5rem; }
.guide-editor :deep(img.ProseMirror-selectednode) { outline: 2px solid #047857; outline-offset: 2px; }
.guide-editor :deep(video) { display: block; width: 100%; max-height: 55dvh; margin: 0.75rem 0; border-radius: 0.5rem; background: #000; }
.guide-editor :deep(video.ProseMirror-selectednode) { outline: 2px solid #047857; outline-offset: 2px; }
.guide-editor :deep(a) { color: #047857; text-decoration: underline; text-underline-offset: 2px; }
</style>
