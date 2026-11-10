import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import { supabaseAssetRepository, type AssetRow } from "../../../data/supabaseAssetRepository";
import { useToast } from "../../../composables/useToast";
import {
  assetFolderAncestors, assetFolderName, assetFolderParent, normalizeAssetFolder, replaceAssetFolderPrefix,
} from "../../../utils/assetFolders";

const messageOf = (cause: unknown) => cause instanceof Error ? cause.message : "Vui lòng thử lại.";
type FolderDialog = { mode: "create" | "move-folder"; source: string }
  | { mode: "move-asset"; asset: AssetRow };
type ViewEntry = { type: "folder"; key: string; folder: string; name: string; depth: number; count: number; expanded: boolean }
  | { type: "asset"; key: string; row: AssetRow; depth: number };

export const useAdminAssetsStore = defineStore("admin-assets", () => {
  const rows = ref<AssetRow[]>([]);
  const search = ref("");
  const kind = ref<"all" | "image" | "video">("all");
  const viewMode = ref<"list" | "grid" | "tree">("grid");
  const currentFolder = ref("");
  const includeDescendants = ref(false);
  const expandedFolders = ref<string[]>([]);
  // Empty folders are session-only; persisted folders are inferred from asset records.
  const draftFolders = ref<string[]>([]);
  const folderDialog = ref<FolderDialog | null>(null);
  const folderInput = ref("");
  const folderError = ref("");
  const savingFolder = ref(false);
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
  const busy = computed(() => uploading.value || removing.value || savingFolder.value);
  const folderPaths = computed(() => [...new Set(
    [...rows.value.map(row => row.folder), ...draftFolders.value].flatMap(assetFolderAncestors),
  )].sort((a, b) => a.localeCompare(b, "vi")));
  const breadcrumbs = computed(() => ["", ...assetFolderAncestors(currentFolder.value)]
    .map(folder => ({ folder, name: assetFolderName(folder) })));
  const matchingRows = computed(() => rows.value.filter(row =>
    row.folder.startsWith(currentFolder.value) &&
    (kind.value === "all" || row.kind === kind.value) &&
    row.name.toLocaleLowerCase("vi").includes(search.value.trim().toLocaleLowerCase("vi")),
  ));
  const filteredRows = computed(() => matchingRows.value.filter(row =>
    viewMode.value === "tree" || includeDescendants.value || row.folder === currentFolder.value,
  ));
  const folderCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const row of matchingRows.value) {
      for (const folder of assetFolderAncestors(row.folder)) counts.set(folder, (counts.get(folder) ?? 0) + 1);
    }
    return counts;
  });
  watch([matchingRows, viewMode], () => {
    if (viewMode.value === "tree" && search.value.trim()) {
      expandedFolders.value = [...new Set(matchingRows.value.flatMap(row => assetFolderAncestors(row.folder)))];
    }
  }, { flush: "sync" });
  const visibleEntries = computed<ViewEntry[]>(() => {
    const children = new Map<string, string[]>();
    for (const folder of folderPaths.value) {
      const parent = assetFolderParent(folder);
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent)!.push(folder);
    }
    const entries: ViewEntry[] = [];
    const tree = viewMode.value === "tree";
    const expanded = new Set(expandedFolders.value);
    const assetsByFolder = new Map<string, AssetRow[]>();
    for (const row of filteredRows.value) {
      if (!assetsByFolder.has(row.folder)) assetsByFolder.set(row.folder, []);
      assetsByFolder.get(row.folder)!.push(row);
    }
    function visit(parent: string, depth: number) {
      for (const folder of children.get(parent) ?? []) {
        const count = folderCounts.value.get(folder) ?? 0;
        if (tree && search.value.trim() && !count) continue;
        const open = expanded.has(folder);
        entries.push({ type: "folder", key: `folder:${folder}`, folder,
          name: assetFolderName(folder), depth, count, expanded: open });
        if (tree && open) visit(folder, depth + 1);
      }
      const files = tree ? (assetsByFolder.get(parent) ?? []) : filteredRows.value;
      for (const row of files) entries.push({ type: "asset", key: row.id, row, depth });
    }
    visit(currentFolder.value, 0);
    return entries;
  });

  function navigate(folder: string) {
    if (loading.value || busy.value) return;
    currentFolder.value = normalizeAssetFolder(folder);
  }
  function toggleFolder(folder: string) {
    if (expandedFolders.value.includes(folder)) expandedFolders.value = expandedFolders.value.filter(path => path !== folder);
    else expandedFolders.value.push(folder);
  }
  function expandAll() { expandedFolders.value = [...folderPaths.value]; }
  function collapseAll() { expandedFolders.value = []; }

  function openFolderDialog(mode: "create" | "move-folder", source = currentFolder.value) {
    if (loading.value || busy.value || (mode === "move-folder" && !source)) return;
    folderDialog.value = { mode, source };
    folderInput.value = mode === "create" ? currentFolder.value : source;
    folderError.value = "";
  }
  function requestMove(row: AssetRow) {
    if (loading.value || busy.value) return;
    folderDialog.value = { mode: "move-asset", asset: row };
    folderInput.value = row.folder;
    folderError.value = "";
  }
  function cancelFolderDialog() {
    if (savingFolder.value) return;
    folderDialog.value = null;
    folderError.value = "";
  }
  async function saveFolder() {
    if (!folderDialog.value || loading.value || busy.value) return;
    const dialog = folderDialog.value;
    folderError.value = "";
    try {
      const destination = normalizeAssetFolder(folderInput.value);
      if (dialog.mode !== "move-asset" && !destination) throw new Error("Nhập đường dẫn thư mục khác thư mục gốc.");
      if (dialog.mode === "create") {
        if (folderPaths.value.includes(destination)) throw new Error("Thư mục đã tồn tại.");
        draftFolders.value.push(destination);
        currentFolder.value = destination;
      } else if (dialog.mode === "move-asset") {
        savingFolder.value = true;
        const updated = await supabaseAssetRepository.move(dialog.asset.id, destination);
        rows.value = rows.value.map(row => row.id === updated.id ? updated : row);
      } else {
        const source = dialog.source;
        if (source === destination) { cancelFolderDialog(); return; }
        if (destination.startsWith(source)) throw new Error("Không thể chuyển thư mục vào chính nó hoặc thư mục con.");
        if (folderPaths.value.includes(destination)) throw new Error("Thư mục đích đã tồn tại. Hãy chọn đường dẫn khác.");
        const remap = (folder: string) => replaceAssetFolderPrefix(folder, source, destination);
        for (const path of folderPaths.value.filter(path => path.startsWith(source))) normalizeAssetFolder(remap(path));
        savingFolder.value = true;
        if (rows.value.some(row => row.folder.startsWith(source))) {
          await supabaseAssetRepository.moveFolder(source, destination);
        }
        rows.value = rows.value.map(row => ({ ...row, folder: remap(row.folder) }));
        draftFolders.value = draftFolders.value.map(remap);
        expandedFolders.value = expandedFolders.value.map(remap);
        currentFolder.value = remap(currentFolder.value);
      }
      folderDialog.value = null;
      toast.success(dialog.mode === "create" ? "Đã tạo thư mục. Tải tệp vào để lưu thư mục." : "Đã cập nhật thư mục.");
    } catch (cause) { folderError.value = messageOf(cause); }
    finally { savingFolder.value = false; }
  }

  async function fetchRows() {
    if (loading.value || busy.value) return;
    loading.value = true;
    error.value = "";
    try {
      rows.value = await supabaseAssetRepository.fetchAll();
      if (currentFolder.value && !folderPaths.value.includes(currentFolder.value)) {
        currentFolder.value = assetFolderAncestors(currentFolder.value).reverse()
          .find(folder => folderPaths.value.includes(folder)) ?? "";
      }
    }
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
    const destination = currentFolder.value;
    try {
      for (const file of files) {
        try {
          const row = await supabaseAssetRepository.upload(file, destination);
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
    const row = deleting.value;
    removing.value = true;
    deleteError.value = "";
    try {
      await supabaseAssetRepository.remove(row);
      rows.value = rows.value.filter(item => item.id !== row.id);
      deleting.value = null;
      toast.success("Đã xóa tệp.");
    } catch (cause) { deleteError.value = messageOf(cause); }
    finally { removing.value = false; }
  }
  function resetView() {
    if (busy.value) return;
    search.value = "";
    kind.value = "all";
    currentFolder.value = "";
    includeDescendants.value = false;
    expandedFolders.value = [];
    error.value = "";
    uploadErrors.value = [];
    cancelDelete();
    cancelFolderDialog();
  }
  return { rows, search, kind, loading, uploading, removing, busy, error, uploadErrors,
    deleteError, deleting, completed, total, filteredRows, fetchRows, upload, copyLink,
    requestDelete, cancelDelete, remove, resetView, viewMode, currentFolder, includeDescendants,
    folderPaths, breadcrumbs, visibleEntries, folderDialog, folderInput, folderError, savingFolder,
    navigate, toggleFolder, expandAll, collapseAll, openFolderDialog, requestMove, cancelFolderDialog, saveFolder };
});
