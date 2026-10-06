<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import supabase from "../../database/connection";

type Kind = "personal" | "system";
interface Notice {
  id: string; title: string; body: string; type: string | null; data: Record<string, unknown> | null;
  created_at: string; user_id?: string; expires_at?: string | null; is_read?: boolean;
}
const emit = defineEmits(["close"]);
const tab = ref<Kind>("system");
const rows = ref<Notice[]>([]);
const search = ref("");
const loading = ref(false);
const error = ref("");
const saving = ref(false);
const formOpen = ref(false);
const editing = ref<Notice | null>(null);
const deleting = ref<Notice | null>(null);
const form = reactive({ title: "", body: "", type: "", userId: "", expiresAt: "" });
const filteredRows = computed(() => {
  const q = search.value.trim().toLocaleLowerCase();
  return q ? rows.value.filter((item) => `${item.title} ${item.body} ${item.type ?? ""} ${item.user_id ?? ""}`.toLocaleLowerCase().includes(q)) : rows.value;
});

async function loadRows() {
  loading.value = true; error.value = "";
  try {
    const result = tab.value === "system"
      ? await supabase.from("system_notifications").select("id,title,body,type,data,created_at,expires_at").order("created_at", { ascending: false })
      : await supabase.from("personal_notifications").select("id,user_id,title,body,type,data,is_read,created_at").order("created_at", { ascending: false });
    if (result.error) throw result.error;
    rows.value = (result.data ?? []) as Notice[];
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "Không thể tải thông báo."; }
  finally { loading.value = false; }
}

