import DOMPurify from 'dompurify';
import type { StoryRichToken } from '../types/model/story';

/** Parse once, animate text tokens only. Never render partial HTML or arbitrary styles. */
export function storyTokens(content: string): StoryRichToken[] {
  const template = document.createElement('template');
  template.innerHTML = DOMPurify.sanitize(content, { ALLOWED_TAGS: ['strong', 'b', 'em', 'i', 'span', 'br'], ALLOWED_ATTR: ['style'], ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false });
  const tokens: StoryRichToken[] = [];
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  function walk(node: Node, bold = false, italic = false, color = '') {
    if (node.nodeType === Node.TEXT_NODE) {
      for (const { segment } of segmenter.segment(node.textContent ?? '')) tokens.push({ text: segment, bold, italic, color });
      return;
    }
    if (node instanceof HTMLElement) {
      if (node.tagName === 'BR') { tokens.push({ text: '\n', bold, italic, color }); return; }
      bold ||= ['B', 'STRONG'].includes(node.tagName);
      italic ||= ['I', 'EM'].includes(node.tagName);
      const candidate = node.style.color;
      if (/^(#[a-f\d]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i.test(candidate)) color = candidate;
    }
    node.childNodes.forEach(child => walk(child, bold, italic, color));
  }
  walk(template.content);
  return tokens;
}
