import { readonly, ref } from "vue";

export type ToastVariant = "success" | "error" | "warning" | "info" | "neutral";
export type ToastPosition =
  | "top-left"
  | "top"
  | "top-right"
  | "right"
  | "bottom-right"
  | "bottom"
  | "bottom-left"
  | "left";

export interface ToastAction {
  label: string;
  onClick: () => void;
  /** Set false when the action should leave the toast visible. */
  dismissOnClick?: boolean;
}

export interface ToastOptions {
  /** Optional heading, useful when the message needs a short label. */
  title?: string;
  /** Auto close time in milliseconds. Use 0 to keep it open until dismissed. */
  duration?: number;
  /** Allow the user to close it with the × button. Defaults to true. */
  dismissible?: boolean;
  /** Screen edge or corner. Defaults to top-right. */
  position?: ToastPosition;
  /** Optional follow-up action, such as Undo or Retry. */
  action?: ToastAction;
}

export interface ToastItem extends Required<Pick<ToastOptions, "duration" | "dismissible" | "position">> {
  id: string;
  variant: ToastVariant;
  message: string;
  title?: string;
  action?: ToastAction;
}

const items = ref<ToastItem[]>([]);
let nextId = 0;
const MAX_TOASTS = 5;

/**
 * Shared app-wide toast API. Mount <Toast /> once (in App.vue), then call
 * `const toast = useToast()` anywhere. Examples:
 *
 * toast.success("Đã lưu thay đổi");                  // save completed
 * toast.error("Không thể tải dữ liệu", { duration: 0 }); // persistent failure
 * toast.warning("Phiên sắp hết hạn");                // caution / attention
 * toast.info("Đang đồng bộ dữ liệu");                // neutral information
 * toast.success("Đã lưu", { position: "bottom-left" }); // choose any of 8 screen positions
 * toast.show("Đã thêm vào danh sách", "success");    // choose variant dynamically
 * toast.success("Đã xóa", { action: { label: "Hoàn tác", onClick: undo } });
 *
 * Variants: success (completed), error (failed), warning (needs attention),
 * info (informational), neutral (generic). Default duration is 4 seconds;
 * Positions: top-left, top, top-right (default), right, bottom-right, bottom,
 * bottom-left, left. Set duration: 0 for explicit dismissal.
 */
export function useToast() {
  function show(message: string, variant: ToastVariant = "info", options: ToastOptions = {}) {
    const item: ToastItem = {
      id: `toast-${++nextId}`,
      message,
      variant,
      duration: options.duration ?? 4000,
      dismissible: options.dismissible ?? true,
      position: options.position ?? "top-right",
      ...(options.title ? { title: options.title } : {}),
      ...(options.action ? { action: options.action } : {}),
    };
    items.value = [...items.value, item].slice(-MAX_TOASTS);
    return item.id;
  }

  function dismiss(id: string) {
    items.value = items.value.filter((item) => item.id !== id);
  }

  return {
    toasts: readonly(items),
    show,
    dismiss,
    success: (message: string, options?: ToastOptions) => show(message, "success", options),
    error: (message: string, options?: ToastOptions) => show(message, "error", options),
    warning: (message: string, options?: ToastOptions) => show(message, "warning", options),
    info: (message: string, options?: ToastOptions) => show(message, "info", options),
    neutral: (message: string, options?: ToastOptions) => show(message, "neutral", options),
  };
}