function changeTab(value: Kind) { tab.value = value; search.value = ""; void loadRows(); }
function openCreate() { editing.value = null; Object.assign(form, { title: "", body: "", type: tab.value === "system" ? "system" : "general", userId: "", expiresAt: "" }); formOpen.value = true; }
function openEdit(item: Notice) {
  editing.value = item;
  const expiresAt = item.expires_at ? new Date(item.expires_at) : null;
  const localExpires = expiresAt ? new Date(expiresAt.getTime() - expiresAt.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "";
  Object.assign(form, { title: item.title, body: item.body, type: item.type ?? "", userId: item.user_id ?? "", expiresAt: localExpires });
  formOpen.value = true;
}

async function save() {
  error.value = "";
  if (!form.title.trim() || !form.body.trim()) { error.value = "Tiêu đề và nội dung là bắt buộc."; return; }
  if (tab.value === "personal" && !form.userId.trim()) { error.value = "Cần nhập UUID người dùng cho thông báo cá nhân."; return; }
  saving.value = true;
  try {
    let result;
    if (tab.value === "system") {
      const payload = { title: form.title.trim(), body: form.body.trim(), type: form.type.trim() || "system", expires_at: form.expiresAt ? new Date(form.expiresAt).toISOString() : null };
      result = editing.value ? await supabase.from("system_notifications").update(payload).eq("id", editing.value.id) : await supabase.from("system_notifications").insert(payload);
    } else {
      const payload = { user_id: form.userId.trim(), title: form.title.trim(), body: form.body.trim(), type: form.type.trim() || "general" };
      result = editing.value ? await supabase.from("personal_notifications").update(payload).eq("id", editing.value.id) : await supabase.from("personal_notifications").insert(payload);
    }
    if (result.error) throw result.error;
    formOpen.value = false; await loadRows();
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "Không thể lưu thông báo."; }
  finally { saving.value = false; }
}

async function removeNotice() {
  if (!deleting.value) return;
  try {
    const { error: deleteError } = tab.value === "system"
      ? await supabase.from("system_notifications").delete().eq("id", deleting.value.id)
      : await supabase.from("personal_notifications").delete().eq("id", deleting.value.id);
    if (deleteError) throw deleteError;
    deleting.value = null; await loadRows();
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "Không thể xóa thông báo."; }
}
function formatDate(value: string) { return new Date(value).toLocaleString("vi-VN"); }
onMounted(loadRows);
</script>

<template>
  <div class="fixed inset-0 z-50 flex flex-col bg-gray-50">
    <header class="flex shrink-0 items-center justify-between gap-4 border-b border-emerald-900 bg-[#153221] px-5 py-4 text-white md:px-7">
      <div class="flex min-w-0 items-center gap-3"><div class="grid size-10 shrink-0 place-items-center rounded-lg border border-emerald-400/30 bg-emerald-800 text-xl">🔔</div><div><h2 class="m-0 text-lg font-extrabold">Quản lý thông báo</h2><p class="m-0 text-xs text-emerald-200">{{ rows.length }} thông báo</p></div></div>
      <button type="button" aria-label="Đóng" class="grid size-9 place-items-center rounded-lg border border-emerald-600 bg-emerald-900/50 text-xl hover:bg-emerald-800" @click="emit('close')">&times;</button>
    </header>
    <div class="flex shrink-0 flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-5 py-3 md:px-7">
      <div class="flex rounded-lg bg-gray-100 p-1"><button v-for="item in [{ id: 'system', label: 'Hệ thống' }, { id: 'personal', label: 'Cá nhân' }]" :key="item.id" type="button" class="rounded-md px-3 py-1.5 text-sm font-bold" :class="tab === item.id ? 'bg-white text-emerald-900 shadow-sm' : 'text-gray-600'" @click="changeTab(item.id as Kind)">{{ item.label }}</button></div>
      <input v-model="search" type="search" placeholder="Tìm thông báo..." class="min-w-48 flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none" />
      <button type="button" class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-50" :disabled="loading" @click="loadRows">Làm mới</button>
      <button type="button" class="rounded-lg bg-[#153221] px-3.5 py-2 text-sm font-bold text-white hover:bg-emerald-800" @click="openCreate">+ Tạo thông báo</button>
    </div>
    <main class="min-h-0 flex-1 overflow-auto p-4 md:p-6">
      <p v-if="error" role="alert" class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error }}</p>
      <div v-if="loading" class="grid min-h-64 place-items-center text-sm text-gray-500">Đang tải thông báo...</div>
      <div v-else-if="!filteredRows.length" class="grid min-h-64 place-items-center rounded-lg border border-gray-200 bg-white text-sm text-gray-500">Chưa có thông báo nào.</div>
      <div v-else class="overflow-auto rounded-lg border border-gray-200 bg-white shadow-sm"><table class="w-full min-w-220 border-separate border-spacing-0 text-left text-sm"><thead><tr class="text-[11px] uppercase text-gray-600"><th class="sticky top-0 bg-gray-100 px-4 py-3">Tiêu đề</th><th class="sticky top-0 bg-gray-100 px-4 py-3">Nội dung</th><th v-if="tab === 'personal'" class="sticky top-0 bg-gray-100 px-4 py-3">User ID</th><th class="sticky top-0 bg-gray-100 px-4 py-3">Loại</th><th class="sticky top-0 bg-gray-100 px-4 py-3">Ngày tạo</th><th class="sticky top-0 bg-gray-100 px-4 py-3 text-right">Thao tác</th></tr></thead><tbody><tr v-for="item in filteredRows" :key="item.id" class="border-t border-gray-100 hover:bg-emerald-50/40"><td class="max-w-64 px-4 py-3 font-bold text-gray-800">{{ item.title }}</td><td class="max-w-96 px-4 py-3"><p class="line-clamp-2 whitespace-pre-wrap text-gray-600">{{ item.body }}</p></td><td v-if="tab === 'personal'" class="max-w-56 break-all px-4 py-3 font-mono text-xs text-gray-500">{{ item.user_id }}</td><td class="px-4 py-3"><span class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">{{ item.type || (tab === 'system' ? 'system' : 'general') }}</span></td><td class="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{{ formatDate(item.created_at) }}</td><td class="px-4 py-3"><div class="flex justify-end gap-2"><button type="button" class="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100" @click="openEdit(item)">Sửa</button><button type="button" class="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50" @click="deleting = item">Xóa</button></div></td></tr></tbody></table></div>
    </main>
    <div v-if="formOpen" class="fixed inset-0 z-30 grid place-items-center bg-black/45 p-4" @click.self="formOpen = false"><form class="flex max-h-full w-full max-w-xl flex-col rounded-xl bg-white shadow-xl" @submit.prevent="save"><header class="border-b border-gray-200 px-5 py-4"><h3 class="m-0 text-base font-extrabold text-[#153221]">{{ editing ? 'Sửa thông báo' : 'Tạo thông báo ' + (tab === 'system' ? 'hệ thống' : 'cá nhân') }}</h3></header><div class="space-y-4 overflow-y-auto p-5"><label v-if="tab === 'personal'" class="flex flex-col gap-1.5 text-xs font-bold text-gray-600">UUID người dùng *<input v-model="form.userId" required class="rounded-md border border-gray-300 px-3 py-2 text-sm font-mono font-normal text-gray-800" placeholder="UUID" /></label><label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600">Tiêu đề *<input v-model="form.title" required maxlength="200" class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800" /></label><label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600">Nội dung *<textarea v-model="form.body" required rows="7" class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800"></textarea></label><label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600">Loại<input v-model="form.type" class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800" placeholder="general" /></label><label v-if="tab === 'system'" class="flex flex-col gap-1.5 text-xs font-bold text-gray-600">Thời gian hết hạn<input v-model="form.expiresAt" type="datetime-local" class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800" /><span class="font-normal text-gray-500">Để trống nếu không hết hạn.</span></label></div><footer class="flex justify-end gap-2 border-t border-gray-200 px-5 py-4"><button type="button" class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700" @click="formOpen = false">Hủy</button><button type="submit" :disabled="saving" class="rounded-lg bg-[#153221] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{{ saving ? 'Đang lưu...' : 'Lưu thông báo' }}</button></footer></form></div>
    <div v-if="deleting" class="fixed inset-0 z-40 grid place-items-center bg-black/45 p-4"><div class="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"><h3 class="m-0 text-base font-extrabold text-gray-800">Xóa thông báo?</h3><p class="my-3 text-sm text-gray-600">{{ deleting.title }}</p><div class="flex justify-end gap-2"><button type="button" class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-700" @click="deleting = null">Hủy</button><button type="button" class="rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white" @click="removeNotice">Xóa</button></div></div></div>
  </div>
</template>
