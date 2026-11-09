import DOMPurify from "dompurify";

const supportedMarkup = /<\/?(?:div|p|h[1-6]|br|strong|b|em|i|u|s|strike|a|ul|ol|li|blockquote|pre|code|hr)(?:\s[^>]*|\s*\/?)>/i;

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Keep existing plain-text guides readable while accepting editor HTML. */
export function sanitizeGuideContent(content: string): string {
  const html = supportedMarkup.test(content)
    ? content
    : `<div>${escapeText(content).replace(/\r\n?|\n/g, "<br>")}</div>`;
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["div", "p", "h1", "h2", "h3", "h4", "h5", "h6", "br", "strong", "b", "em", "i", "u", "s", "strike", "a", "ul", "ol", "li", "blockquote", "pre", "code", "hr"],
    ALLOWED_ATTR: ["href", "title", "start"],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  });
  const template = document.createElement("template");
  template.innerHTML = clean;
  // Normalize imported blocks to the same div-based document used by the editor.
  template.content.querySelectorAll("p, h1, h2, h3, h4, h5, h6").forEach((element) => {
    const block = document.createElement("div");
    block.append(...element.childNodes);
    element.replaceWith(block);
  });
  template.content.querySelectorAll("a[href]").forEach((link) => {
    const href = link.getAttribute("href") ?? "";
    if (!/^(?:https?:\/\/|mailto:)/i.test(href)) link.removeAttribute("href");
  });
  return template.innerHTML;
}

export function guideContentText(content: string): string {
  const template = document.createElement("template");
  template.innerHTML = sanitizeGuideContent(content);
  template.content.querySelectorAll("br").forEach((element) => element.replaceWith("\n"));
  template.content.querySelectorAll("div, li, blockquote, pre").forEach((element) => element.append("\n"));
  return template.content.textContent?.replace(/[\u200B\uFEFF]/g, "").trim() ?? "";
}
