import { nextTick, onMounted, onUnmounted, type Ref } from 'vue';

const stack: symbol[] = [];
let bodyOverflow = '';

/** Story dialogs own focus and scrolling, including a confirmation above the editor. */
export function useStoryDialogFocus(panel: Ref<HTMLElement | undefined>, close: () => void) {
  const token = Symbol('story-dialog');
  let previous: HTMLElement | null = null;
  function keydown(event: KeyboardEvent) {
    if (stack.at(-1) !== token) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key !== 'Tab' || !panel.value) return;
    const elements = [...panel.value.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(el => el.getClientRects().length && !el.closest('fieldset:disabled'));
    const first = elements[0], last = elements.at(-1);
    if (!first) { event.preventDefault(); panel.value.focus(); }
    else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.value || !panel.value.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.value || !panel.value.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
  }
  onMounted(async () => {
    previous = document.activeElement as HTMLElement | null;
    if (!stack.length) { bodyOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    stack.push(token); document.addEventListener('keydown', keydown, true);
    await nextTick();
    if (stack.at(-1) === token) panel.value?.focus();
  });
  onUnmounted(() => {
    const index = stack.indexOf(token); if (index >= 0) stack.splice(index, 1);
    document.removeEventListener('keydown', keydown, true);
    if (!stack.length) document.body.style.overflow = bodyOverflow;
    if (previous?.isConnected) previous.focus();
  });
}
