import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { supabaseAssetRepository, type AssetRow } from "../../../data/supabaseAssetRepository";
import { useToast } from "../../../composables/useToast";

const messageOf = (cause: unknown) => cause instanceof Error ? cause.message : "Vui lòng thử lại.";

export const useAdminAssetsStore = defineStore("admin-assets", () => {
  const rows = ref<AssetRow[]>([]);
  const search = ref("");
  const kind = ref<"all" | "image" | "video">("all");
  const loading = ref(false);
  const uploading = ref(false);
  const removing = ref(false);
  const error = ref("");
  const uploadErrors = ref<string[]>([]);
  const deleteError = ref("");
  const deleting = ref<AssetRow | null>(null);
  const completed = ref(0);
  const total = ref(0);
  const toast = useToast();
  const busy = computed(() => uploading.value || removing.value);
  const filteredRows = computed(() => rows.value.filter(row =>
    (kind.value === "all" || row.kind === kind.value) &&
    row.name.toLocaleLowerCase("vi").includes(search.value.trim().toLocaleLowerCase("vi")),
  ));

  async function fetchRows() {
    if (loading.value || busy.value) return;
    loading.value = true;
    error.value = "";
    try { rows.value = await supabaseAssetRepository.fetchAll(); }
    catch (cause) { error.value = `Không thể tải danh sách: ${messageOf(cause)}`; }
    finally { loading.value = false; }
  }

  async function upload(files: File[]) {
    if (!files.length || loading.value || busy.value) return;
    uploading.value = true;
    uploadErrors.value = [];
    completed.value = 0;
    total.value = files.length;
    let succeeded = 0;
    try {
      for (const file of files) {
        try {
          const row = await supabaseAssetRepository.upload(file);
          rows.value.unshift(row);
          succeeded++;
        } catch (cause) { uploadErrors.value.push(`${file.name}: ${messageOf(cause)}`); }
        completed.value++;
      }
      if (succeeded) toast.success(`Đã tải lên ${succeeded}/${files.length} tệp.`);
    } finally { uploading.value = false; }
  }

  async function copyLink(row: AssetRow) {
    try {
      await navigator.clipboard.writeText(row.url);
      toast.success("Đã sao chép link.");
    } catch {
      toast.error("Không thể truy cập bộ nhớ tạm. Hãy chọn và sao chép link trong ô bên dưới tệp.");
    }
  }

  function requestDelete(row: AssetRow) {
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
    if (!deleting.value || loading.value || busy.value) return;
    const path = deleting.value.path;
    removing.value = true;
    deleteError.value = "";
    try {
      await supabaseAssetRepository.remove(path);
      rows.value = rows.value.filter(row => row.path !== path);
      deleting.value = null;
      toast.success("Đã xóa tệp.");
    } catch (cause) { deleteError.value = messageOf(cause); }
    finally { removing.value = false; }
  }
  function resetView() {
    if (busy.value) return;
    search.value = "";
    kind.value = "all";
    error.value = "";
    uploadErrors.value = [];
    cancelDelete();
  }
  return { rows, search, kind, loading, uploading, removing, busy, error, uploadErrors,
    deleteError, deleting, completed, total, filteredRows, fetchRows, upload, copyLink,
    requestDelete, cancelDelete, remove, resetView };
});
