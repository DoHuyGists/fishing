import type { AdminGuideRow, GuidePayload } from "../../../types/table/guide";
import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { supabaseGuideRepository } from "../../../data/supabaseGuideRepository";
import { guideContentText, sanitizeGuideContent } from "../../../utils/guideContent";
import { useToast } from "../../../composables/useToast";

const emptyForm = (): GuidePayload => ({ title: "", content: "", sort_order: 0, is_published: true });
const messageOf = (cause: unknown, fallback: string) => cause instanceof Error ? cause.message : fallback;

export const useAdminGuidesStore = defineStore("admin-guides", () => {
  const rows = ref<AdminGuideRow[]>([]);
  const page = ref(1), total = ref(0), requestId = ref(0), pageSize = 10;
  const search = ref("");
  const status = ref<"all" | "published" | "hidden">("all");
  const loading = ref(false);
  const saving = ref(false);
  const removing = ref(false);
  const error = ref("");
  const formError = ref("");
  const deleteError = ref("");
  const isFormOpen = ref(false);
  const editingId = ref<string | null>(null);
  const deleting = ref<AdminGuideRow | null>(null);
  const form = ref(emptyForm());
  const toast = useToast();
  const busy = computed(() => saving.value || removing.value);
  const searchableRows = computed(() => rows.value.map((row) => ({
    ...row,
    excerpt: guideContentText(row.content),
  })));
  const filteredRows = computed(() => {
    return searchableRows.value;
  });

  async function fetchRows(nextPage = page.value) {
    const request = ++requestId.value;
    loading.value = true;
    error.value = "";
    try {
      const result = await supabaseGuideRepository.fetchAdminPage(nextPage, search.value, status.value);
      if (request !== requestId.value) return;
      rows.value = result.items; page.value = nextPage; total.value = result.total;
      if (!result.items.length && nextPage > 1) await fetchRows(Math.max(1, Math.ceil(result.total / pageSize)));
    } catch (cause) {
      if (request === requestId.value) error.value = messageOf(cause, "Không thể tải hướng dẫn. Vui lòng thử lại.");
    } finally {
      if (request === requestId.value) loading.value = false;
    }
  }

  function openCreate() {
    if (loading.value || busy.value) return;
    editingId.value = null;
    form.value = emptyForm();
    formError.value = "";
    isFormOpen.value = true;
  }

  function openEdit(row: AdminGuideRow) {
    if (loading.value || busy.value) return;
    editingId.value = row.id;
    form.value = { title: row.title, content: sanitizeGuideContent(row.content), sort_order: row.sort_order, is_published: row.is_published };
    formError.value = "";
    isFormOpen.value = true;
  }

  function closeForm() {
    if (saving.value) return;
    isFormOpen.value = false;
    editingId.value = null;
    formError.value = "";
  }

  async function save() {
    if (busy.value || loading.value) return;
    formError.value = "";
    const payload: GuidePayload = {
      title: form.value.title.trim(),
      content: sanitizeGuideContent(form.value.content),
      sort_order: Number(form.value.sort_order),
      is_published: form.value.is_published,
    };
    if (!payload.title || !guideContentText(payload.content)) {
      formError.value = "Vui lòng nhập tiêu đề và nội dung hướng dẫn.";
      return;
    }
    if (form.value.sort_order === null || String(form.value.sort_order).trim() === "" || !Number.isInteger(payload.sort_order) || payload.sort_order < -2147483648 || payload.sort_order > 2147483647) {
      formError.value = "Thứ tự phải là số nguyên hợp lệ trong phạm vi -2147483648 đến 2147483647.";
      return;
    }
    saving.value = true;
    try {
      if (editingId.value) await supabaseGuideRepository.update(editingId.value, payload);
      else await supabaseGuideRepository.create(payload);
      await fetchRows();
      isFormOpen.value = false;
      editingId.value = null;
      toast.success("Đã lưu hướng dẫn.");
    } catch (cause) {
      formError.value = messageOf(cause, "Không thể lưu hướng dẫn. Vui lòng thử lại.");
    } finally {
      saving.value = false;
    }
  }

  function requestDelete(row: AdminGuideRow) {
    if (loading.value || busy.value) return;
    deleting.value = row;
    deleteError.value = "";
  }

  function cancelDelete() {
    if (removing.value) return;
    deleting.value = null;
    deleteError.value = "";
  }

  async function remove() {
    if (!deleting.value || busy.value || loading.value) return;
    const id = deleting.value.id;
    removing.value = true;
    deleteError.value = "";
    try {
      await supabaseGuideRepository.remove(id);
      await fetchRows();
      deleting.value = null;
      toast.success("Đã xóa hướng dẫn.");
    } catch (cause) {
      deleteError.value = messageOf(cause, "Không thể xóa hướng dẫn. Vui lòng thử lại.");
    } finally {
      removing.value = false;
    }
  }

  function resetView() {
    if (busy.value) return;
    closeForm();
    cancelDelete();
    search.value = "";
    status.value = "all";
    error.value = "";
  }

  return { rows, search, status, loading, saving, removing, busy, error, formError, deleteError, isFormOpen, editingId, deleting, form, filteredRows, fetchRows, openCreate, openEdit, closeForm, save, requestDelete, cancelDelete, remove, resetView, page, total, pageSize, requestId };
});
