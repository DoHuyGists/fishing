import type { AdminItemRow, ItemPayload } from "../../../types/table/item";
import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { supabaseItemRepository } from "../../../data/supabaseItemRepository";

export const useAdminItemsManagementStore = defineStore("admin-items-management", () => {
  const items = ref<AdminItemRow[]>([]);
  const search = ref("");
  const categoryFilter = ref("ALL");
  const statusFilter = ref<"ALL" | "ENABLED" | "DISABLED">("ALL");
  const isLoading = ref(false);
  const loadError = ref("");
  const isFormOpen = ref(false);
  const isSaving = ref(false);
  const formError = ref("");
  const deletingId = ref<string | null>(null);
  const updatingId = ref<string | null>(null);
  const confirmDeleteId = ref<string | null>(null);
  const editingItem = ref<AdminItemRow | null>(null);
  const page = ref(1), total = ref(0), pageSize = 10;
  const requestId = ref(0);
  const categories = ref<string[]>([]);

  const filteredItems = computed(() => items.value);

  async function loadItems(nextPage = page.value) {
    const request = ++requestId.value;
    isLoading.value = true;
    loadError.value = "";
    try {
      const result = await supabaseItemRepository.fetchPage(nextPage, search.value, categoryFilter.value, statusFilter.value);
      if (request !== requestId.value) return;
      items.value = result.items; total.value = result.total; page.value = nextPage;
      categories.value = result.facets.category ?? [];
      if (!result.items.length && nextPage > 1) await loadItems(Math.max(1, Math.ceil(result.total / pageSize)));
    } catch (error) {
      if (request === requestId.value) loadError.value = error instanceof Error ? error.message : "Không thể tải danh sách vật phẩm";
    } finally {
      if (request === requestId.value) isLoading.value = false;
    }
  }

  function openCreateForm() {
    editingItem.value = null;
    formError.value = "";
    isFormOpen.value = true;
  }

  function openEditForm(item: AdminItemRow) {
    editingItem.value = item;
    formError.value = "";
    isFormOpen.value = true;
  }

  function closeForm() {
    isFormOpen.value = false;
    formError.value = "";
  }

  async function saveItem(payload: ItemPayload) {
    formError.value = "";
    isSaving.value = true;
    try {
      if (editingItem.value) await supabaseItemRepository.update(editingItem.value.id, payload);
      else await supabaseItemRepository.create(payload);
      closeForm();
      await loadItems();
    } catch (error) {
      formError.value = error instanceof Error ? error.message : "Không thể lưu vật phẩm";
    } finally {
      isSaving.value = false;
    }
  }

  async function toggleEnabled(item: AdminItemRow) {
    updatingId.value = item.id;
    loadError.value = "";
    try {
      await supabaseItemRepository.update(item.id, {
        category: item.category,
        classification: item.classification,
        rpc: item.rpc,
        name: item.name,
        information: item.information,
        image: item.image,
        icon: item.icon,
        quantity: item.quantity,
        price: item.price,
        isDisabled: item.isDisabled === false,
      });
      await loadItems();
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : "Không thể cập nhật trạng thái vật phẩm";
    } finally {
      updatingId.value = null;
    }
  }

  async function deleteItem() {
    if (!confirmDeleteId.value) return;
    deletingId.value = confirmDeleteId.value;
    try {
      await supabaseItemRepository.delete(confirmDeleteId.value);
      if (editingItem.value?.id === confirmDeleteId.value) closeForm();
      confirmDeleteId.value = null;
      await loadItems();
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : "Không thể xoá vật phẩm";
    } finally {
      deletingId.value = null;
    }
  }

  return {
    items, search, categoryFilter, statusFilter, isLoading, loadError, isFormOpen, isSaving, formError,
    page, pageSize, total, requestId,
    deletingId, updatingId, confirmDeleteId, editingItem, categories, filteredItems,
    loadItems, openCreateForm, openEditForm, closeForm, saveItem, toggleEnabled, deleteItem,
  };
});
