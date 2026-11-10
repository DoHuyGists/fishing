import { mergeAttributes, Node } from "@tiptap/vue-3";
import { isGuideMediaUrl } from "../../../utils/guideContent";

/** Native video files from the asset library or a direct HTTP(S) URL. */
export const GuideVideo = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { src: { default: null }, title: { default: null } };
  },
  parseHTML() {
    return [{
      tag: "video[src]",
      getAttrs: (element) => isGuideMediaUrl(element.getAttribute("src") ?? "") ? {} : false,
    }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["video", mergeAttributes(HTMLAttributes, {
      controls: "", playsinline: "", preload: "none",
    })];
  },
});
