import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { supabaseSkillRepository, type Skill, type SkillPayload } from "../../../data/supabaseSkillRepository";

type SkillDraft = Omit<SkillPayload, "effect_per_level"> & { effectsJson: string };

export const useAdminSkillStore = defineStore("admin-skill", () => {
  const items = ref<Skill[]>([]);
  const loading = ref(false);
  const saving = ref(false);
  const deleting = ref(false);
  const error = ref("");
  const formError = ref("");
  const search = ref("");
  const formOpen = ref(false);
  const editingId = ref<string | null>(null);
  const draft = ref<SkillDraft | null>(null);
  const deleteTarget = ref<Skill | null>(null);
  const busy = computed(() => loading.value || saving.value || deleting.value);
  const filteredItems = computed(() => {
    const keyword = search.value.trim().toLocaleLowerCase("vi");
    return items.value.filter((item) => !keyword || [item.code, item.name, item.description]
      .some((value) => value?.toLocaleLowerCase("vi").includes(keyword)))
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "vi"));
  });

  async function fetchAll() {
    if (busy.value) return;
    loading.value = true;
    error.value = "";
    try { items.value = await supabaseSkillRepository.fetchAll(); }
    catch (cause) { error.value = cause instanceof Error ? cause.message : "Không thể tải kỹ năng."; }
    finally { loading.value = false; }
  }

  function openForm(item?: Skill) {
    if (busy.value) return;
    editingId.value = item?.id ?? null;
    draft.value = {
      code: item?.code ?? "", name: item?.name ?? "", description: item?.description ?? "",
      icon: item?.icon ?? "", max_level: item?.max_level ?? 5, sort_order: item?.sort_order ?? 0,
      is_disabled: item?.is_disabled ?? false,
      effectsJson: JSON.stringify(item?.effect_per_level ?? {}, null, 2),
    };
    formError.value = "";
    formOpen.value = true;
  }

  function closeForm() {
    if (saving.value) return;
    formOpen.value = false;
    draft.value = null;
    editingId.value = null;
    formError.value = "";
  }

  async function save() {
    if (!draft.value || busy.value) return;
    formError.value = "";
    const value = draft.value;
    let effects: unknown;
    try { effects = JSON.parse(value.effectsJson); }
    catch { formError.value = "Hiệu ứng mỗi cấp phải là JSON hợp lệ."; return; }
    if (!effects || typeof effects !== "object" || Array.isArray(effects)) {
      formError.value = "Hiệu ứng mỗi cấp phải là một đối tượng JSON, ví dụ {}."; return;
    }
    if (!value.code.trim() || !value.name.trim()) {
      formError.value = "Vui lòng nhập mã và tên kỹ năng."; return;
    }
    if (!Number.isInteger(value.max_level) || value.max_level < 1 || value.max_level > 2147483647) {
      formError.value = "Cấp tối đa phải là số nguyên từ 1 đến 2147483647."; return;
    }
    if (!Number.isInteger(value.sort_order) || value.sort_order < -2147483648 || value.sort_order > 2147483647) {
      formError.value = "Thứ tự phải là số nguyên hợp lệ."; return;
    }
    const payload: SkillPayload = {
      code: value.code.trim(), name: value.name.trim(), description: value.description?.trim() || null,
      icon: value.icon?.trim() || null, max_level: value.max_level, sort_order: value.sort_order,
      is_disabled: value.is_disabled, effect_per_level: effects as Record<string, unknown>,
    };
    saving.value = true;
    let saved = false;
    try {
      const item = editingId.value
        ? await supabaseSkillRepository.update(editingId.value, payload)
        : await supabaseSkillRepository.create(payload);
      const index = items.value.findIndex((row) => row.id === item.id);
      if (index < 0) items.value.push(item); else items.value[index] = item;
      saved = true;
    } catch (cause) { formError.value = cause instanceof Error ? cause.message : "Không thể lưu kỹ năng."; }
    finally { saving.value = false; }
    if (saved) closeForm();
  }

  function requestDelete(item: Skill) {
    if (busy.value) return;
    error.value = "";
    deleteTarget.value = item;
  }

  function cancelDelete() { if (!deleting.value) deleteTarget.value = null; }

  async function remove() {
    if (!deleteTarget.value || busy.value) return;
    const id = deleteTarget.value.id;
    deleting.value = true;
    error.value = "";
    try {
      await supabaseSkillRepository.remove(id);
      items.value = items.value.filter((item) => item.id !== id);
      deleteTarget.value = null;
    } catch (cause) { error.value = cause instanceof Error ? cause.message : "Không thể xóa kỹ năng."; }
    finally { deleting.value = false; }
  }

  return { items, loading, saving, deleting, busy, error, formError, search, filteredItems, formOpen,
    editingId, draft, deleteTarget, fetchAll, openForm, closeForm, save, requestDelete, cancelDelete, remove };
});
