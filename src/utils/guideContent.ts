import DOMPurify from "dompurify";

const supportedMarkup = /<\/?(?:div|p|h[1-6]|br|strong|b|em|i|u|s|strike|a|ul|ol|li|blockquote|pre|code|hr|img|video)(?:\s[^>]*|\s*\/?)>/i;

export function isGuideMediaUrl(value: string): boolean {
  const src = value.trim();
  try {
    const url = new URL(src);
    return /^https?:\/\//i.test(src) && ["https:", "http:"].includes(url.protocol);
  } catch {
    return false;
  }
}

export const isGuideImageUrl = isGuideMediaUrl;

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Keep existing plain-text guides readable while accepting editor HTML. */
export function sanitizeGuideContent(content: string): string {
  const html = supportedMarkup.test(content)
    ? content
    : `<div>${escapeText(content).replace(/\r\n?|\n/g, "<br>")}</div>`;
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["div", "p", "h1", "h2", "h3", "h4", "h5", "h6", "br", "strong", "b", "em", "i", "u", "s", "strike", "a", "ul", "ol", "li", "blockquote", "pre", "code", "hr", "img", "video"],
    ALLOWED_ATTR: ["href", "title", "start", "src", "alt", "controls", "playsinline", "preload", "data-guide-list", "data-guide-list-item"],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  });
  const template = document.createElement("template");
  template.innerHTML = clean;
  // Normalize imported blocks to the same div-based document used by the editor.
  template.content.querySelectorAll("p, h1, h2, h3, h4, h5, h6, ul, ol, li").forEach((element) => {
    const block = document.createElement("div");
    if (element.tagName === "UL" || element.tagName === "OL") {
      block.setAttribute("data-guide-list", element.tagName === "UL" ? "bullet" : "ordered");
      if (element.hasAttribute("start")) block.setAttribute("start", element.getAttribute("start")!);
    } else if (element.tagName === "LI") {
      block.setAttribute("data-guide-list-item", "");
    }
    block.append(...element.childNodes);
    element.replaceWith(block);
  });
  template.content.querySelectorAll('[data-guide-list="ordered"]').forEach((element) => {
    const start = Number(element.getAttribute("start") ?? 1);
    (element as HTMLElement).style.setProperty("--guide-list-start", String(Number.isSafeInteger(start) ? start - 1 : 0));
  });
  template.content.querySelectorAll("a[href]").forEach((link) => {
    const href = link.getAttribute("href") ?? "";
    if (!/^(?:https?:\/\/|mailto:)/i.test(href)) link.removeAttribute("href");
  });
  template.content.querySelectorAll("img").forEach((image) => {
    const src = image.getAttribute("src")?.trim() ?? "";
    if (isGuideImageUrl(src)) image.setAttribute("src", src);
    else image.remove();
  });
  template.content.querySelectorAll("video").forEach((video) => {
    const src = video.getAttribute("src")?.trim() ?? "";
    if (!isGuideMediaUrl(src)) {
      video.remove();
      return;
    }
    video.setAttribute("src", src);
    video.setAttribute("controls", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("preload", "none");
  });
  return template.innerHTML;
}

export function guideContentText(content: string): string {
  const template = document.createElement("template");
  template.innerHTML = sanitizeGuideContent(content);
  template.content.querySelectorAll("img").forEach((image) => image.replaceWith(`\n[${image.getAttribute("alt")?.trim() || "Hình ảnh"}]\n`));
  template.content.querySelectorAll("video").forEach((video) => video.replaceWith(`\n[${video.getAttribute("title")?.trim() || "Video"}]\n`));
  template.content.querySelectorAll("br").forEach((element) => element.replaceWith("\n"));
  template.content.querySelectorAll("div, li, blockquote, pre").forEach((element) => element.append("\n"));
  return template.content.textContent?.replace(/[\u200B\uFEFF]/g, "").trim() ?? "";
}
