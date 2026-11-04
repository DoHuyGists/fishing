import { onMounted, onUnmounted } from "vue";

let lockCount = 0;
let restoreOverflow: (() => void) | undefined;

export function useDocumentScrollLock() {
  let locked = false;

  onMounted(() => {
    if (lockCount === 0) {
      const snapshots = [document.documentElement, document.body].map(({ style }) => ({
        style,
        value: style.getPropertyValue("overflow-y"),
        priority: style.getPropertyPriority("overflow-y"),
      }));

      restoreOverflow = () => {
        for (const { style, value, priority } of snapshots) {
          if (value) style.setProperty("overflow-y", value, priority);
          else style.removeProperty("overflow-y");
        }
      };

      for (const { style } of snapshots) style.setProperty("overflow-y", "hidden");
    }

    lockCount++;
    locked = true;
  });

  onUnmounted(() => {
    if (!locked) return;
    locked = false;
    lockCount--;

    if (lockCount === 0) {
      restoreOverflow?.();
      restoreOverflow = undefined;
    }
  });
}
